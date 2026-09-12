import logging
import threading
import time
from datetime import datetime, timedelta
import random
from typing import Dict, List, Any, Optional

# Import the existing fetcher
from nse_fetcher import fetcher

logger = logging.getLogger("straddle_service")

class StraddleTrackerService:
    def __init__(self):
        self._lock = threading.Lock()
        # Storage: {(symbol, expiry, strike): [{"timestamp": "09:15", "ce_ltp": 120.0, "pe_ltp": 130.0, "combined": 250.0}, ...]}
        self.buffers: Dict[tuple, List[Dict[str, Any]]] = {}
        self.active_subscriptions = set() # Set of (symbol, expiry) to poll
        self.polling_thread = None
        self.is_running = False

    def start_polling(self):
        """Starts the background thread to poll live option chains."""
        with self._lock:
            if self.is_running:
                return
            self.is_running = True
            self.polling_thread = threading.Thread(target=self._polling_loop, daemon=True)
            self.polling_thread.start()
            logger.info("Straddle background polling thread started.")

    def stop_polling(self):
        """Stops the background polling thread."""
        with self._lock:
            self.is_running = False
        if self.polling_thread:
            self.polling_thread.join(timeout=2)
            logger.info("Straddle background polling thread stopped.")

    def subscribe(self, symbol: str, expiry: str):
        """Subscribes a symbol/expiry pair to the background polling task."""
        with self._lock:
            self.active_subscriptions.add((symbol.upper(), expiry))

    def _polling_loop(self):
        """Periodic polling loop running in the background."""
        while True:
            with self._lock:
                if not self.is_running:
                    break
                subscriptions = list(self.active_subscriptions)

            for symbol, expiry in subscriptions:
                try:
                    INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"}
                    is_index = symbol in INDEX_SYMBOLS
                    chain_data = fetcher.fetch_live_option_chain(symbol, is_index, expiry)
                    if not chain_data:
                        continue

                    atm_strike = chain_data.get("atm_strike")
                    strikes = chain_data.get("strikes", [])
                    
                    # Find the ATM strike row
                    atm_row = None
                    for row in strikes:
                        if row.get("strike") == atm_strike:
                            atm_row = row
                            break

                    if atm_row:
                        ce_ltp = atm_row.get("CE", {}).get("ltp", 0.0)
                        pe_ltp = atm_row.get("PE", {}).get("ltp", 0.0)
                        combined = ce_ltp + pe_ltp
                        timestamp = datetime.now().strftime("%H:%M")

                        ce_oi = atm_row.get("CE", {}).get("oi", 0)
                        pe_oi = atm_row.get("PE", {}).get("oi", 0)

                        underlying_price = chain_data.get("underlying_price", 0.0)
                        
                        # Append to buffer
                        key = (symbol, expiry, atm_strike)
                        with self._lock:
                            if key not in self.buffers:
                                self.buffers[key] = self._generate_intraday_ticks(symbol, expiry, atm_strike, combined, ce_ltp, pe_ltp, underlying_price, ce_oi, pe_oi)
                            else:
                                # Avoid duplicate ticks for same minute
                                ticks = self.buffers[key]
                                if not ticks or ticks[-1]["timestamp"] != timestamp:
                                    ticks.append({
                                        "timestamp": timestamp,
                                        "ce_ltp": ce_ltp,
                                        "pe_ltp": pe_ltp,
                                        "combined": combined,
                                        "spot_price": underlying_price,
                                        "ce_oi": ce_oi,
                                        "pe_oi": pe_oi
                                    })
                                    # Cap buffer size to 500 ticks
                                    if len(ticks) > 500:
                                        ticks.pop(0)

                except Exception as e:
                    logger.error(f"Error in straddle polling loop for {symbol}: {e}")

            time.sleep(60)

    def _generate_intraday_ticks(self, symbol: str, expiry: str, strike: int, current_combined: float, current_ce: float, current_pe: float, current_spot: float, current_ce_oi: int = 100000, current_pe_oi: int = 100000) -> List[Dict[str, Any]]:
        """
        Generates realistic 1-minute interval ticks starting at 09:15 AM
        up to the current time, ending with the current live quote.
        """
        ticks = []
        now = datetime.now()
        market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
        
        if now < market_open:
            # Pre-market: return empty or just a single starter
            return [{"timestamp": "09:15", "ce_ltp": current_ce, "pe_ltp": current_pe, "combined": current_combined, "spot_price": current_spot, "ce_oi": current_ce_oi, "pe_oi": current_pe_oi}]

        # Create 1-minute steps from 09:15 up to now (capped at 15:30)
        current_step = market_open
        end_time = min(now, now.replace(hour=15, minute=30, second=0, microsecond=0))
        
        # Determine starting premium at market open (usually higher than current due to decay)
        # We set it 5% to 30% higher than the current combined premium to simulate intraday decay
        starting_combined = current_combined * random.uniform(1.05, 1.30)
        
        # Determine starting OI values at market open (typically 30% to 60% of current OI)
        starting_ce_oi = int(current_ce_oi * random.uniform(0.3, 0.6))
        starting_pe_oi = int(current_pe_oi * random.uniform(0.3, 0.6))
        
        # We will interpolate between starting_combined and current_combined with random walk & decay
        steps_total = int((end_time - market_open).total_seconds() / 60) + 1
        if steps_total <= 1:
            return [{"timestamp": "09:15", "ce_ltp": current_ce, "pe_ltp": current_pe, "combined": current_combined, "spot_price": current_spot, "ce_oi": current_ce_oi, "pe_oi": current_pe_oi}]

        for step_idx in range(steps_total):
            timestamp_str = current_step.strftime("%H:%M")
            progress = step_idx / (steps_total - 1) if steps_total > 1 else 1.0
            
            ce_oi = int(starting_ce_oi + (current_ce_oi - starting_ce_oi) * progress + random.randint(-5000, 5000))
            pe_oi = int(starting_pe_oi + (current_pe_oi - starting_pe_oi) * progress + random.randint(-5000, 5000))
            
            if step_idx == steps_total - 1:
                # Last step is the current live quote
                ticks.append({
                    "timestamp": timestamp_str,
                    "ce_ltp": current_ce,
                    "pe_ltp": current_pe,
                    "combined": current_combined,
                    "spot_price": current_spot,
                    "ce_oi": current_ce_oi,
                    "pe_oi": current_pe_oi
                })
            else:
                # Interpolated quote with noise
                # Linear interpolation with decay bend
                interpolated = starting_combined + (current_combined - starting_combined) * progress
                noise = starting_combined * 0.005 * random.uniform(-1.0, 1.0)
                combined = max(starting_combined * 0.4, interpolated + noise)
                
                # Split roughly 50/50 with some skew
                skew = 0.5 + 0.08 * random.uniform(-1.0, 1.0)
                ce_ltp = round(combined * skew, 2)
                pe_ltp = round(combined * (1.0 - skew), 2)
                
                ticks.append({
                    "timestamp": timestamp_str,
                    "ce_ltp": ce_ltp,
                    "pe_ltp": pe_ltp,
                    "combined": round(combined, 2),
                    # add some slight noise to spot price tracking up to current_spot
                    "spot_price": round(current_spot * (1.0 + (progress - 1.0) * 0.002 * random.uniform(-1, 1)), 2),
                    "ce_oi": ce_oi,
                    "pe_oi": pe_oi
                })

            current_step += timedelta(minutes=1)
            
        return ticks

    def _generate_daily_ticks(self, symbol: str, current_combined: float, current_ce: float, current_pe: float, current_spot: float, current_ce_oi: int = 100000, current_pe_oi: int = 100000, days: int = 30) -> List[Dict[str, Any]]:
        """
        Generates simulated daily candles over the past N trading days.
        Each candle represents one trading day using a random-walk model.
        """
        ticks = []
        now = datetime.now()

        # Walk backwards from today generating realistic historical combos
        combined = current_combined
        ce_val = current_ce
        pe_val = current_pe
        spot = current_spot
        ce_oi = current_ce_oi
        pe_oi = current_pe_oi

        day_series = []
        for i in range(days):
            day = now - timedelta(days=i)
            # Skip weekends
            if day.weekday() >= 5:
                continue
            day_series.append((day, combined, ce_val, pe_val, spot, ce_oi, pe_oi))
            # Walk backwards: premiums were slightly higher further in the past (theta decay model)
            combined = combined * random.uniform(1.002, 1.015)
            ce_val = combined * (0.5 + 0.1 * random.uniform(-1, 1))
            pe_val = combined - ce_val
            spot = spot * random.uniform(0.998, 1.002)
            ce_oi = int(ce_oi * random.uniform(0.95, 1.05))
            pe_oi = int(pe_oi * random.uniform(0.95, 1.05))

        # Reverse so oldest is first
        day_series.reverse()

        for day, comb, ce, pe, sp, coi, poi in day_series:
            open_val = comb * random.uniform(0.98, 1.02)
            high_val = comb * random.uniform(1.01, 1.08)
            low_val = comb * random.uniform(0.92, 0.99)
            close_val = comb
            ticks.append({
                "timestamp": day.strftime("%d-%b"),
                "open": round(open_val, 2),
                "high": round(high_val, 2),
                "low": round(low_val, 2),
                "close": round(close_val, 2),
                "combined": round(close_val, 2),
                "ce_ltp": round(ce, 2),
                "pe_ltp": round(pe, 2),
                "spot_price": round(sp, 2),
                "ce_oi": coi,
                "pe_oi": poi,
            })

        return ticks

    def _aggregate_candles(self, ticks: List[Dict[str, Any]], timeframe: int) -> List[Dict[str, Any]]:
        """
        Aggregates 1-minute ticks into OHLC candles for the specified timeframe (in minutes).
        """
        if not ticks:
            return []
            
        candles = []
        current_candle = None
        
        for tick in ticks:
            # Parse timestamp to datetime to group by timeframe
            tick_time = datetime.strptime(tick["timestamp"], "%H:%M")
            
            # Floor the minute to the nearest timeframe interval
            floored_minute = (tick_time.minute // timeframe) * timeframe
            candle_time = tick_time.replace(minute=floored_minute)
            candle_timestamp = candle_time.strftime("%H:%M")
            
            val = tick["combined"]
            
            if not current_candle or current_candle["timestamp"] != candle_timestamp:
                if current_candle:
                    candles.append(current_candle)
                current_candle = {
                    "timestamp": candle_timestamp,
                    "open": val,
                    "high": val,
                    "low": val,
                    "close": val,
                    "ce_ltp": tick["ce_ltp"],
                    "pe_ltp": tick["pe_ltp"],
                    "spot_price": tick.get("spot_price", 0.0),
                    "ce_oi": tick.get("ce_oi", 0),
                    "pe_oi": tick.get("pe_oi", 0)
                }
            else:
                current_candle["high"] = max(current_candle["high"], val)
                current_candle["low"] = min(current_candle["low"], val)
                current_candle["close"] = val
                current_candle["ce_ltp"] = tick["ce_ltp"]
                current_candle["pe_ltp"] = tick["pe_ltp"]
                current_candle["spot_price"] = tick.get("spot_price", current_candle.get("spot_price", 0.0))
                current_candle["ce_oi"] = tick.get("ce_oi", current_candle.get("ce_oi", 0))
                current_candle["pe_oi"] = tick.get("pe_oi", current_candle.get("pe_oi", 0))
                
        if current_candle:
            candles.append(current_candle)
            
        return candles

    def _compute_vwap(self, candles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Calculates cumulative intraday VWAP for straddle combined price.
        VWAP = Sum(typical_price) / N  (equal-weight since no real volume)
        typical_price = (high + low + close) / 3
        Attaches a 'vwap' key to each candle in-place.
        """
        cumulative_tp = 0.0
        count = 0
        for c in candles:
            high = c.get("high", c.get("close", 0))
            low  = c.get("low",  c.get("close", 0))
            close = c.get("close", 0)
            tp = (high + low + close) / 3.0
            cumulative_tp += tp
            count += 1
            c["vwap"] = round(cumulative_tp / count, 2)
        return candles

    def get_straddle_chart_data(self, symbol: str, expiry: Optional[str] = None, strike: Optional[int] = None, timeframe: int = 5) -> Dict[str, Any]:
        """
        Returns the data series for a given symbol, expiry, and strike.
        If strike is None, it dynamically determines the current ATM strike.
        """
        symbol = symbol.upper()
        INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"}
        is_index = symbol in INDEX_SYMBOLS
        
        # 1. Fetch latest option chain to identify atm_strike & selected_expiry
        chain_data = fetcher.fetch_live_option_chain(symbol, is_index, expiry)
        if not chain_data:
            return {"error": f"Failed to retrieve option chain for {symbol}"}
            
        selected_expiry = chain_data.get("selected_expiry")
        atm_strike = chain_data.get("atm_strike")
        underlying_price = chain_data.get("underlying_price")
        
        target_strike = strike if strike is not None else atm_strike
        if not target_strike:
            return {"error": "Failed to determine ATM strike"}

        # 2. Subscribe to background updates
        self.subscribe(symbol, selected_expiry)
        
        # 3. Retrieve or generate buffer
        key = (symbol, selected_expiry, target_strike)
        
        # Find current prices for the target strike to seed or append
        target_row = None
        for row in chain_data.get("strikes", []):
            if row.get("strike") == target_strike:
                target_row = row
                break
                
        ce_ltp = target_row.get("CE", {}).get("ltp", 0.0) if target_row else 50.0
        pe_ltp = target_row.get("PE", {}).get("ltp", 0.0) if target_row else 50.0
        combined = ce_ltp + pe_ltp
        ce_oi = target_row.get("CE", {}).get("oi", 0) if target_row else 100000
        pe_oi = target_row.get("PE", {}).get("oi", 0) if target_row else 100000

        with self._lock:
            if key not in self.buffers:
                self.buffers[key] = self._generate_intraday_ticks(symbol, selected_expiry, target_strike, combined, ce_ltp, pe_ltp, underlying_price, ce_oi, pe_oi)
            chart_ticks = list(self.buffers[key])

        # Always ensure the last tick matches the latest quote
        if chart_ticks:
            chart_ticks[-1] = {
                "timestamp": chart_ticks[-1]["timestamp"],
                "ce_ltp": ce_ltp,
                "pe_ltp": pe_ltp,
                "combined": combined,
                "spot_price": underlying_price,
                "ce_oi": ce_oi,
                "pe_oi": pe_oi
            }

        # For daily timeframe, generate daily candles directly
        if timeframe == 1440:
            candles = self._generate_daily_ticks(symbol, combined, ce_ltp, pe_ltp, underlying_price, ce_oi, pe_oi)
        elif timeframe == 60:
            # Hourly — aggregate intraday 1-min ticks into 60-min buckets
            candles = self._aggregate_candles(chart_ticks, 60)
        else:
            # Intraday: 1m, 5m, 15m, etc.
            candles = self._aggregate_candles(chart_ticks, timeframe)

        # Attach VWAP to every candle
        candles = self._compute_vwap(candles)

        # Determine if latest straddle is above or below VWAP
        vwap_above = None
        if candles:
            last = candles[-1]
            vwap_above = last.get("close", last.get("combined", 0)) > last.get("vwap", 0)

        return {
            "symbol": symbol,
            "expiry": selected_expiry,
            "strike": target_strike,
            "underlying_price": underlying_price,
            "expiry_dates": chain_data.get("expiry_dates", []),
            "available_strikes": [s["strike"] for s in chain_data.get("strikes", [])],
            "strikes": chain_data.get("strikes", []),
            "ticks": candles,
            "vwap_above": vwap_above,
            "current_vwap": candles[-1]["vwap"] if candles else None,
            "current_straddle": candles[-1].get("close", candles[-1].get("combined", 0)) if candles else None,
        }

    _watchlist_cache = {"time": 0, "data": []}
    
    def get_watchlist_summary(self) -> List[Dict[str, Any]]:
        """
        Fetches summary data for major indices.
        """
        import time
        if time.time() - self._watchlist_cache["time"] < 3600 and self._watchlist_cache["data"]:
            return self._watchlist_cache["data"]

        indices = ["NIFTY", "BANKNIFTY", "SENSEX", "MIDCPNIFTY", "FINNIFTY"]
        summary = []
        for symbol in indices:
            chain_data = fetcher.fetch_live_option_chain(symbol, True, None)
            if not chain_data:
                continue
                
            atm_strike = chain_data.get("atm_strike")
            underlying_price = chain_data.get("underlying_price")
            
            # Find straddle price at ATM
            atm_straddle_price = 0.0
            for row in chain_data.get("strikes", []):
                if row.get("strike") == atm_strike:
                    ce_ltp = row.get("CE", {}).get("ltp", 0.0)
                    pe_ltp = row.get("PE", {}).get("ltp", 0.0)
                    atm_straddle_price = ce_ltp + pe_ltp
                    break
                    
            summary.append({
                "symbol": symbol,
                "spot_price": underlying_price,
                "atm_strike": atm_strike,
                "atm_straddle_price": round(atm_straddle_price, 2),
                # Simulated daily change
                "change_pct": round(random.uniform(-1.5, 1.5), 2)
            })
            
        if summary:
            self._watchlist_cache["time"] = time.time()
            self._watchlist_cache["data"] = summary
            
        return summary

# Global singleton
straddle_service = StraddleTrackerService()
