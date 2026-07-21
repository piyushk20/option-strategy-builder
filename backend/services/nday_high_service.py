"""
nday_high_service.py
====================
ChartInk-style N-Day High (Multi-Year Breakout) Scanner backend service.

Flags stocks where today's daily HIGH equals the rolling maximum high over
any of the configured lookback windows (520 to 2600 trading days = ~2yr to ~10yr).

Design notes
------------
- Uses *batched* yf.download() — one HTTP call per batch of ~20 tickers — to
  avoid Yahoo Finance rate-limiting and cut HTTP overhead vs per-symbol calls.
- Separate NdayHighScannerState singleton so it never interferes with the
  Cardwell RSI ScannerState.
- Universe loading is delegated to scanner_service.py to avoid duplication.
- Results are cached locally for 2 hours (same policy as Cardwell scanner).
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf

# Reuse universe loaders from the existing Cardwell RSI scanner service
from services.scanner_service import fetch_nifty_fo_universe, fetch_nifty500_universe

logger = logging.getLogger("nday_high_service")

# ---------------------------------------------------------------------------
# Constants & Configuration
# ---------------------------------------------------------------------------

# Lookback windows in trading days (260 td/yr x 2yr ... 10yr, 1-yr steps)
DEFAULT_LOOKBACKS: List[int] = [520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600]
TRADING_DAYS_PER_YEAR: int = 260

# Need MAX_LOOKBACK + a safety buffer to ensure rolling windows are full
_MAX_LOOKBACK: int = max(DEFAULT_LOOKBACKS)
_DOWNLOAD_YEARS: int = int(_MAX_LOOKBACK / TRADING_DAYS_PER_YEAR) + 2  # ~12 years

BATCH_SIZE: int = 20          # tickers per single yf.download() call
MAX_WORKERS: int = 6          # parallel batch threads
MAX_RETRIES: int = 3          # download retry attempts
BACKOFF_BASE: float = 2.0     # seconds

CACHE_FILE_FO: str = "backend/nday_cache_fo.json"
CACHE_FILE_N500: str = "backend/nday_cache_n500.json"
CACHE_TIMEOUT_SECONDS: int = 7200   # 2 hours


# ---------------------------------------------------------------------------
# Thread-Safe State Machine
# ---------------------------------------------------------------------------

class NdayHighScannerState:
    """Thread-safe state container for the N-Day High background scanner."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.status: str = "idle"   # idle | running | completed | failed
        self.progress: int = 0       # batches completed
        self.total: int = 0          # total batches
        self.current_batch: str = ""
        self.results: List[Dict[str, Any]] = []
        self.error: Optional[str] = None
        self.timestamp: Optional[float] = None
        self.universe: str = ""
        self.lookbacks: List[int] = list(DEFAULT_LOOKBACKS)

    def update(self, **kwargs) -> None:
        with self._lock:
            for k, v in kwargs.items():
                setattr(self, k, v)

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": self.status,
                "progress": self.progress,
                "total": self.total,
                "current_batch": self.current_batch,
                "error": self.error,
                "timestamp": self.timestamp,
                "universe": self.universe,
                "lookbacks": list(self.lookbacks),
            }

    def get_results(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.results)


# Module-level singleton
nday_state = NdayHighScannerState()


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_path(universe: str) -> str:
    return CACHE_FILE_FO if universe == "nifty_fo" else CACHE_FILE_N500


def load_cache(universe: str, lookbacks: List[int]) -> Optional[List[Dict[str, Any]]]:
    """Returns cached results if fresh and same lookback config, else None."""
    path = _cache_path(universe)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as fh:
            data = json.load(fh)
        if time.time() - data.get("timestamp", 0) > CACHE_TIMEOUT_SECONDS:
            return None
        if sorted(data.get("lookbacks", [])) != sorted(lookbacks):
            return None
        logger.info(f"[nday] Cache hit for universe={universe}")
        return data.get("results", [])
    except Exception as exc:
        logger.warning(f"[nday] Cache read error: {exc}")
        return None


def save_cache(universe: str, lookbacks: List[int], results: List[Dict[str, Any]]) -> None:
    path = _cache_path(universe)
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as fh:
            json.dump({
                "timestamp": time.time(),
                "lookbacks": lookbacks,
                "results": results,
            }, fh, indent=2)
        logger.info(f"[nday] Cache saved: {len(results)} results -> {path}")
    except Exception as exc:
        logger.warning(f"[nday] Cache write error: {exc}")


# ---------------------------------------------------------------------------
# Core Detection Logic (pure, no I/O)
# ---------------------------------------------------------------------------

def detect_new_high(
    df: pd.DataFrame,
    lookbacks: List[int],
) -> Optional[Dict[str, Any]]:
    """
    Given a single-symbol OHLC DataFrame (ascending date index, 'High' column),
    check whether the last row's High equals the rolling-max High for any
    lookback window.

    Returns a match dict or None if no window matched / insufficient history.
    """
    df = df.dropna(subset=["High"])
    if df.empty or len(df) < min(lookbacks):
        return None

    today_high: float = float(df["High"].iloc[-1])

    matched: List[int] = []
    for n in lookbacks:
        if len(df) < n:
            continue
        window_max: float = float(df["High"].iloc[-n:].max())
        # Floating-point safe equality: today's high IS the window maximum
        if today_high >= window_max - 1e-9:
            matched.append(n)

    if not matched:
        return None

    max_hit = max(matched)
    return {
        "matched_lookbacks": matched,
        "max_lookback_hit": max_hit,
        "years_equivalent": round(max_hit / TRADING_DAYS_PER_YEAR, 1),
        "high": round(today_high, 2),
    }


# ---------------------------------------------------------------------------
# yfinance helpers
# ---------------------------------------------------------------------------

def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize MultiIndex columns returned by yfinance >= 0.2 to flat."""
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def download_batch(
    symbols: List[str],
    retries: int = MAX_RETRIES,
    backoff: float = BACKOFF_BASE,
) -> Dict[str, pd.DataFrame]:
    """
    Download OHLCV history for a batch of .NS-suffixed symbols in a single
    yf.download() call. Returns a dict {symbol: DataFrame}.
    """
    for attempt in range(1, retries + 1):
        try:
            raw = yf.download(
                symbols,
                period=f"{_DOWNLOAD_YEARS}y",
                interval="1d",
                auto_adjust=True,
                progress=False,
                threads=True,
                group_by="ticker",
            )
            break
        except Exception as exc:
            logger.warning(f"[nday] Batch download attempt {attempt}/{retries} failed: {exc}")
            if attempt == retries:
                return {}
            time.sleep(backoff * attempt)

    if raw is None or (hasattr(raw, "empty") and raw.empty):
        return {}

    out: Dict[str, pd.DataFrame] = {}

    if isinstance(raw.columns, pd.MultiIndex):
        for sym in symbols:
            try:
                sub = raw[sym].copy() if len(symbols) > 1 else raw.copy()
                sub = _flatten_columns(sub)
                if not sub.empty:
                    out[sym] = sub
            except KeyError:
                continue
    else:
        # Single-symbol batch -> flat columns
        out[symbols[0]] = _flatten_columns(raw.copy())

    return out


# ---------------------------------------------------------------------------
# Batch Scanner
# ---------------------------------------------------------------------------

def scan_batch(
    symbols: List[str],
    stock_meta: Dict[str, Dict[str, str]],
    fo_set: set,
    lookbacks: List[int],
) -> List[Dict[str, Any]]:
    """
    Download and scan one batch of symbols. Returns a list of match dicts.
    `stock_meta[sym]` = {"name": ..., "industry": ...}
    `fo_set` = set of F&O-eligible symbols (for tagging results).
    """
    results: List[Dict[str, Any]] = []
    batch_label = f"{symbols[0]}-{symbols[-1]}" if len(symbols) > 1 else symbols[0]
    nday_state.update(current_batch=batch_label)

    # Build .NS-suffixed list for Yahoo Finance
    ns_symbols = [f"{s}.NS" for s in symbols]
    # map back: "SYM.NS" -> "SYM"
    ns_to_sym = {f"{s}.NS": s for s in symbols}

    data = download_batch(ns_symbols)

    for ns_sym, df in data.items():
        sym = ns_to_sym.get(ns_sym, ns_sym.replace(".NS", ""))

        if df is None or df.empty:
            continue

        # Drop rows where Close or High is NaN for this symbol
        df = df.dropna(subset=["Close", "High"])
        if df.empty or len(df) < 2:
            continue

        df.index = pd.to_datetime(df.index)
        df = df.sort_index()

        match = detect_new_high(df, lookbacks)
        if match is None:
            continue

        # Price data from most recent row
        last = df.iloc[-1]
        prev = df.iloc[-2]
        curr_close = float(last["Close"])
        prev_close = float(prev["Close"])
        change_pct = ((curr_close - prev_close) / prev_close * 100) if prev_close > 0 else 0.0

        # Protect against JSON-unfriendly NaN/Inf values
        if (
            np.isnan(curr_close) or np.isinf(curr_close) or
            np.isnan(change_pct) or np.isinf(change_pct) or
            np.isnan(match["high"]) or np.isinf(match["high"])
        ):
            continue

        meta = stock_meta.get(sym, {"name": sym, "industry": "-"})

        results.append({
            "symbol": sym,
            "name": meta["name"],
            "industry": meta["industry"],
            "close": round(curr_close, 2),
            "high": match["high"],
            "change_pct": round(change_pct, 2),
            "matched_lookbacks": match["matched_lookbacks"],
            "max_lookback_hit": match["max_lookback_hit"],
            "years_equivalent": match["years_equivalent"],
            "is_fo": sym in fo_set,
        })
        logger.info(
            f"[nday] MATCH {sym:<15} -> {match['years_equivalent']}yr high "
            f"(windows: {match['matched_lookbacks']})"
        )

    return results


# ---------------------------------------------------------------------------
# Background Scanner Thread
# ---------------------------------------------------------------------------

def _batched(items: List[str], size: int):
    for i in range(0, len(items), size):
        yield items[i: i + size]


def run_nday_scan(universe: str, lookbacks: List[int]) -> None:
    """Background thread: fetches universe, scans in batches, updates state."""
    try:
        nday_state.update(
            status="running",
            progress=0,
            total=0,
            current_batch="Loading universe...",
            error=None,
            universe=universe,
            lookbacks=lookbacks,
        )

        # 1. Build universe lists
        if universe == "nifty_fo":
            stocks = fetch_nifty_fo_universe()
        else:
            stocks = fetch_nifty500_universe()

        if not stocks:
            raise ValueError(f"No stocks found for universe '{universe}'.")

        # Always load F&O set for is_fo tagging
        fo_stocks = fetch_nifty_fo_universe()
        fo_set: set = {s["symbol"] for s in fo_stocks}

        # Build lookup tables
        stock_meta: Dict[str, Dict[str, str]] = {
            s["symbol"]: {"name": s["name"], "industry": s["industry"]}
            for s in stocks
        }
        symbols: List[str] = [s["symbol"] for s in stocks]

        # 2. Partition into batches
        batches = list(_batched(symbols, BATCH_SIZE))
        nday_state.update(total=len(batches))
        logger.info(
            f"[nday] Scanning {len(symbols)} symbols in {len(batches)} batches "
            f"(lookbacks: {lookbacks})"
        )

        all_results: List[Dict[str, Any]] = []
        completed_batches: int = 0

        # 3. Parallel batch execution
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(scan_batch, batch, stock_meta, fo_set, lookbacks): batch
                for batch in batches
            }
            for future in as_completed(futures):
                try:
                    batch_results = future.result()
                    all_results.extend(batch_results)
                except Exception as exc:
                    logger.error(f"[nday] Batch error: {exc}")
                finally:
                    completed_batches += 1
                    nday_state.update(progress=completed_batches)

        # 4. Sort: longest breakout first, then by symbol
        all_results.sort(key=lambda r: (-r["max_lookback_hit"], r["symbol"]))

        # 5. Cache & finalise
        save_cache(universe, lookbacks, all_results)
        nday_state.update(
            status="completed",
            results=all_results,
            timestamp=time.time(),
            current_batch="",
        )
        logger.info(
            f"[nday] Scan complete: {len(all_results)} matches "
            f"from {len(symbols)} symbols."
        )

    except Exception as exc:
        logger.error(f"[nday] Scanner thread error: {exc}", exc_info=True)
        nday_state.update(status="failed", error=str(exc))


# ---------------------------------------------------------------------------
# Public API Entry Point
# ---------------------------------------------------------------------------

def start_nday_scanner(
    universe: str = "nifty_fo",
    lookbacks: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Start the N-Day High scanner. Returns immediately.
    - Returns cached results if fresh and lookbacks match.
    - Returns 'running' immediately if a scan is already in progress.
    """
    if lookbacks is None:
        lookbacks = list(DEFAULT_LOOKBACKS)

    status_info = nday_state.get_status()
    if status_info["status"] == "running":
        return {"status": "running", "message": "Scan already in progress."}

    # Try cache
    cached = load_cache(universe, lookbacks)
    if cached is not None:
        nday_state.update(
            status="completed",
            progress=100,
            total=100,
            results=cached,
            timestamp=time.time(),
            universe=universe,
            lookbacks=lookbacks,
        )
        return {"status": "completed", "message": "Loaded from cache.", "from_cache": True}

    # Spawn background thread
    thread = threading.Thread(
        target=run_nday_scan,
        args=(universe, lookbacks),
        name="NdayHighScannerThread",
        daemon=True,
    )
    thread.start()
    return {"status": "running", "message": "Scan started in background."}
