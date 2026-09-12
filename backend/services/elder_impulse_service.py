import os
import sys
import time
import json
import logging
import threading
import warnings
from dataclasses import dataclass, asdict, replace
from typing import List, Dict, Optional, Any, Tuple
import pandas as pd
import numpy as np
import yfinance as yf

warnings.filterwarnings("ignore")

logger = logging.getLogger("elder_impulse_scanner")

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

NIFTY_200_UNIVERSE = NIFTY_50_UNIVERSE + [
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
    "PFC", "RECLTD", "SRF", "SUNDARMFIN", "TATAELXSI", "TORNTPOWER", "TUBEINVEST", "UPL", "VOLTAS",
    "BANDHANBNK", "BANKBARODA", "CANBK", "INDHOTEL", "JUBLFOOD", "LICHSGFIN", "PNB"
]

SMALLCAP_UNIVERSE = [
    "ANGELONE", "CENTURYPLY", "CERA", "CESC", "CHAMBLFERT", "CYIENT", "DATAPATTNS",
    "ECLERX", "HFCL", "IEX", "IRCTC", "KARURVYSYA", "KPITTECH", "MANAPPURAM",
    "MAPMYINDIA", "METROPOLIS", "NATIONALUM", "NLCINDIA", "NMDC", "RBLBANK",
    "SONACOMS", "SUZLON", "TATAINVEST", "TRIDENT", "ZENSARTECH"
]

UNIVERSES_MAP = {
    "nifty_50": NIFTY_50_UNIVERSE,
    "nifty_200": NIFTY_200_UNIVERSE,
    "midcap": MIDCAP_UNIVERSE,
    "smallcap": SMALLCAP_UNIVERSE
}


@dataclass
class ScannerConfig:
    universe: str = "nifty_200"
    timeframe: str = "1d"
    ema_length: int = 13
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    adx_len: int = 14
    adx_smooth: int = 14
    adx_threshold: float = 25.0
    st_factor: float = 3.0
    st_atr_len: int = 10


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False).mean()


def rma(series: pd.Series, length: int) -> pd.Series:
    alpha = 1.0 / length
    return series.ewm(alpha=alpha, adjust=False).mean()


def macd(series: pd.Series, fast: int, slow: int, signal: int) -> Tuple[pd.Series, pd.Series, pd.Series]:
    macd_line = ema(series, fast) - ema(series, slow)
    signal_line = ema(macd_line, signal)
    hist_line = macd_line - signal_line
    return macd_line, signal_line, hist_line


def dmi(high: pd.Series, low: pd.Series, close: pd.Series, length: int, smooth: int) -> Tuple[pd.Series, pd.Series, pd.Series]:
    up_move = high.diff()
    down_move = -low.diff()

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
    plus_dm = pd.Series(plus_dm, index=high.index)
    minus_dm = pd.Series(minus_dm, index=high.index)

    prev_close = close.shift(1)
    tr = pd.concat([
        (high - low),
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)

    tr_rma = rma(tr, length)
    plus_dm_rma = rma(plus_dm, length)
    minus_dm_rma = rma(minus_dm, length)

    di_plus = 100.0 * (plus_dm_rma / tr_rma.replace(0, np.nan))
    di_minus = 100.0 * (minus_dm_rma / tr_rma.replace(0, np.nan))

    dx = 100.0 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)
    adx_val = rma(dx, smooth)

    return di_plus, di_minus, adx_val


def supertrend(high: pd.Series, low: pd.Series, close: pd.Series, factor: float, atr_len: int) -> Tuple[pd.Series, pd.Series]:
    prev_close = close.shift(1)
    tr = pd.concat([
        (high - low),
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = rma(tr, atr_len)

    hl2 = (high + low) / 2.0
    upper_basic = hl2 + factor * atr
    lower_basic = hl2 - factor * atr

    n = len(close)
    upper_band = np.zeros(n)
    lower_band = np.zeros(n)
    direction = np.zeros(n)  # -1 up, +1 down
    st_line = np.zeros(n)

    close_v = close.to_numpy()
    upper_basic_v = upper_basic.to_numpy()
    lower_basic_v = lower_basic.to_numpy()

    for i in range(n):
        if i == 0 or np.isnan(upper_basic_v[i - 1]):
            upper_band[i] = upper_basic_v[i]
            lower_band[i] = lower_basic_v[i]
            direction[i] = -1.0
            st_line[i] = lower_band[i]
            continue

        upper_band[i] = (
            upper_basic_v[i]
            if (upper_basic_v[i] < upper_band[i - 1] or close_v[i - 1] > upper_band[i - 1])
            else upper_band[i - 1]
        )
        lower_band[i] = (
            lower_basic_v[i]
            if (lower_basic_v[i] > lower_band[i - 1] or close_v[i - 1] < lower_band[i - 1])
            else lower_band[i - 1]
        )

        if direction[i - 1] == -1.0:
            direction[i] = 1.0 if close_v[i] < lower_band[i] else -1.0
        else:
            direction[i] = -1.0 if close_v[i] > upper_band[i] else 1.0

        st_line[i] = lower_band[i] if direction[i] == -1.0 else upper_band[i]

    return (
        pd.Series(st_line, index=close.index),
        pd.Series(direction, index=close.index),
    )


class ElderImpulseScannerService:
    def __init__(self, cache_file: str = "elder_impulse_cache.json"):
        self.cache_file = os.path.join(os.path.dirname(__file__), "..", cache_file)
        self.is_scanning = False
        self.progress_pct = 0.0
        self.status_message = "Ready"
        self.results: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.load_cache()

    def load_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    data = json.load(f)
                    self.results = data.get("results", [])
                    logger.info(f"Loaded {len(self.results)} elder impulse results from cache.")
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")

    def save_cache(self):
        try:
            with open(self.cache_file, "w") as f:
                json.dump({
                    "timestamp": time.ctime(),
                    "results": self.results
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def fetch_ohlc(self, ticker: str, timeframe: str) -> Optional[pd.DataFrame]:
        yf_symbol = ticker if ticker.startswith("^") or ticker.endswith(".NS") else f"{ticker}.NS"
        try:
            if timeframe == "1h":
                df = yf.Ticker(yf_symbol).history(period="60d", interval="1h", auto_adjust=True)
            elif timeframe == "4h":
                df = yf.Ticker(yf_symbol).history(period="60d", interval="1h", auto_adjust=True)
                if df is not None and not df.empty:
                    df = df.rename(columns=str.title)
                    # Resample 1-hour candles into 4-hour candles
                    df = df.resample('4h', origin='start').agg({
                        'Open': 'first',
                        'High': 'max',
                        'Low': 'min',
                        'Close': 'last',
                        'Volume': 'sum'
                    }).dropna()
            elif timeframe == "1wk":
                df = yf.Ticker(yf_symbol).history(period="2y", interval="1wk", auto_adjust=True)
            else:  # "1d" default
                df = yf.Ticker(yf_symbol).history(period="250d", interval="1d", auto_adjust=True)

            if df is None or df.empty or len(df) < 50:
                return None
            df = df.rename(columns=str.title)
            required = {"Open", "High", "Low", "Close"}
            if not required.issubset(df.columns):
                return None
            return df.dropna(subset=list(required))
        except Exception:
            return None

    def evaluate_symbol(self, symbol: str, cfg: ScannerConfig) -> Optional[Dict[str, Any]]:
        df = self.fetch_ohlc(symbol, cfg.timeframe)
        if df is None:
            return None

        min_bars = max(
            cfg.macd_slow + cfg.macd_signal,
            cfg.adx_len + cfg.adx_smooth,
            cfg.st_atr_len,
        ) + 5

        if len(df) < min_bars:
            return None

        close = df["Close"]
        ema_val = ema(close, cfg.ema_length)
        _, _, hist_line = macd(close, cfg.macd_fast, cfg.macd_slow, cfg.macd_signal)
        di_plus, di_minus, adx_val = dmi(
            df["High"], df["Low"], close, cfg.adx_len, cfg.adx_smooth
        )
        st_line, st_dir = supertrend(
            df["High"], df["Low"], close, cfg.st_factor, cfg.st_atr_len
        )

        i = -1
        if pd.isna(ema_val.iloc[i - 1]) or pd.isna(hist_line.iloc[i - 1]) or pd.isna(adx_val.iloc[i]):
            return None

        elder_bulls = (ema_val.iloc[i] > ema_val.iloc[i - 1]) and (hist_line.iloc[i] > hist_line.iloc[i - 1])
        elder_bears = (ema_val.iloc[i] < ema_val.iloc[i - 1]) and (hist_line.iloc[i] < hist_line.iloc[i - 1])

        st_up = st_dir.iloc[i] < 0
        adx_trending = adx_val.iloc[i] > cfg.adx_threshold
        di_bullish = di_plus.iloc[i] > di_minus.iloc[i]

        bull_confluence = elder_bulls and st_up and adx_trending and di_bullish
        bear_confluence = elder_bears and (not st_up) and adx_trending and (not di_bullish)

        if not (bull_confluence or bear_confluence):
            return None

        return {
            "symbol": symbol.upper(),
            "close": round(float(close.iloc[i]), 2),
            "confluence": "BULL" if bull_confluence else "BEAR",
            "ema": round(float(ema_val.iloc[i]), 2),
            "macd_hist": round(float(hist_line.iloc[i]), 2),
            "adx": round(float(adx_val.iloc[i]), 1),
            "di_plus": round(float(di_plus.iloc[i]), 1),
            "di_minus": round(float(di_minus.iloc[i]), 1),
            "supertrend": round(float(st_line.iloc[i]), 2),
            "supertrend_dir": "Up" if st_up else "Down",
            "elder_impulse": "Green (Bulls)" if elder_bulls else "Red (Bears)" if elder_bears else "Blue (Neutral)",
            "score": round(float(adx_val.iloc[i]) + abs(float(di_plus.iloc[i]) - float(di_minus.iloc[i])), 2),
            "universe": cfg.universe,
            "timeframe": cfg.timeframe
        }

    def start_scan_async(
        self,
        universe: str = "nifty_200",
        timeframe: str = "1d",
        adx_threshold: float = 25.0,
        ema_length: int = 13,
        st_factor: float = 3.0,
        st_atr_len: int = 10
    ) -> bool:
        with self.lock:
            if self.is_scanning:
                return False
            self.is_scanning = True
            self.progress_pct = 0.0
            self.status_message = f"Initializing Elder Impulse Scan ({universe.upper()}, {timeframe})..."

        cfg = ScannerConfig(
            universe=universe,
            timeframe=timeframe,
            adx_threshold=adx_threshold,
            ema_length=ema_length,
            st_factor=st_factor,
            st_atr_len=st_atr_len
        )

        symbols = UNIVERSES_MAP.get(universe, NIFTY_200_UNIVERSE)

        thread = threading.Thread(
            target=self._run_scan_job,
            args=(symbols, cfg),
            daemon=True
        )
        thread.start()
        return True

    def _run_scan_job(self, symbols: List[str], cfg: ScannerConfig):
        try:
            results = []
            total = len(symbols)

            for i, symbol in enumerate(symbols, 1):
                with self.lock:
                    self.progress_pct = round((i / total) * 100, 1)
                    self.status_message = f"Evaluating Elder Impulse [{cfg.timeframe.upper()}] for {symbol} ({i}/{total})..."

                res = self.evaluate_symbol(symbol, cfg)
                if res:
                    results.append(res)
                time.sleep(0.02)

            results.sort(key=lambda x: (x["confluence"], -x["score"]))

            with self.lock:
                self.results = results
                self.is_scanning = False
                self.progress_pct = 100.0
                self.status_message = f"Scan complete! Found {len(results)} Elder Impulse matches in {cfg.universe.upper()} ({cfg.timeframe.upper()})."

            self.save_cache()

        except Exception as e:
            logger.error(f"Error during Elder Impulse scan job: {e}")
            with self.lock:
                self.is_scanning = False
                self.status_message = f"Error during scan: {str(e)}"

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "is_scanning": self.is_scanning,
                "progress_pct": self.progress_pct,
                "status_message": self.status_message,
                "result_count": len(self.results)
            }

    def get_results(self) -> List[Dict[str, Any]]:
        with self.lock:
            return self.results


# Global instance
elder_impulse_service = ElderImpulseScannerService()
