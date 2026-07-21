import os
import io
import json
import time
import logging
import threading
import urllib.request
import concurrent.futures
from datetime import datetime
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np
import yfinance as yf

logger = logging.getLogger("scanner_service")

# ─────────────────────────────────────────────────────────────────────────
# Strategy Configurations & Indicators
# ─────────────────────────────────────────────────────────────────────────

class StrategyConfig:
    def __init__(
        self,
        rsi_len: int = 14,
        use_vwap_adjusted_rsi: bool = True,
        vwap_smoothing: int = 20,
        vwap_anchor: str = "year",
        ma_len: int = 50,
        vol_ma_len: int = 20,
        min_vol_multiplier: float = 1.5,
        atr_len: int = 14
    ):
        self.rsi_len = rsi_len
        self.use_vwap_adjusted_rsi = use_vwap_adjusted_rsi
        self.vwap_smoothing = vwap_smoothing
        self.vwap_anchor = vwap_anchor
        self.ma_len = ma_len
        self.vol_ma_len = vol_ma_len
        self.min_vol_multiplier = min_vol_multiplier
        self.atr_len = atr_len


def wilder_rsi(series: pd.Series, length: int) -> pd.Series:
    """RSI using Wilder's smoothing (matches Pine's ta.rsi)."""
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / length, min_periods=length, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / length, min_periods=length, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.where(~((avg_loss == 0) & (avg_gain == 0)), 50.0)
    rsi = rsi.where(~((avg_loss == 0) & (avg_gain > 0)), 100.0)
    return rsi


def wilder_atr(df: pd.DataFrame, length: int) -> pd.Series:
    """Wilder's Average True Range."""
    high, low, close = df["High"], df["Low"], df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat([
        (high - low),
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1.0 / length, min_periods=length, adjust=False).mean()


def anchored_vwap(df: pd.DataFrame, anchor: str) -> pd.Series:
    """Calendar-anchored VWAP calculation."""
    hlc3 = (df["High"] + df["Low"] + df["Close"]) / 3.0
    pv = hlc3 * df["Volume"]

    if anchor == "year":
        grp = df.index.year
    elif anchor == "month":
        grp = df.index.to_period("M")
    elif anchor == "week":
        grp = df.index.to_period("W")
    else:
        grp = df.index.year

    cum_pv = pv.groupby(grp).cumsum()
    cum_vol = df["Volume"].groupby(grp).cumsum().replace(0, np.nan)
    return cum_pv / cum_vol


def compute_indicators(df: pd.DataFrame, cfg: StrategyConfig) -> pd.DataFrame:
    """Applies Cardwell RSI Indicator Calculations."""
    out = df.copy()

    if cfg.use_vwap_adjusted_rsi:
        vwap_val = anchored_vwap(out, cfg.vwap_anchor)
        raw_adj = out["Close"] * (out["Close"] / vwap_val.replace(0, np.nan))
        raw_adj = raw_adj.fillna(out["Close"])
        adj_src = raw_adj.rolling(cfg.vwap_smoothing).mean()
    else:
        adj_src = out["Close"]

    out["rsi"] = wilder_rsi(adj_src, cfg.rsi_len)
    out["ma"] = out["Close"].rolling(cfg.ma_len).mean()
    out["vol_ma"] = out["Volume"].rolling(cfg.vol_ma_len).mean()
    out["high_vol"] = out["Volume"] > out["vol_ma"] * cfg.min_vol_multiplier
    out["atr"] = wilder_atr(out, cfg.atr_len)

    out["bull_cross"] = (out["rsi"] > 40) & (out["rsi"].shift(1) <= 40)
    out["long_condition"] = out["bull_cross"] & (out["Close"] > out["ma"]) & out["high_vol"]
    return out

# ─────────────────────────────────────────────────────────────────────────
# Global Scanner State and Engine
# ─────────────────────────────────────────────────────────────────────────

class ScannerState:
    def __init__(self):
        self.lock = threading.Lock()
        self.status = "idle"  # "idle" | "running" | "completed" | "failed"
        self.progress = 0
        self.total = 0
        self.current_symbol = ""
        self.results = []
        self.error = None
        self.timestamp = None
        self.universe = ""

    def update(self, **kwargs):
        with self.lock:
            for k, v in kwargs.items():
                setattr(self, k, v)

    def get_status(self):
        with self.lock:
            return {
                "status": self.status,
                "progress": self.progress,
                "total": self.total,
                "current_symbol": self.current_symbol,
                "error": self.error,
                "timestamp": self.timestamp,
                "universe": self.universe
            }

    def get_results(self):
        with self.lock:
            return self.results


# Global scanner state instance
global_state = ScannerState()

CACHE_FILE_FO = "backend/scanner_cache_fo.json"
CACHE_FILE_N500 = "backend/scanner_cache_n500.json"
CACHE_TIMEOUT_SECONDS = 7200  # 2 Hours


def load_cache(universe: str, cfg: StrategyConfig) -> Optional[List[Dict[str, Any]]]:
    """Loads scan results from cache if valid and parameters match."""
    cache_path = CACHE_FILE_FO if universe == "nifty_fo" else CACHE_FILE_N500
    if not os.path.exists(cache_path):
        return None

    try:
        with open(cache_path, "r") as f:
            cache_data = json.load(f)

        # Verify timestamp
        cached_time = cache_data.get("timestamp", 0)
        if time.time() - cached_time > CACHE_TIMEOUT_SECONDS:
            return None

        # Verify strategy parameters match to prevent stale indicator filters
        cached_cfg = cache_data.get("config", {})
        if (
            cached_cfg.get("rsi_len") == cfg.rsi_len and
            cached_cfg.get("use_vwap_adjusted_rsi") == cfg.use_vwap_adjusted_rsi and
            cached_cfg.get("vwap_smoothing") == cfg.vwap_smoothing and
            cached_cfg.get("vwap_anchor") == cfg.vwap_anchor and
            cached_cfg.get("ma_len") == cfg.ma_len and
            cached_cfg.get("vol_ma_len") == cfg.vol_ma_len and
            cached_cfg.get("min_vol_multiplier") == cfg.min_vol_multiplier and
            cached_cfg.get("atr_len") == cfg.atr_len
        ):
            logger.info(f"Loaded valid scan cache for {universe}")
            return cache_data.get("results", [])
    except Exception as e:
        logger.error(f"Error reading scanner cache: {e}")

    return None


def save_cache(universe: str, cfg: StrategyConfig, results: List[Dict[str, Any]]):
    """Saves scan results and parameters to cache."""
    cache_path = CACHE_FILE_FO if universe == "nifty_fo" else CACHE_FILE_N500
    try:
        cache_data = {
            "timestamp": time.time(),
            "config": {
                "rsi_len": cfg.rsi_len,
                "use_vwap_adjusted_rsi": cfg.use_vwap_adjusted_rsi,
                "vwap_smoothing": cfg.vwap_smoothing,
                "vwap_anchor": cfg.vwap_anchor,
                "ma_len": cfg.ma_len,
                "vol_ma_len": cfg.vol_ma_len,
                "min_vol_multiplier": cfg.min_vol_multiplier,
                "atr_len": cfg.atr_len
            },
            "results": results
        }
        with open(cache_path, "w") as f:
            json.dump(cache_data, f, indent=2)
        logger.info(f"Saved scanner cache for {universe} containing {len(results)} items.")
    except Exception as e:
        logger.error(f"Error writing scanner cache: {e}")


def fetch_nifty500_universe() -> List[Dict[str, str]]:
    """Downloads Nifty 500 symbols from NSE or falls back to local constituents."""
    url = "https://archives.nseindia.com/content/indices/ind_nifty500list.csv"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        logger.info("Fetching Nifty 500 constituents from NSE...")
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(content))
        
        # Clean and parse columns
        df.columns = [c.strip() for c in df.columns]
        results = []
        for _, row in df.iterrows():
            sym = str(row["Symbol"]).strip()
            if sym and not sym.startswith("Symbol"):
                results.append({
                    "symbol": sym,
                    "name": str(row["Company Name"]).strip(),
                    "industry": str(row["Industry"]).strip()
                })
        return results
    except Exception as e:
        logger.error(f"Failed to fetch Nifty 500 dynamically: {e}. Falling back to F&O list as subset.")
        # Fallback to loading F&O list as a backup subset
        return fetch_nifty_fo_universe()


def fetch_nifty_fo_universe() -> List[Dict[str, str]]:
    """Loads F&O list from kite_lot_sizes.json or lot_sizes.json."""
    paths = ["kite_lot_sizes.json", "lot_sizes.json"]
    lot_data = {}
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r") as f:
                    lot_data = json.load(f)
                break
            except Exception as e:
                logger.error(f"Error loading {p}: {e}")

    # Exclude indices
    exclude_keys = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "NIFTYNXT50"]
    symbols = [k for k in lot_data.keys() if k not in exclude_keys]
    
    # Sort them and return
    return [{
        "symbol": sym,
        "name": f"{sym} F&O Stock",
        "industry": "Derivative Segment"
    } for sym in sorted(symbols)]


def run_parallel_scan(universe: str, cfg: StrategyConfig):
    """Executes the scan in a background thread."""
    try:
        global_state.update(
            status="running",
            progress=0,
            total=0,
            current_symbol="Loading Universe...",
            error=None,
            universe=universe
        )

        # 1. Fetch Tickers list
        if universe == "nifty_fo":
            stocks = fetch_nifty_fo_universe()
        else:
            stocks = fetch_nifty500_universe()

        total_count = len(stocks)
        if total_count == 0:
            raise ValueError("No stocks found in the chosen universe.")

        global_state.update(total=total_count, progress=0)
        logger.info(f"Loaded {total_count} stocks to scan for Cardwell RSI strategy.")

        scanned_results = []
        progress_counter = 0

        # Helper to process a single symbol
        def process_stock(stock):
            nonlocal progress_counter
            sym = stock["symbol"]
            ticker = f"{sym}.NS"
            
            # Update current status
            global_state.update(current_symbol=sym)
            
            try:
                # Need ~260 daily bars to compute 50 MA and calendar-anchored VWAP
                df = yf.download(ticker, period="1y", auto_adjust=True, progress=False)
                if df.empty or len(df) < 100:
                    return None

                # Clean headers
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                
                df.index = pd.to_datetime(df.index)
                processed = compute_indicators(df, cfg)

                if len(processed) < 5:
                    return None

                last_row = processed.iloc[-1]
                prev_row = processed.iloc[-2]

                # Determine Signal
                signal = "NEUTRAL"
                if bool(last_row["long_condition"]):
                    signal = "BUY"
                else:
                    # Check for SETUP: bull_cross occurred in last 5 bars and RSI remains > 40
                    recent_bull_cross = processed.iloc[-5:]["bull_cross"].any()
                    if recent_bull_cross and last_row["rsi"] > 40:
                        signal = "SETUP"

                # Calculate daily change percent
                prev_close = float(prev_row["Close"])
                curr_close = float(last_row["Close"])
                change_pct = ((curr_close - prev_close) / prev_close) * 100 if prev_close > 0 else 0.0

                # Compute volume multiplier
                vol_ma = float(last_row["vol_ma"])
                vol_mult = float(last_row["Volume"] / vol_ma) if vol_ma > 0 else 0.0

                return {
                    "symbol": sym,
                    "name": stock["name"],
                    "industry": stock["industry"],
                    "close": round(curr_close, 2),
                    "change_pct": round(change_pct, 2),
                    "rsi": round(float(last_row["rsi"]), 2),
                    "vol_mult": round(vol_mult, 2),
                    "signal": signal,
                    "above_ma": bool(last_row["Close"] > last_row["ma"])
                }
            except Exception as ex:
                logger.error(f"Error scanning {sym}: {ex}")
                return None
            finally:
                progress_counter += 1
                global_state.update(progress=progress_counter)

        # Execute parallel yfinance fetches
        # We cap workers at 15 to avoid rate-limiting issues
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            future_results = executor.map(process_stock, stocks)
            for res in future_results:
                if res is not None:
                    scanned_results.append(res)

        # Sort results: BUY first, then SETUP, then alphabetical by symbol
        def sort_key(item):
            sig_priority = {"BUY": 0, "SETUP": 1, "NEUTRAL": 2}
            return (sig_priority.get(item["signal"], 2), item["symbol"])

        scanned_results = sorted(scanned_results, key=sort_key)

        # Update cache
        save_cache(universe, cfg, scanned_results)

        # Complete status update
        global_state.update(
            status="completed",
            progress=total_count,
            results=scanned_results,
            timestamp=time.time()
        )
        logger.info(f"Scan completed successfully for universe: {universe}")

    except Exception as e:
        logger.error(f"Scanner thread encountered error: {e}", exc_info=True)
        global_state.update(
            status="failed",
            error=str(e)
        )


def start_scanner(universe: str, cfg: StrategyConfig) -> Dict[str, Any]:
    """Starts the scanner. Returns immediately after queuing the task."""
    status_info = global_state.get_status()

    # Prevent concurrent scans
    if status_info["status"] == "running":
        return {"status": "running", "message": "A scan is already in progress."}

    # Try loading cache first
    cached_results = load_cache(universe, cfg)
    if cached_results is not None:
        global_state.update(
            status="completed",
            progress=100,
            total=100,
            results=cached_results,
            timestamp=time.time(),
            universe=universe
        )
        return {"status": "completed", "message": "Loaded from cache.", "from_cache": True}

    # Start background thread
    scan_thread = threading.Thread(
        target=run_parallel_scan,
        args=(universe, cfg),
        name="CardwellScannerThread"
    )
    scan_thread.daemon = True
    scan_thread.start()

    return {"status": "running", "message": "Scan started in background."}
