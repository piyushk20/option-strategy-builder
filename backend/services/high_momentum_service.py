import os
import sys
import time
import json
import logging
import threading
import warnings
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np
import yfinance as yf

warnings.filterwarnings("ignore")

logger = logging.getLogger("high_momentum_service")

# Default liquid F&O + Nifty starter universe
DEFAULT_UNIVERSE = [
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "BAJFINANCE",
    "BAJAJ-AUTO", "HINDUNILVR", "ITC", "LT", "AXISBANK", "KOTAKBANK",
    "MARUTI", "TITAN", "SUNPHARMA", "ULTRACEMCO", "NTPC", "POWERGRID",
    "M&M", "TATAMOTORS", "TATASTEEL", "ADANIENT", "ADANIPORTS", "ASIANPAINT",
    "BHARTIARTL", "WIPRO", "HCLTECH", "TECHM", "DIVISLAB", "CIPLA",
    "DRREDDY", "EICHERMOT", "GRASIM", "HEROMOTOCO", "JSWSTEEL", "COALINDIA",
    "BPCL", "ONGC", "NESTLEIND", "BRITANNIA", "SBILIFE", "HDFCLIFE",
    "INDUSINDBK", "APOLLOHOSP", "DABUR", "GODREJCP", "PIDILITIND",
    "SIEMENS", "HAVELLS", "DIXON", "BSE", "CDSL", "MCX", "HAL", "BEL",
    "POLYCAB", "PERSISTENT", "TRENT", "ZOMATO", "JIOFIN", "VEDL"
]

NIFTY_BENCHMARK = "^NSEI"

@dataclass
class ScanConfig:
    direction: str = "long"  # "long" or "short"
    ema_fast: int = 20
    ema_mid: int = 50
    ema_slow: int = 200
    adx_period: int = 14
    adx_min: float = 20.0
    crs_ema: int = 100
    market_cap_floor_cr: float = 20000.0
    require_green_candle: bool = True
    lookback_days: int = 400
    large_cap_cr: float = 100000.0


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def true_range(df: pd.DataFrame) -> pd.Series:
    high, low, close = df["High"], df["Low"], df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr


def compute_adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low = df["High"], df["Low"]
    up_move = high.diff()
    down_move = -low.diff()

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    tr = true_range(df)
    atr = tr.ewm(alpha=1 / period, adjust=False).mean()

    plus_di = 100 * pd.Series(plus_dm, index=df.index).ewm(alpha=1 / period, adjust=False).mean() / atr
    minus_di = 100 * pd.Series(minus_dm, index=df.index).ewm(alpha=1 / period, adjust=False).mean() / atr

    dx = (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan) * 100
    adx = dx.ewm(alpha=1 / period, adjust=False).mean()
    return adx


def compute_crs(stock_close: pd.Series, bench_close: pd.Series, ema_period: int = 100) -> pd.DataFrame:
    aligned = pd.concat([stock_close, bench_close], axis=1, join="inner")
    aligned.columns = ["stock", "bench"]
    ratio = aligned["stock"] / aligned["bench"]
    ratio_ema = ema(ratio, ema_period)
    return pd.DataFrame({"crs_ratio": ratio, "crs_ema": ratio_ema})


class HighMomentumScannerService:
    def __init__(self, cache_file: str = "high_momentum_cache.json"):
        self.cache_file = os.path.join(os.path.dirname(__file__), "..", cache_file)
        self.is_scanning = False
        self.progress_pct = 0.0
        self.status_message = "Ready"
        self.candidates: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.load_cache()

    def load_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    data = json.load(f)
                    self.candidates = data.get("candidates", [])
                    logger.info(f"Loaded {len(self.candidates)} high momentum candidates from cache.")
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")

    def save_cache(self):
        try:
            with open(self.cache_file, "w") as f:
                json.dump({
                    "timestamp": time.ctime(),
                    "candidates": self.candidates
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def fetch_history(self, ticker: str, lookback_days: int) -> Optional[pd.DataFrame]:
        yf_symbol = ticker if ticker.startswith("^") else f"{ticker}.NS"
        try:
            df = yf.Ticker(yf_symbol).history(period=f"{lookback_days}d", interval="1d", auto_adjust=False)
            if df is None or df.empty or len(df) < 210:
                return None
            return df
        except Exception:
            return None

    def fetch_market_cap_cr(self, ticker: str) -> Optional[float]:
        yf_symbol = f"{ticker}.NS"
        try:
            info = yf.Ticker(yf_symbol).fast_info
            mcap = getattr(info, "market_cap", None)
            if mcap is None:
                return None
            return round(mcap / 1e7, 1)
        except Exception:
            return None

    def evaluate_symbol(self, symbol: str, bench_close: pd.Series, cfg: ScanConfig) -> Optional[Dict[str, Any]]:
        df = self.fetch_history(symbol, cfg.lookback_days)
        if df is None:
            return None

        df["EMA_FAST"] = ema(df["Close"], cfg.ema_fast)
        df["EMA_MID"] = ema(df["Close"], cfg.ema_mid)
        df["EMA_SLOW"] = ema(df["Close"], cfg.ema_slow)
        df["ADX"] = compute_adx(df, cfg.adx_period)

        crs_df = compute_crs(df["Close"], bench_close, cfg.crs_ema)
        df = df.join(crs_df, how="left")

        last = df.iloc[-1]
        close = float(last["Close"])
        open_ = float(last["Open"])
        ema_fast, ema_mid, ema_slow = float(last["EMA_FAST"]), float(last["EMA_MID"]), float(last["EMA_SLOW"])
        adx_val = float(last["ADX"]) if not pd.isna(last["ADX"]) else 0.0
        crs_ratio = float(last["crs_ratio"]) if not pd.isna(last["crs_ratio"]) else np.nan
        crs_ema_val = float(last["crs_ema"]) if not pd.isna(last["crs_ema"]) else np.nan

        if any(pd.isna(x) for x in [ema_fast, ema_mid, ema_slow, crs_ratio, crs_ema_val]):
            return None

        green_candle = close > open_

        if cfg.direction == "long":
            ema_aligned = (ema_fast > ema_mid > ema_slow) and (close > ema_fast)
            adx_ok = adx_val >= cfg.adx_min
            crs_ok = crs_ratio > crs_ema_val
            candle_ok = green_candle if cfg.require_green_candle else True
        else:  # short
            ema_aligned = (ema_fast < ema_mid < ema_slow) and (close < ema_fast)
            adx_ok = adx_val >= cfg.adx_min
            crs_ok = crs_ratio < crs_ema_val
            candle_ok = (not green_candle) if cfg.require_green_candle else True

        if not (ema_aligned and adx_ok and crs_ok and candle_ok):
            return None

        mcap = self.fetch_market_cap_cr(symbol)
        if mcap is not None and mcap < cfg.market_cap_floor_cr:
            return None

        # Target sizing: mega cap ~6%, high beta ~10%
        if mcap is not None and mcap >= cfg.large_cap_cr:
            target_pct = 6.0
        else:
            target_pct = 10.0

        if cfg.direction == "long":
            entry = close
            target_price = round(entry * (1 + target_pct / 100), 2)
            stop_price = round(min(ema_mid, entry * 0.96), 2)
            trail_rule = "Trail remaining 40% position until 20 EMA crosses BELOW 50 EMA"
        else:
            entry = close
            target_price = round(entry * (1 - target_pct / 100), 2)
            stop_price = round(max(ema_mid, entry * 1.04), 2)
            trail_rule = "Trail remaining 40% position until 20 EMA crosses ABOVE 50 EMA"

        crs_strength = abs(crs_ratio - crs_ema_val) / crs_ema_val * 100
        score = round((adx_val - cfg.adx_min) + crs_strength * 10, 2)

        return {
            "symbol": symbol,
            "close": round(close, 2),
            "ema20": round(ema_fast, 2),
            "ema50": round(ema_mid, 2),
            "ema200": round(ema_slow, 2),
            "adx": round(adx_val, 1),
            "crs_ratio": round(crs_ratio, 5),
            "crs_ema": round(crs_ema_val, 5),
            "crs_outperforming": crs_ratio > crs_ema_val,
            "market_cap_cr": mcap,
            "green_candle": green_candle,
            "target_pct": target_pct,
            "entry": round(entry, 2),
            "target_price": target_price,
            "stop_price": stop_price,
            "trail_rule": trail_rule,
            "score": score,
            "direction": cfg.direction
        }

    def start_scan_async(self, universe: Optional[List[str]] = None, direction: str = "long", adx_min: float = 20.0, mcap_floor: float = 20000.0):
        with self.lock:
            if self.is_scanning:
                return False
            self.is_scanning = True
            self.progress_pct = 0.0
            self.status_message = "Initializing benchmark and universe..."

        thread = threading.Thread(
            target=self._run_scan_job,
            args=(universe or DEFAULT_UNIVERSE, direction, adx_min, mcap_floor),
            daemon=True
        )
        thread.start()
        return True

    def _run_scan_job(self, universe: List[str], direction: str, adx_min: float, mcap_floor: float):
        cfg = ScanConfig(direction=direction, adx_min=adx_min, market_cap_floor_cr=mcap_floor)
        try:
            bench_df = self.fetch_history(NIFTY_BENCHMARK, cfg.lookback_days)
            if bench_df is None:
                with self.lock:
                    self.is_scanning = False
                    self.status_message = "Error: Failed to fetch Nifty 50 benchmark data."
                return

            bench_close = bench_df["Close"]
            results = []
            total = len(universe)

            for i, symbol in enumerate(universe, 1):
                with self.lock:
                    self.progress_pct = round((i / total) * 100, 1)
                    self.status_message = f"Scanning {symbol} ({i}/{total})..."

                cand = self.evaluate_symbol(symbol, bench_close, cfg)
                if cand:
                    results.append(cand)
                time.sleep(0.02)

            results.sort(key=lambda x: x["score"], reverse=True)

            with self.lock:
                self.candidates = results
                self.is_scanning = False
                self.progress_pct = 100.0
                self.status_message = f"Scan complete! Found {len(results)} high momentum candidates."

            self.save_cache()

        except Exception as e:
            logger.error(f"Error during scan job: {e}")
            with self.lock:
                self.is_scanning = False
                self.status_message = f"Error during scan: {str(e)}"

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "is_scanning": self.is_scanning,
                "progress_pct": self.progress_pct,
                "status_message": self.status_message,
                "candidate_count": len(self.candidates)
            }

    def get_results(self) -> List[Dict[str, Any]]:
        with self.lock:
            return self.candidates


# Global instance
high_momentum_service = HighMomentumScannerService()
