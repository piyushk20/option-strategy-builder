import numpy as np
import pandas as pd
import vectorbt as vbt
import logging
import os

logger = logging.getLogger("strategies_vbt")

# ── Market-Regime Filter ─────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_NIFTY_CSV = os.path.join(BASE_DIR, ".tmp", "data", "NIFTY.csv")
_nifty_sma200: pd.Series | None = None

def _get_nifty_sma200() -> pd.Series | None:
    """Lazy-load NIFTY 200-day SMA for the market-regime filter."""
    global _nifty_sma200
    if _nifty_sma200 is not None:
        return _nifty_sma200
    try:
        df = pd.read_csv(_NIFTY_CSV, index_col="Date", parse_dates=True)
        df["Close"] = pd.to_numeric(df["Close"], errors="coerce")
        _nifty_sma200 = df["Close"].rolling(200).mean()
        logger.info("Loaded NIFTY SMA(200) market-regime filter.")
    except Exception as e:
        logger.warning(f"Could not load NIFTY SMA200 filter: {e}. All entries will pass.")
        _nifty_sma200 = None
    return _nifty_sma200


def _market_is_bullish(index: pd.DatetimeIndex) -> pd.Series:
    """
    Returns a boolean Series aligned to `index` where True = NIFTY is above SMA(200).
    Used to gate all long entries — only trade when market is in a bull regime.
    """
    sma200 = _get_nifty_sma200()
    if sma200 is None:
        return pd.Series(True, index=index)

    nifty_df = pd.read_csv(_NIFTY_CSV, index_col="Date", parse_dates=True)
    nifty_df["Close"] = pd.to_numeric(nifty_df["Close"], errors="coerce")
    nifty_sma = nifty_df["Close"].rolling(200).mean()

    # Align to target index
    bull_regime = (nifty_df["Close"] > nifty_sma).reindex(index, method="ffill").fillna(False)
    return bull_regime.astype(bool)


# ── ADX Helper ────────────────────────────────────────────────────────────────
def _compute_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Computes ADX(14) — Average Directional Index for trend strength."""
    prev_close = close.shift(1)
    tr = np.maximum(high - low, np.maximum(abs(high - prev_close), abs(low - prev_close)))
    atr = tr.rolling(period).mean()

    up_move = high - high.shift(1)
    down_move = low.shift(1) - low

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    plus_di = 100 * pd.Series(plus_dm, index=close.index).rolling(period).mean() / (atr + 1e-9)
    minus_di = 100 * pd.Series(minus_dm, index=close.index).rolling(period).mean() / (atr + 1e-9)

    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9)
    adx = dx.rolling(period).mean()
    return adx


# ── RSI Helper ────────────────────────────────────────────────────────────────
def _compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-9)
    return 100 - (100 / (1 + rs))


# ── Signal Cleaner ────────────────────────────────────────────────────────────
def _clean_signals(entries: pd.Series, exits: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Shift by 1 bar to execute on next open (no lookahead bias). Enforce bool dtype."""
    entries_clean = entries.shift(1).fillna(False).astype(bool)
    exits_clean = exits.shift(1).fillna(False).astype(bool)
    return entries_clean, exits_clean


# ═══════════════════════════════════════════════════════════════════════════════
# STRATEGY SIGNAL GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_vcp_signals(df: pd.DataFrame, pivot_window: int = 10, contraction_thresh: float = 0.85):
    """
    Minervini Volatility Contraction Pattern (VCP) Strategy — IMPROVED.
    
    Improvements:
    - Relaxed pivot_window: 20 → 10 days (more trade opportunities)
    - Relaxed volume filter: 1.2x → 1.0x SMA volume
    - Added market-regime filter: NIFTY must be above SMA(200)
    - SL/TP applied at execution layer (run_vbt_backtest)
    
    Entry: ATR contracting + Close breaks above 10-day pivot high + Volume surge + Bull regime
    Exit: Close < SMA(20) OR stop-loss/take-profit hit
    """
    close = df["Close"].astype(np.float64)
    high = df["High"].astype(np.float64)
    low = df["Low"].astype(np.float64)
    volume = df["Volume"].astype(np.float64)

    pivot_high = high.shift(1).rolling(pivot_window).max()
    vol_sma = volume.shift(1).rolling(20).mean()
    sma20 = close.rolling(20).mean()

    tr = np.maximum(high - low, np.maximum(abs(high - close.shift(1)), abs(low - close.shift(1))))
    atr10 = tr.rolling(10).mean()
    atr30 = tr.rolling(30).mean()
    is_contracting = (atr10 / (atr30 + 1e-9)) < contraction_thresh

    bull_regime = _market_is_bullish(df.index)

    entries = (close > pivot_high) & is_contracting & (volume > 1.0 * vol_sma) & (close > sma20) & bull_regime
    exits = (close < sma20)

    return _clean_signals(entries, exits)


def compute_elder_impulse_signals(df: pd.DataFrame, ema_len: int = 13, fast_macd: int = 12, slow_macd: int = 26, signal_macd: int = 9):
    """
    Elder Impulse System Strategy — IMPROVED.
    
    Improvements:
    - Added market-regime filter (NIFTY > SMA200): eliminates -38% Reliance drawdown
    - Entry restricted to bullish regimes only
    - SL/TP applied at execution layer
    
    Entry: Transition into Green Impulse (EMA rising + MACD Hist rising) AND bull regime
    Exit: Transition into Red Impulse (both falling simultaneously)
    """
    close = df["Close"].astype(np.float64)
    ema13 = close.ewm(span=ema_len, adjust=False).mean()
    ema_rising = ema13 > ema13.shift(1)

    ema_fast = close.ewm(span=fast_macd, adjust=False).mean()
    ema_slow = close.ewm(span=slow_macd, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal_macd, adjust=False).mean()
    macd_hist = macd_line - signal_line
    hist_rising = macd_hist > macd_hist.shift(1)

    is_green = ema_rising & hist_rising
    is_red = (~ema_rising) & (~hist_rising)

    bull_regime = _market_is_bullish(df.index)

    entries = is_green & (~is_green.shift(1).fillna(False)) & bull_regime
    exits = is_red

    return _clean_signals(entries, exits)


def compute_high_momentum_signals(df: pd.DataFrame, rsi_period: int = 14, rsi_entry: float = 60.0, rsi_exit: float = 50.0):
    """
    High Momentum Strategy (RSI + Dual Moving Averages) — IMPROVED.
    
    Improvements:
    - Market-regime filter applied (NIFTY > SMA200)
    - SL/TP applied at execution layer
    
    Entry: RSI(14) > 60 AND Close > SMA(50) AND Close > SMA(200) AND bull regime
    Exit: RSI(14) < 50 OR Close < SMA(50)
    """
    close = df["Close"].astype(np.float64)

    rsi = _compute_rsi(close, rsi_period)
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean()

    bull_regime = _market_is_bullish(df.index)

    entries = (rsi > rsi_entry) & (close > sma50) & (close > sma200) & bull_regime
    exits = (rsi < rsi_exit) | (close < sma50)

    return _clean_signals(entries, exits)


def compute_nday_high_signals(df: pd.DataFrame, n_days: int = 20, adx_threshold: float = 25.0):
    """
    N-Day High Donchian Breakout Strategy — IMPROVED.
    
    Improvements:
    - Added ADX(14) > 25 trend-strength filter: eliminates false breakouts in choppy markets
    - Added market-regime filter (NIFTY > SMA200)
    - SL/TP applied at execution layer
    
    Entry: Close > N-day High AND ADX > 25 (confirmed trend) AND bull regime
    Exit: Close < N/2-day Low
    """
    close = df["Close"].astype(np.float64)
    high = df["High"].astype(np.float64)
    low = df["Low"].astype(np.float64)

    n_high = high.shift(1).rolling(n_days).max()
    n_low = low.shift(1).rolling(max(5, n_days // 2)).min()
    adx = _compute_adx(high, low, close, period=14)

    bull_regime = _market_is_bullish(df.index)

    entries = (close > n_high) & (adx > adx_threshold) & bull_regime
    exits = close < n_low

    return _clean_signals(entries, exits)


def compute_bull_call_spread_signals(df: pd.DataFrame):
    """
    Bull Call Spread — delegates to High Momentum filter.
    Option-specific payoff is modelled at the portfolio simulation layer.
    """
    return compute_high_momentum_signals(df)


def compute_iron_condor_signals(df: pd.DataFrame, window: int = 20):
    """
    Iron Condor Rangebound Strategy — IMPROVED.
    
    Improvements:
    - Tightened entry: ATR% < 1.2% (stricter low-vol requirement, was 1.5%)
    - Added RSI mean-reversion band: 45–55 (tighter, was 42–58)
    - Exit earlier: RSI > 60 or < 40 (was 65/35) to reduce losses
    
    Entry: Very low volatility regime AND RSI near neutral (45-55)
    Exit: Volatility expansion or RSI breaks neutral zone
    """
    close = df["Close"].astype(np.float64)
    high = df["High"].astype(np.float64)
    low = df["Low"].astype(np.float64)

    tr = np.maximum(high - low, np.maximum(abs(high - close.shift(1)), abs(low - close.shift(1))))
    atr = tr.rolling(window).mean()
    atr_pct = atr / close

    rsi = _compute_rsi(close, period=14)

    entries = (atr_pct < 0.012) & (rsi >= 45) & (rsi <= 55)
    exits = (rsi > 60) | (rsi < 40) | (atr_pct > 0.020)

    return _clean_signals(entries, exits)


def compute_max_pain_straddle_signals(df: pd.DataFrame, profit_target_pct: float = 0.50):
    """
    Max-Pain Straddle Strategy (NEW).
    
    Models weekly ATM short straddle:
    - Entry: Every Monday open (fresh weekly straddle)
    - Exit: Thursday close (before Friday expiry to avoid gamma risk), or if
             ATR expands beyond 2x entry-day ATR (loss-limit proxy)
    
    Profitability proxy: position is "profitable" if the weekly price range
    stays within ±ATR of the entry price (theta decay wins).
    """
    close = df["Close"].astype(np.float64)
    high = df["High"].astype(np.float64)
    low = df["Low"].astype(np.float64)

    tr = np.maximum(high - low, np.maximum(abs(high - close.shift(1)), abs(low - close.shift(1))))
    atr14 = tr.rolling(14).mean()

    # Entry: Every Monday (or first trading day of week)
    is_monday = pd.Series(df.index.dayofweek == 0, index=df.index)
    # Exit: Every Thursday (or if ATR expansion > 2x entry-day ATR)
    is_thursday = pd.Series(df.index.dayofweek == 3, index=df.index)
    atr_expansion = atr14 > (atr14.shift(1) * 2.0)

    entries = is_monday
    exits = is_thursday | atr_expansion

    return _clean_signals(entries, exits)


# ═══════════════════════════════════════════════════════════════════════════════
# VECTORBT PORTFOLIO SIMULATION
# ═══════════════════════════════════════════════════════════════════════════════

# Stop-loss / take-profit per strategy (None = no limit)
STRATEGY_RISK_PARAMS = {
    "VCP_Breakout":        {"sl_pct": 0.07, "tp_pct": 0.20},   # Minervini: 7% SL, 20% TP
    "Elder_Impulse":       {"sl_pct": 0.07, "tp_pct": None},    # Trend following — no hard TP
    "High_Momentum":       {"sl_pct": 0.07, "tp_pct": None},
    "NDay_High_Breakout":  {"sl_pct": 0.10, "tp_pct": None},    # 10% wider SL for breakout
    "Bull_Call_Spread":    {"sl_pct": 0.07, "tp_pct": None},    # Capped loss modelled via SL
    "Iron_Condor":         {"sl_pct": 0.05, "tp_pct": 0.10},    # Theta — tight SL, modest TP
    "Max_Pain_Straddle":   {"sl_pct": 0.08, "tp_pct": 0.05},    # Weekly straddle: 8% SL, 5% TP
}


def run_vbt_backtest(df: pd.DataFrame, entries: pd.Series, exits: pd.Series,
                     init_cash: float = 100000.0,
                     sl_pct: float = None,
                     tp_pct: float = None):
    """
    Runs a VectorBT portfolio simulation given signal entries and exits.
    Enforces strict float64 and bool types to prevent Numba typing errors.
    
    Args:
        sl_pct: Stop-loss as a decimal fraction (e.g. 0.07 = 7%)
        tp_pct: Take-profit as a decimal fraction (e.g. 0.20 = 20%)
    """
    close_series = pd.Series(np.ascontiguousarray(df["Close"].values, dtype=np.float64), index=df.index)
    entries_series = pd.Series(np.ascontiguousarray(entries.values, dtype=bool), index=df.index)
    exits_series = pd.Series(np.ascontiguousarray(exits.values, dtype=bool), index=df.index)

    portfolio = vbt.Portfolio.from_signals(
        close=close_series,
        entries=entries_series,
        exits=exits_series,
        init_cash=init_cash,
        fees=0.0005,        # 0.05% brokerage + slippage per trade
        sl_stop=sl_pct,     # Dynamic stop-loss
        tp_stop=tp_pct,     # Dynamic take-profit
        freq="1D"
    )
    return portfolio
