import threading
import time
import logging
import random
from typing import List, Dict, Any, Optional
from datetime import datetime
from nse_fetcher import fetcher

logger = logging.getLogger("oi_crossover")

class OICrossoverService:
    def __init__(self):
        self.status = "idle"  # "idle", "scanning", "completed", "failed"
        self.results = []
        self.timestamp = ""
        self._lock = threading.Lock()
        self._thread = None

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": self.status,
                "timestamp": self.timestamp,
                "count": len(self.results)
            }

    def get_results(self) -> List[Dict[str, Any]]:
        with self._lock:
            return self.results

    def start_scan_async(self) -> bool:
        """
        Starts the scanner thread if not already running.
        Returns True if started, False if already running.
        """
        with self._lock:
            if self.status == "scanning":
                return False
            self.status = "scanning"
            self.results = []
            self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
        self._thread = threading.Thread(target=self._run_scan_loop, daemon=True)
        self._thread.start()
        return True

    def _run_scan_loop(self):
        logger.info("Starting OI Crossover Scan...")
        indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]
        temp_results = []
        
        try:
            for idx in indices:
                try:
                    logger.info(f"Scanning option chain for index: {idx}")
                    # Fetch chain (default nearest expiry)
                    chain_data = fetcher.fetch_live_option_chain(idx, is_index=True)
                    if not chain_data:
                        logger.error(f"Failed to fetch option chain for {idx}")
                        continue
                        
                    spot = chain_data.get("underlying_price", 0.0)
                    atm = chain_data.get("atm_strike", 0)
                    pcr = chain_data.get("pcr", 0.0)
                    max_pain = chain_data.get("max_pain", 0)
                    strikes = chain_data.get("strikes", [])
                    expiry = chain_data.get("selected_expiry", "N/A")
                    is_mock = chain_data.get("is_mock", False)
                    snapshot_ts = chain_data.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

                    # PCR Read mapping
                    if pcr > 1.2:
                        pcr_read = "Bullish Tilt"
                    elif pcr < 0.8:
                        pcr_read = "Bearish Tilt"
                    else:
                        pcr_read = "Neutral"

                    # 1. Calculate Strike-wise OI Crossover Zone
                    crossover_zone = "N/A"
                    sorted_strikes = sorted(strikes, key=lambda x: x["strike"])
                    
                    flip_below = None
                    flip_above = None
                    
                    for i in range(len(sorted_strikes) - 1):
                        s1 = sorted_strikes[i]
                        s2 = sorted_strikes[i+1]
                        
                        s1_ce_oi = s1.get("CE", {}).get("oi", 0)
                        s1_pe_oi = s1.get("PE", {}).get("oi", 0)
                        
                        s2_ce_oi = s2.get("CE", {}).get("oi", 0)
                        s2_pe_oi = s2.get("PE", {}).get("oi", 0)
                        
                        # Dominance flip check (Put dominant below -> Call dominant above)
                        if s1_pe_oi >= s1_ce_oi and s2_ce_oi > s2_pe_oi:
                            # Verify we are close to the spot price to filter wing noise
                            if abs(s1["strike"] - spot) / spot < 0.08:
                                flip_below = s1["strike"]
                                flip_above = s2["strike"]
                                break

                    if flip_below and flip_above:
                        crossover_zone = f"{int(flip_below):,} - {int(flip_above):,}"
                    else:
                        # Fallback simple search if no clean walk-up flip is found
                        # Just find where Put OI is max and Call OI is max and state the range between them
                        max_put_strike = chain_data.get("max_put_oi_strike")
                        max_call_strike = chain_data.get("max_call_oi_strike")
                        if max_put_strike and max_call_strike:
                            crossover_zone = f"{int(min(max_put_strike, max_call_strike)):,} - {int(max(max_put_strike, max_call_strike)):,}"

                    # 2. Identify largest fresh OI additions
                    max_call_add = 0
                    max_call_add_strike = None
                    max_put_add = 0
                    max_put_add_strike = None
                    
                    total_call_oi = 0
                    total_put_oi = 0

                    for s in strikes:
                        ce_data = s.get("CE", {}) or {}
                        pe_data = s.get("PE", {}) or {}
                        
                        ce_oi = ce_data.get("oi", 0)
                        pe_oi = pe_data.get("oi", 0)
                        
                        total_call_oi += ce_oi
                        total_put_oi += pe_oi

                        ce_chg = ce_data.get("oi_change", 0)
                        pe_chg = pe_data.get("oi_change", 0)
                        
                        # Look for largest positive builds (additions)
                        if ce_chg > max_call_add:
                            max_call_add = ce_chg
                            max_call_add_strike = s["strike"]
                            
                        if pe_chg > max_put_add:
                            max_put_add = pe_chg
                            max_put_add_strike = s["strike"]

                    temp_results.append({
                        "index": idx,
                        "spot": spot,
                        "atm": atm,
                        "pcr": round(pcr, 2),
                        "pcr_read": pcr_read,
                        "max_pain": max_pain,
                        "crossover_zone": crossover_zone,
                        "total_call_oi": total_call_oi,
                        "total_put_oi": total_put_oi,
                        "expiry": expiry,
                        "is_mock": is_mock,
                        "snapshot_ts": snapshot_ts,
                        "fresh_call_oi": max_call_add,
                        "fresh_call_strike": max_call_add_strike,
                        "fresh_put_oi": max_put_add,
                        "fresh_put_strike": max_put_add_strike
                    })
                    
                    # Sleep slightly to avoid spamming the local rate limit
                    time.sleep(0.5)
                    
                except Exception as ex:
                    logger.error(f"Error scanning index {idx}: {ex}")

            with self._lock:
                self.results = temp_results
                self.status = "completed"
                self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
        except Exception as e:
            logger.error(f"Fatal error in scanner execution: {e}")
            with self._lock:
                self.status = "failed"

oi_crossover_service = OICrossoverService()
