import os
import sys
import time
import io
import json
import logging
import threading
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd

# Add workspace and execution root to sys.path
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from execution.option_chain_analyzer_engine import compute_dharaskar_metrics
from nse_fetcher import fetcher

logger = logging.getLogger("analyzer_service")

INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "BANKEX", "SENSEX"}


class OptionChainAnalyzerService:
    def __init__(self):
        # Key: (symbol, expiry, strike) -> List of tick dictionaries
        self.history_ledgers: Dict[str, List[Dict[str, Any]]] = {}
        self.last_timestamps: Dict[str, str] = {}
        self.lock = threading.Lock()

    def get_analyzer_data(
        self,
        symbol: str = "NIFTY",
        expiry: Optional[str] = None,
        strike: Optional[float] = None,
        mode: Optional[str] = None
    ) -> Dict[str, Any]:
        sym = symbol.strip().upper()
        is_index = sym in INDEX_SYMBOLS if mode is None else (mode.lower() == "index")

        # Fetch option chain from nse_fetcher
        chain_data = fetcher.fetch_live_option_chain(symbol=sym, is_index=is_index, expiry=expiry)
        if not chain_data:
            return {"error": f"Failed to fetch option chain for {sym}"}

        underlying_price = float(chain_data.get("underlying_price", 0.0))
        selected_expiry = chain_data.get("selected_expiry", "")
        expiry_dates = chain_data.get("expiry_dates", [])
        strikes_raw = chain_data.get("strikes", [])
        timestamp_str = chain_data.get("timestamp", time.strftime("%H:%M:%S"))

        if not strikes_raw:
            return {"error": f"No strikes data returned for {sym}"}

        # Convert strikes_raw into engine format
        raw_records = []
        for s in strikes_raw:
            raw_records.append({
                "strikePrice": s.get("strike"),
                "CE": s.get("CE", {}),
                "PE": s.get("PE", {})
            })

        # Calculate metrics
        metrics = compute_dharaskar_metrics(
            raw_data=raw_records,
            target_strike=strike,
            underlying_value=underlying_price,
            is_index=is_index
        )

        if not metrics:
            return {"error": "Failed to compute option chain metrics"}

        active_target_strike = metrics["target_strike"]
        ledger_key = f"{sym}_{selected_expiry}_{active_target_strike}"

        with self.lock:
            if ledger_key not in self.history_ledgers:
                self.history_ledgers[ledger_key] = []

            # Record tick entry if empty or timestamp changed
            last_ts = self.last_timestamps.get(ledger_key)
            if len(self.history_ledgers[ledger_key]) == 0 or last_ts != timestamp_str:
                self.last_timestamps[ledger_key] = timestamp_str
                tick_entry = {
                    "time": timestamp_str,
                    "value": underlying_price,
                    "call_sum": metrics["call_sum"],
                    "put_sum": metrics["put_sum"],
                    "difference": metrics["difference"],
                    "call_boundary": metrics["call_boundary"],
                    "put_boundary": metrics["put_boundary"],
                    "call_itm": metrics.get("call_itm_val", 0.0),
                    "call_itm_signal": metrics.get("call_itm_signal", False),
                    "put_itm": metrics.get("put_itm_val", 0.0),
                    "put_itm_signal": metrics.get("put_itm_signal", False),
                    "call_exits": metrics.get("call_exits", False),
                    "put_exits": metrics.get("put_exits", False),
                    "sentiment": metrics.get("sentiment", "NEUTRAL"),
                    "pcr": metrics.get("pcr", 0.0)
                }
                self.history_ledgers[ledger_key].append(tick_entry)
                # Keep last 150 ticks
                if len(self.history_ledgers[ledger_key]) > 150:
                    self.history_ledgers[ledger_key] = self.history_ledgers[ledger_key][-150:]

            current_history = list(self.history_ledgers[ledger_key])

        strikes_numbers = [float(s.get("strike", 0)) for s in strikes_raw if s.get("strike") is not None]
        atm_strike = min(strikes_numbers, key=lambda x: abs(x - underlying_price)) if strikes_numbers else active_target_strike
        max_pain = chain_data.get("max_pain", atm_strike)

        summary = {
            "atm_strike": atm_strike,
            "unit_scale": metrics.get("units", "Thousands (K)" if is_index else "Tens (10s)"),
            "bias_direction": metrics.get("bias_direction", metrics.get("sentiment", "NEUTRAL")),
            "difference": metrics.get("difference", 0.0),
            "pcr": metrics.get("pcr", 0.0),
            "max_pain": max_pain
        }

        return {
            "symbol": sym,
            "selected_expiry": selected_expiry,
            "expiry_dates": expiry_dates,
            "expiries": expiry_dates,
            "underlying_price": underlying_price,
            "underlying_value": underlying_price,
            "timestamp": timestamp_str,
            "is_index": is_index,
            "target_strike": active_target_strike,
            "strike": active_target_strike,
            "strikes": strikes_numbers,
            "units": metrics.get("units", ""),
            "metrics": metrics,
            "summary": summary,
            "time_series": current_history,
            "history": current_history,
            "full_chain": strikes_raw,
            "is_mock": chain_data.get("is_mock", False)
        }

    def export_history_csv(
        self,
        symbol: str = "NIFTY",
        expiry: Optional[str] = None,
        strike: Optional[float] = None
    ) -> str:
        sym = symbol.strip().upper()
        # Fetch current data to resolve default strike / expiry
        data = self.get_analyzer_data(sym, expiry=expiry, strike=strike)
        if "error" in data:
            return "Error," + data["error"]

        selected_expiry = data["selected_expiry"]
        target_strike = data["target_strike"]
        ledger_key = f"{sym}_{selected_expiry}_{target_strike}"

        with self.lock:
            history = list(self.history_ledgers.get(ledger_key, []))

        if not history:
            return "Time,Value,Call Sum,Put Sum,Difference,Call Boundary,Put Boundary,Call ITM,Put ITM"

        df = pd.DataFrame(history)
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        return buf.getvalue()

    def dump_full_chain_csv(
        self,
        symbol: str = "NIFTY",
        expiry: Optional[str] = None
    ) -> str:
        sym = symbol.strip().upper()
        chain_data = fetcher.fetch_live_option_chain(symbol=sym, is_index=(sym in INDEX_SYMBOLS), expiry=expiry)
        if not chain_data or not chain_data.get("strikes"):
            return "Error,No option chain data available"

        rows = []
        for s in chain_data["strikes"]:
            sp = s.get("strike")
            ce = s.get("CE", {})
            pe = s.get("PE", {})
            rows.append({
                "CE_OI": ce.get("openInterest") or ce.get("oi", 0),
                "CE_Change_OI": ce.get("changeinOpenInterest") or ce.get("oi_change", 0),
                "CE_Volume": ce.get("totalTradedVolume") or ce.get("volume", 0),
                "CE_IV": ce.get("impliedVolatility") or ce.get("iv", 0.0),
                "CE_LTP": ce.get("lastPrice") or ce.get("ltp", 0.0),
                "Strike_Price": sp,
                "PE_LTP": pe.get("lastPrice") or pe.get("ltp", 0.0),
                "PE_IV": pe.get("impliedVolatility") or pe.get("iv", 0.0),
                "PE_Volume": pe.get("totalTradedVolume") or pe.get("volume", 0),
                "PE_Change_OI": pe.get("changeinOpenInterest") or pe.get("oi_change", 0),
                "PE_OI": pe.get("openInterest") or pe.get("oi", 0)
            })

        df = pd.DataFrame(rows)
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        return buf.getvalue()


analyzer_service = OptionChainAnalyzerService()
