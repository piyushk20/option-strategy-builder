import os
import sys
import time
import json
import io
import logging
import threading
import warnings
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np

# Ensure workspace root and execution are in sys.path
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

# Import the standalone Minervini VCP scanner engine
from execution.minervini_vcp_scanner import MinerviniVCPScanner, ScannerConfig
from minervini_vcp_strategy import StrategyConfig as BacktestStrategyConfig, MinerviniVCPStrategy, load_ohlcv

warnings.filterwarnings("ignore")
logger = logging.getLogger("vcp_scanner_service")

# Universes for VCP Screening
NIFTY_50_UNIVERSE = [
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "BAJFINANCE",
    "BAJAJ-AUTO", "HINDUNILVR", "ITC", "LT", "AXISBANK", "KOTAKBANK",
    "MARUTI", "TITAN", "SUNPHARMA", "ULTRACEMCO", "NTPC", "POWERGRID",
    "M&M", "TATAMOTORS", "TATASTEEL", "ADANIENT", "ADANIPORTS", "ASIANPAINT",
    "BHARTIARTL", "WIPRO", "HCLTECH", "TECHM", "DIVISLAB", "CIPLA",
    "DRREDDY", "EICHERMOT", "GRASIM", "HEROMOTOCO", "JSWSTEEL", "COALINDIA",
    "BPCL", "ONGC", "NESTLEIND", "BRITANNIA", "SBILIFE", "HDFCLIFE",
    "INDUSINDBK", "APOLLOHOSP", "TATACONSUM", "BAJAJFINSV", "HINDALCO", "LTIM", "SHRIRAMFIN"
]

LIQUID_FO_UNIVERSE = NIFTY_50_UNIVERSE + [
    "DABUR", "GODREJCP", "PIDILITIND", "SIEMENS", "HAVELLS", "DIXON", "BSE", "CDSL",
    "MCX", "HAL", "BEL", "POLYCAB", "PERSISTENT", "TRENT", "ZOMATO", "JIOFIN", "VEDL",
    "COFORGE", "MPHASIS", "FEDERALBNK", "IDFCFIRSTB", "ASHOKLEY", "AUROPHARMA", "LUPIN",
    "MAXHEALTH", "OBEROIRLTY", "PIIND", "SUPREMEIND", "TIINDIA", "ASTRAL", "BHARATFORG",
    "CUMMINSIND", "GODREJPROP", "INDUSTOWER", "MARICO", "MRF", "MUTHOOTFIN", "PETRONET",
    "PFC", "RECLTD", "SRF", "SUNDARMFIN", "TATAELXSI", "TORNTPOWER", "TUBEINVEST", "UPL", "VOLTAS"
]

MIDCAP_UNIVERSE = [
    "PERSISTENT", "TRENT", "DIXON", "BSE", "CDSL", "MCX", "HAL", "BEL", "POLYCAB",
    "COFORGE", "MPHASIS", "FEDERALBNK", "IDFCFIRSTB", "ASHOKLEY", "AUROPHARMA", "LUPIN",
    "MAXHEALTH", "OBEROIRLTY", "PIIND", "SUPREMEIND", "TIINDIA", "ASTRAL", "BHARATFORG",
    "CUMMINSIND", "GODREJPROP", "INDUSTOWER", "MARICO", "MRF", "MUTHOOTFIN", "PETRONET",
    "PFC", "RECLTD", "SRF", "SUNDARMFIN", "TATAELXSI", "TORNTPOWER", "TUBEINVEST", "UPL", "VOLTAS"
]

SMALLCAP_UNIVERSE = [
    "ANGELONE", "CENTURYPLY", "CERA", "CESC", "CHAMBLFERT", "CYIENT", "DATAPATTNS",
    "ECLERX", "HFCL", "IEX", "IRCTC", "KARURVYSYA", "KPITTECH", "MANAPPURAM",
    "MAPMYINDIA", "METROPOLIS", "NATIONALUM", "NLCINDIA", "NMDC", "RBLBANK",
    "SONACOMS", "SUZLON", "TATAINVEST", "TRIDENT", "ZENSARTECH"
]

UNIVERSES_MAP = {
    "nifty_50": NIFTY_50_UNIVERSE,
    "nifty_200": LIQUID_FO_UNIVERSE,
    "liquid_fo": LIQUID_FO_UNIVERSE,
    "midcap": MIDCAP_UNIVERSE,
    "smallcap": SMALLCAP_UNIVERSE
}


def sanitize_json_val(v: Any) -> Any:
    if isinstance(v, float):
        if np.isnan(v):
            return 0.0
        if np.isinf(v):
            return 999.0 if v > 0 else -999.0
        return round(v, 2)
    if isinstance(v, dict):
        return {k: sanitize_json_val(val) for k, val in v.items()}
    if isinstance(v, list):
        return [sanitize_json_val(val) for val in v]
    return v


class VCPScannerService:
    def __init__(self, cache_file: str = "vcp_cache.json"):
        self.cache_file = os.path.join(os.path.dirname(__file__), "..", cache_file)
        self.is_scanning = False
        self.progress_pct = 0.0
        self.status_message = "Ready"
        self.candidates: List[Dict[str, Any]] = []
        self.metadata: Dict[str, Any] = {}
        self.lock = threading.Lock()
        self.load_cache()

    def load_cache(self):
        with self.lock:
            if os.path.exists(self.cache_file):
                try:
                    with open(self.cache_file, "r") as f:
                        data = json.load(f)
                        self.candidates = data.get("candidates", [])
                        self.metadata = data.get("metadata", {})
                        logger.info("Loaded %d VCP candidates from cache", len(self.candidates))
                except Exception as e:
                    logger.error("Error loading VCP cache: %s", e)
                    self.candidates = []
                    self.metadata = {}

    def save_cache(self):
        with self.lock:
            try:
                data = sanitize_json_val({
                    "metadata": self.metadata,
                    "candidates": self.candidates
                })
                with open(self.cache_file, "w") as f:
                    json.dump(data, f, indent=2)
                logger.info("Saved %d VCP candidates to cache", len(self.candidates))
            except Exception as e:
                logger.error("Error saving VCP cache: %s", e)

    def start_scan_async(
        self,
        universe: str = "nifty_200",
        tickers: Optional[List[str]] = None,
        rs_min_rating: float = 70.0,
        min_contractions: int = 2,
        contraction_tol: float = 0.90,
        pivot_strength: int = 5,
        breakout_vol_mult: float = 1.5,
        stop_buffer_pct: float = 1.0,
        r_multiple_target: float = 3.0,
        late_base_warn_at: int = 4,
        use_market_filter: bool = True,
        enable_code3: bool = False
    ) -> bool:
        with self.lock:
            if self.is_scanning:
                logger.warning("VCP Scan already in progress")
                return False
            self.is_scanning = True
            self.progress_pct = 0.0
            self.status_message = f"Initiating Minervini Growth Scanner for {universe.upper()}..."

        t = threading.Thread(
            target=self._run_scan_thread,
            args=(
                universe, tickers, rs_min_rating, min_contractions,
                contraction_tol, pivot_strength, breakout_vol_mult,
                stop_buffer_pct, r_multiple_target, late_base_warn_at,
                use_market_filter, enable_code3
            ),
            daemon=True
        )
        t.start()
        return True

    def _run_scan_thread(
        self,
        universe_name: str,
        tickers: Optional[List[str]],
        rs_min_rating: float,
        min_contractions: int,
        contraction_tol: float,
        pivot_strength: int,
        breakout_vol_mult: float,
        stop_buffer_pct: float,
        r_multiple_target: float,
        late_base_warn_at: int,
        use_market_filter: bool,
        enable_code3: bool
    ):
        if tickers and len(tickers) > 0:
            symbols = [t.strip().upper() for t in tickers if t.strip()]
        else:
            symbols = UNIVERSES_MAP.get(universe_name.lower(), LIQUID_FO_UNIVERSE)

        total = len(symbols)
        logger.info("Starting Minervini VCP Scan on %d symbols in %s", total, universe_name)

        cfg = ScannerConfig(
            rs_min_rating=rs_min_rating,
            min_contractions=min_contractions,
            contraction_tol=contraction_tol,
            pivot_strength=pivot_strength,
            breakout_vol_mult=breakout_vol_mult,
            stop_buffer_pct=stop_buffer_pct,
            r_multiple_target=r_multiple_target,
            late_base_warn_at=late_base_warn_at,
            use_market_filter=use_market_filter,
            enable_code3=enable_code3
        )

        scanner = MinerviniVCPScanner(cfg)
        with self.lock:
            self.status_message = "Fetching benchmark ^NSEI data..."

        if not scanner.load_benchmark():
            logger.error("Failed to load benchmark ^NSEI data. Aborting scan.")
            with self.lock:
                self.is_scanning = False
                self.status_message = "Scan failed: Could not load benchmark ^NSEI."
            return

        results = []
        signals_count = 0
        start_time = time.time()

        for idx, sym in enumerate(symbols):
            with self.lock:
                self.progress_pct = round(((idx + 1) / total) * 100, 1)
                self.status_message = f"Scanning {sym} ({idx + 1}/{total})..."

            try:
                res = scanner.scan_symbol(sym)
                if res.get("error"):
                    logger.debug("Symbol %s returned error: %s", sym, res["error"])
                    continue

                is_stage2 = bool(res.get("trend_template", False))
                is_vcp_valid = bool(res.get("vcp_valid", False))
                is_trigger_recent = bool(res.get("trigger_recent", False))
                is_breakout = bool(res.get("breakout", False))
                is_long_condition = bool(res.get("long_condition", False))

                # Include if any major setup criteria met
                if is_stage2 or is_vcp_valid or is_trigger_recent or is_breakout or is_long_condition:
                    if is_long_condition:
                        signals_count += 1

                    checklist = {
                        "c1_price_above_mas": bool(res.get("c1_price_above_mas", False)),
                        "c2_ma150_above_ma200": bool(res.get("c2_ma150_above_ma200", False)),
                        "c3_ma200_trending_up": bool(res.get("c3_ma200_trending_up", False)),
                        "c4_ma50_above": bool(res.get("c4_ma50_above", False)),
                        "c5_above_52w_low": bool(res.get("c5_above_52w_low", False)),
                        "c6_rs_rating": bool(res.get("c6_rs_rating", False)),
                        "trend_template": is_stage2,
                        "vcp_valid": is_vcp_valid,
                        "trigger_bar": bool(res.get("trigger_bar", False)),
                        "trigger_recent": is_trigger_recent,
                        "breakout": is_breakout,
                        "market_ok": bool(res.get("market_ok", False)),
                        "code3_ok": res.get("code3_ok"),
                    }

                    candidate_info = {
                        "symbol": res["symbol"],
                        "raw_symbol": res["raw_symbol"],
                        "as_of": res["as_of"],
                        "close": res["close"],
                        "sma50": res["sma50"],
                        "sma150": res["sma150"],
                        "sma200": res["sma200"],
                        "ema10": res["ema10"],
                        "stage2": is_stage2,
                        "trend_template": is_stage2,
                        "vcp_valid": is_vcp_valid,
                        "trigger_bar": bool(res.get("trigger_bar", False)),
                        "trigger_recent": is_trigger_recent,
                        "pivot_price": res.get("pivot_price"),
                        "breakout": is_breakout,
                        "entry_today": is_long_condition,
                        "long_condition": is_long_condition,
                        "market_ok": bool(res.get("market_ok", False)),
                        "base_counter": res.get("base_counter", 0),
                        "late_stage": bool(res.get("late_stage", False)),
                        "rs_percentile": res.get("rs_percentile", 0.0),
                        "stop_level": res.get("stop_level"),
                        "target_level": res.get("target_level"),
                        "code3_eps_accel": res.get("code3_eps_accel"),
                        "code3_sales_accel": res.get("code3_sales_accel"),
                        "code3_margin_accel": res.get("code3_margin_accel"),
                        "code3_ok": res.get("code3_ok"),
                        "checklist": checklist
                    }
                    results.append(candidate_info)

            except Exception as e:
                logger.warning("Error scanning symbol %s: %s", sym, e)

            time.sleep(cfg.request_pause_sec)

        # Sort results: ALL SYSTEMS GO (long_condition) first, then stage2 & vcp_valid, then vcp_valid, then rs_percentile
        results.sort(
            key=lambda x: (
                x["long_condition"],
                x["stage2"] and x["vcp_valid"],
                x["vcp_valid"],
                x["rs_percentile"]
            ),
            reverse=True
        )

        elapsed = round(time.time() - start_time, 1)
        with self.lock:
            self.candidates = results
            self.metadata = {
                "universe": universe_name,
                "total_scanned": total,
                "candidates_found": len(results),
                "all_systems_go_signals": signals_count,
                "scan_time_seconds": elapsed,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            self.is_scanning = False
            self.progress_pct = 100.0
            self.status_message = f"Completed ({len(results)} setups, {signals_count} ALL SYSTEMS GO signals in {elapsed}s)"

        self.save_cache()

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "is_scanning": self.is_scanning,
                "progress_pct": self.progress_pct,
                "status_message": self.status_message
            }

    def get_results(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "metadata": self.metadata,
                "candidates": self.candidates
            }

    def run_single_backtest(self, symbol: str, custom_cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            stock_df = load_ohlcv(symbol, period="3y")
            bench_df = load_ohlcv("^NSEI", period="3y")
            if stock_df is None or stock_df.empty:
                return {"error": f"Could not load data for symbol {symbol}"}

            cfg = BacktestStrategyConfig()
            if custom_cfg:
                if "initial_capital" in custom_cfg:
                    cfg.backtest.initial_capital = float(custom_cfg["initial_capital"])
                if "pct_per_trade" in custom_cfg:
                    cfg.backtest.pct_equity_per_trade = float(custom_cfg["pct_per_trade"])
                if "r_target" in custom_cfg:
                    cfg.risk.r_multiple_target = float(custom_cfg["r_target"])
                if "use_market_filter" in custom_cfg:
                    cfg.market.use_market_filter = bool(custom_cfg["use_market_filter"])

            strat = MinerviniVCPStrategy(stock_df, bench_df, cfg).run()

            tdf = strat.trades_dataframe()
            trades_list = []
            for _, row in tdf.iterrows():
                trades_list.append({
                    "entry_date": row["entry_date"].strftime("%Y-%m-%d") if pd.notnull(row["entry_date"]) else None,
                    "entry_price": round(float(row["entry_price"]), 2) if pd.notnull(row["entry_price"]) else None,
                    "shares": round(float(row["shares"]), 2) if pd.notnull(row["shares"]) else None,
                    "stop_level": round(float(row["stop_level"]), 2) if pd.notnull(row["stop_level"]) else None,
                    "target_level": round(float(row["target_level"]), 2) if pd.notnull(row["target_level"]) else None,
                    "exit_date": row["exit_date"].strftime("%Y-%m-%d") if pd.notnull(row["exit_date"]) else None,
                    "exit_price": round(float(row["exit_price"]), 2) if pd.notnull(row["exit_price"]) else None,
                    "exit_reason": str(row["exit_reason"]) if pd.notnull(row["exit_reason"]) else None,
                    "pnl": round(float(row["pnl"]), 2) if pd.notnull(row["pnl"]) else None,
                    "r_multiple": round(float(row["r_multiple"]), 2) if pd.notnull(row["r_multiple"]) else None,
                    "base_number_at_entry": int(row["base_number_at_entry"]) if pd.notnull(row["base_number_at_entry"]) else None
                })

            eq = strat.equity_curve.dropna()
            equity_curve_points = [
                {"date": idx.strftime("%Y-%m-%d"), "equity": round(float(val), 2)}
                for idx, val in eq.items()
            ]

            return sanitize_json_val({
                "symbol": symbol,
                "checklist": strat.latest_checklist(),
                "summary": strat.performance_summary(),
                "trades": trades_list,
                "equity_curve": equity_curve_points[-250:]
            })
        except Exception as e:
            logger.error("Single backtest error for %s: %s", symbol, e)
            return {"error": str(e)}

    def get_chart_data(self, symbol: str, period: str = "1y") -> Dict[str, Any]:
        try:
            stock_df = load_ohlcv(symbol, period=period)
            bench_df = load_ohlcv("^NSEI", period=period)
            if stock_df is None or stock_df.empty:
                return {"error": f"Could not load chart data for {symbol}"}

            cfg = BacktestStrategyConfig()
            strat = MinerviniVCPStrategy(stock_df, bench_df, cfg)
            strat._prepare_indicators()
            strat._run_stateful_signals()

            df = strat.df
            candles = []
            for idx, row in df.iterrows():
                candles.append({
                    "date": idx.strftime("%Y-%m-%d"),
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]),
                    "sma50": round(float(row["sma50"]), 2) if pd.notnull(row["sma50"]) else None,
                    "sma150": round(float(row["sma150"]), 2) if pd.notnull(row["sma150"]) else None,
                    "sma200": round(float(row["sma200"]), 2) if pd.notnull(row["sma200"]) else None,
                    "ema10": round(float(row["ema10"]), 2) if pd.notnull(row["ema10"]) else None,
                    "stage2": bool(row["trend_template"]) if "trend_template" in row else False,
                    "vcp_valid": bool(row["vcp_valid"]) if "vcp_valid" in row else False,
                    "trigger_bar": bool(row["trigger_bar"]) if "trigger_bar" in row else False,
                    "breakout": bool(row["breakout"]) if "breakout" in row else False,
                    "entry_signal": bool(row["long_condition_raw"]) if "long_condition_raw" in row else False
                })

            return sanitize_json_val({
                "symbol": symbol,
                "period": period,
                "candles": candles
            })
        except Exception as e:
            logger.error("Chart data error for %s: %s", symbol, e)
            return {"error": str(e)}

    def export_data(self, export_format: str = "json") -> str:
        with self.lock:
            candidates = list(self.candidates)
        if export_format.lower() == "csv":
            df = pd.DataFrame(candidates)
            if "checklist" in df.columns:
                df = df.drop(columns=["checklist"])
            buf = io.StringIO()
            df.to_csv(buf, index=False)
            return buf.getvalue()
        else:
            return json.dumps(candidates, indent=2, default=str)


vcp_scanner_service = VCPScannerService()
