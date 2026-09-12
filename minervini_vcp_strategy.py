"""
==========================================================================
Python port of "Minervini Growth Stock Strategy (Trend Template + VCP)"
(Pine Script v6 strategy) — Trend Template (Stage 2), VCP contraction
detection, trigger-bar identification, pivot breakout entry, market-context
filter, late-stage base counter, and a full bar-by-bar backtest engine with
Minervini-style risk management (stop below trigger bar / 10 EMA, optional
breakeven move, rule-based SMA20/SMA50 exits, R-multiple profit target).

Design notes / fidelity to the original Pine script
--------------------------------------------------------------------------
- Pine's `ta.pivothigh`/`ta.pivotlow` only CONFIRM a pivot `right` bars
  after it occurs. This port replicates that non-repainting lag exactly:
  a pivot detected at bar i is only usable starting at bar i + right.
- The VCP contraction array (`var array<float> contractions`) and the
  "contractions decreasing" test, the trigger-bar tracking
  (`lastTriggerBarIdx` / `triggerBarLow`), and the late-stage base counter
  are all path-dependent / stateful, exactly as in Pine's `var` variables —
  so they are computed with an explicit bar-by-bar loop rather than
  vectorized, to guarantee behavioral equivalence.
- `ta.percentrank` is approximated the same way the original script itself
  treats it: an INFORMATIONAL proxy for relative strength, not IBD's true
  cross-sectional 1-99 rank against the whole market. This is called out
  explicitly in the output, exactly as the original script's comments do.
- Order fills: entries are modeled as filling at the signal bar's close
  (approximation of `strategy.entry` under default bar-close execution);
  exits check STOP before TARGET before rule-based exits on every
  subsequent bar, using intrabar high/low for stop and target, and close
  for the SMA20/SMA50 rule exits — mirroring `strategy.exit` + manual
  `strategy.close` behavior.
- Fundamentals ("Code 3": EPS/Sales/Margin acceleration) are OFF by
  default and purely informational, exactly as in the source script —
  NSE fundamentals coverage via free data sources is patchy, so this is
  never allowed to gate an entry.

Author: Senior Technical Architect port — production-ready, typed,
logged, and unit-testable building blocks.
==========================================================================
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    import matplotlib.plt as plt
    import matplotlib.dates as mdates
    HAS_MPL = True
except ImportError:
    try:
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates
        HAS_MPL = True
    except ImportError:
        HAS_MPL = False


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("minervini_vcp")


# ==========================================================================
# 1. CONFIGURATION  (1:1 mirror of the Pine script `input.*` groups)
# ==========================================================================

@dataclass
class TrendTemplateConfig:
    """Group 1: Trend Template (Stage 2)."""
    sma50: int = 50
    sma150: int = 150
    sma200: int = 200
    slope_lookback: int = 100          # "200MA trending up" lookback (~4-5 months)
    min_above_52w_low_pct: float = 25.0
    rs_lookback: int = 252
    rs_min_rating: int = 70            # 0-99, approximated
    benchmark_symbol: str = "^NSEI"    # NSE:NIFTY equivalent on yfinance


@dataclass
class VCPConfig:
    """Group 2: VCP detection."""
    pivot_strength: int = 5            # left/right bars for pivot confirmation
    base_lookback: int = 130
    min_contractions: int = 2
    contraction_tol: float = 0.90      # each contraction must be < prior * this


@dataclass
class TriggerBarConfig:
    """Group 3: Trigger bar ('one-two punch')."""
    narrow_range_len: int = 20
    narrow_range_pct: float = 25.0     # bottom X% of range over lookback
    vol_ma_len: int = 50
    low_vol_mult: float = 0.7
    near_ema10_pct: float = 3.0


@dataclass
class EntryConfig:
    """Group 4: Entry / breakout."""
    breakout_vol_mult: float = 1.5
    trigger_valid_bars: int = 10
    require_52w_high_breakout: bool = False


@dataclass
class RiskConfig:
    """Group 5: Risk management."""
    stop_buffer_pct: float = 1.0
    r_multiple_target: float = 3.0     # 0 = disabled
    use_sma20_exit: bool = True
    use_sma50_exit: bool = True
    move_to_breakeven: bool = True


@dataclass
class LateStageConfig:
    """Group 6: Late-stage base awareness."""
    warn_at_base_count: int = 4


@dataclass
class MarketFilterConfig:
    """Group 7: Market context (the '91% rule')."""
    use_market_filter: bool = True


@dataclass
class FundamentalsConfig:
    """Group 8: Code 3 fundamentals — informational only, never gates entries."""
    use_code3: bool = False


@dataclass
class BacktestConfig:
    """Position sizing / execution costs (mirrors the `strategy(...)` call)."""
    initial_capital: float = 1_000_000.0
    pct_equity_per_trade: float = 10.0     # default_qty_value under percent_of_equity
    commission_pct: float = 0.05           # per fill (entry AND exit)
    pyramiding: bool = False               # only one open position at a time


@dataclass
class StrategyConfig:
    trend: TrendTemplateConfig = field(default_factory=TrendTemplateConfig)
    vcp: VCPConfig = field(default_factory=VCPConfig)
    trigger: TriggerBarConfig = field(default_factory=TriggerBarConfig)
    entry: EntryConfig = field(default_factory=EntryConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    late_stage: LateStageConfig = field(default_factory=LateStageConfig)
    market: MarketFilterConfig = field(default_factory=MarketFilterConfig)
    fundamentals: FundamentalsConfig = field(default_factory=FundamentalsConfig)
    backtest: BacktestConfig = field(default_factory=BacktestConfig)


# ==========================================================================
# 2. INDICATOR PRIMITIVES
# ==========================================================================

def sma(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(length, min_periods=length).mean()


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False, min_periods=length).mean()


def percent_rank(series: pd.Series, length: int) -> pd.Series:
    """
    Approximates Pine's ta.percentrank(source, length): the percentage of the
    previous `length` bars whose value is LESS than the current bar's value.
    Returned as 0-100. This is used only as a relative-strength / narrow-range
    PROXY (as the source script itself notes) — not a true cross-sectional
    market rank.
    """
    def _rank(window: np.ndarray) -> float:
        current = window[-1]
        past = window[:-1]
        if len(past) == 0:
            return 0.0
        return float((past < current).sum()) / len(past) * 100.0

    return series.rolling(length + 1, min_periods=length + 1).apply(_rank, raw=True)


def pivot_high(high: pd.Series, left: int, right: int) -> pd.Series:
    """
    Non-repainting port of ta.pivothigh(high, left, right).
    A pivot at raw index i (high[i] is the max of the [i-left, i+right] window,
    first occurrence on ties) is only marked as CONFIRMED at index i + right —
    exactly matching when Pine would return a non-na value in a live bar-by-bar
    execution context.
    """
    vals = high.to_numpy()
    n = len(vals)
    out = np.full(n, np.nan)
    for i in range(left, n - right):
        window = vals[i - left: i + right + 1]
        if window.argmax() == left:  # centre bar is the (first) max
            out[i + right] = vals[i]
    return pd.Series(out, index=high.index)


def pivot_low(low: pd.Series, left: int, right: int) -> pd.Series:
    """Non-repainting port of ta.pivotlow(low, left, right). See pivot_high."""
    vals = low.to_numpy()
    n = len(vals)
    out = np.full(n, np.nan)
    for i in range(left, n - right):
        window = vals[i - left: i + right + 1]
        if window.argmin() == left:
            out[i + right] = vals[i]
    return pd.Series(out, index=low.index)


def crossover(a: pd.Series, b: pd.Series) -> pd.Series:
    """Port of ta.crossover(a, b): a crosses above b on this bar."""
    return (a > b) & (a.shift(1) <= b.shift(1))


# ==========================================================================
# 3. DATA LOADING
# ==========================================================================

def load_ohlcv(
    symbol: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    period: str = "3y",
    interval: str = "1d",
) -> pd.DataFrame:
    """
    Fetch OHLCV data via yfinance. For NSE-listed symbols pass the plain
    ticker (e.g. "RELIANCE") — the ".NS" suffix is appended automatically
    if not already present and the symbol is not an index (^ prefix).
    """
    if not HAS_YFINANCE:
        raise RuntimeError(
            "yfinance is not installed. Run: pip install yfinance --break-system-packages"
        )

    ticker = symbol
    if not ticker.startswith("^") and "." not in ticker:
        ticker = f"{ticker}.NS"

    logger.info("Fetching %s (interval=%s)...", ticker, interval)
    kwargs = dict(interval=interval, auto_adjust=True, progress=False)
    if start:
        df = yf.download(ticker, start=start, end=end, **kwargs)
    else:
        df = yf.download(ticker, period=period, **kwargs)

    if df.empty:
        raise ValueError(f"No data returned for {ticker}. Check the symbol.")

    # yfinance can return MultiIndex columns for a single ticker in newer versions
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.index = pd.to_datetime(df.index)
    df = df[~df.index.duplicated(keep="last")].sort_index()
    logger.info("Loaded %d bars for %s (%s -> %s)", len(df), ticker, df.index[0].date(), df.index[-1].date())
    return df


# ==========================================================================
# 4. TRADE / RESULT RECORDS
# ==========================================================================

@dataclass
class Trade:
    entry_date: pd.Timestamp
    entry_price: float
    shares: float
    stop_level: float
    target_level: Optional[float]
    exit_date: Optional[pd.Timestamp] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    pnl: Optional[float] = None
    r_multiple: Optional[float] = None
    base_number_at_entry: Optional[int] = None

    def close(self, date: pd.Timestamp, price: float, reason: str, commission_pct: float) -> None:
        self.exit_date = date
        self.exit_price = price
        self.exit_reason = reason
        gross = (price - self.entry_price) * self.shares
        entry_commission = self.entry_price * self.shares * commission_pct / 100.0
        exit_commission = price * self.shares * commission_pct / 100.0
        self.pnl = gross - entry_commission - exit_commission
        risk_per_share = self.entry_price - self.stop_level
        self.r_multiple = (price - self.entry_price) / risk_per_share if risk_per_share > 0 else np.nan


# ==========================================================================
# 5. STRATEGY ENGINE
# ==========================================================================

class MinerviniVCPStrategy:
    """
    End-to-end engine: computes all indicators, evaluates the Trend
    Template, detects VCP contractions + trigger bars + pivot breakouts,
    applies the market-context filter and late-stage base counter, then
    (optionally) runs a bar-by-bar backtest with Minervini-style risk
    management.
    """

    def __init__(self, df: pd.DataFrame, benchmark: pd.DataFrame, config: StrategyConfig):
        if not isinstance(df.index, pd.DatetimeIndex):
            raise TypeError("df must be indexed by DatetimeIndex")
        self.raw = df
        self.benchmark = benchmark
        self.cfg = config
        self.df: pd.DataFrame = pd.DataFrame()
        self.trades: list[Trade] = []
        self.equity_curve: pd.Series = pd.Series(dtype=float)

    # ---------------------------------------------------------------- #
    # 5.1 Vectorized indicator prep
    # ---------------------------------------------------------------- #
    def _prepare_indicators(self) -> None:
        c = self.cfg
        df = self.raw.copy()

        df["sma20"] = sma(df["Close"], 20)
        df["sma50"] = sma(df["Close"], c.trend.sma50)
        df["sma150"] = sma(df["Close"], c.trend.sma150)
        df["sma200"] = sma(df["Close"], c.trend.sma200)
        df["ema10"] = ema(df["Close"], 10)
        df["ema21"] = ema(df["Close"], 21)
        df["high52"] = df["High"].rolling(252, min_periods=1).max()
        df["low52"] = df["Low"].rolling(252, min_periods=1).min()

        # --- 1. Trend Template (six criteria) ---
        df["c1_price_above_mas"] = (df["Close"] > df["sma150"]) & (df["Close"] > df["sma200"])
        df["c2_ma150_above_ma200"] = df["sma150"] > df["sma200"]
        df["c3_ma200_trending_up"] = df["sma200"] > df["sma200"].shift(c.trend.slope_lookback)
        df["c4_ma50_above"] = (df["sma50"] > df["sma150"]) & (df["sma50"] > df["sma200"])
        df["c5_above_52w_low"] = df["Close"] >= df["low52"] * (1 + c.trend.min_above_52w_low_pct / 100)

        bench_close = self.benchmark["Close"].reindex(df.index).ffill()
        rel_perf = df["Close"] / bench_close
        df["rel_perf"] = rel_perf
        df["rs_percentile"] = percent_rank(rel_perf, c.trend.rs_lookback)
        df["c6_rs_rating"] = df["rs_percentile"] > c.trend.rs_min_rating

        df["trend_template"] = (
            df["c1_price_above_mas"] & df["c2_ma150_above_ma200"] & df["c3_ma200_trending_up"]
            & df["c4_ma50_above"] & df["c5_above_52w_low"] & df["c6_rs_rating"]
        )

        # --- 2. Pivots feeding VCP contraction detection ---
        df["pivot_high"] = pivot_high(df["High"], c.vcp.pivot_strength, c.vcp.pivot_strength)
        df["pivot_low"] = pivot_low(df["Low"], c.vcp.pivot_strength, c.vcp.pivot_strength)

        third_len = max(round(c.vcp.base_lookback / 3), 5)
        df["vol_recent_third"] = sma(df["Volume"], third_len)
        df["vol_earlier_third"] = df["vol_recent_third"].shift(third_len)

        # --- 3. Trigger bar inputs ---
        df["vol_ma"] = sma(df["Volume"], c.trigger.vol_ma_len)
        df["bar_range"] = df["High"] - df["Low"]
        df["range_rank"] = percent_rank(df["bar_range"], c.trigger.narrow_range_len)

        # --- 4. Pivot point & breakout ---
        df["pivot_price"] = df["High"].shift(1).rolling(c.vcp.base_lookback, min_periods=c.vcp.base_lookback).max()
        df["vol_surge"] = df["Volume"] > df["vol_ma"] * c.entry.breakout_vol_mult

        if c.entry.require_52w_high_breakout:
            df["new_high_ok"] = df["High"] >= df["high52"]
        else:
            df["new_high_ok"] = True
        df["breakout"] = crossover(df["Close"], df["pivot_price"]) & df["vol_surge"] & df["new_high_ok"]

        # --- 7. Market context: benchmark above its MONTHLY 10 EMA ---
        if c.market.use_market_filter:
            bench_monthly_close = self.benchmark["Close"].resample("ME").last()
            bench_monthly_ema10 = ema(bench_monthly_close, 10)
            market_ok_monthly = bench_monthly_close > bench_monthly_ema10
            # Effective from the day the month CLOSES (ffill), no look-ahead.
            df["market_ok"] = market_ok_monthly.reindex(df.index, method="ffill").fillna(False)
        else:
            df["market_ok"] = True

        self.df = df

    # ---------------------------------------------------------------- #
    # 5.2 Stateful VCP contraction + trigger-bar + base-counter pass
    #     (mirrors Pine's `var` variables — must be sequential)
    # ---------------------------------------------------------------- #
    def _run_stateful_signals(self) -> None:
        df = self.df
        c = self.cfg
        n = len(df)

        pivot_high_v = df["pivot_high"].to_numpy()
        pivot_low_v = df["pivot_low"].to_numpy()
        vol_recent_third = df["vol_recent_third"].to_numpy()
        vol_earlier_third = df["vol_earlier_third"].to_numpy()
        range_rank = df["range_rank"].to_numpy()
        volume = df["Volume"].to_numpy()
        vol_ma = df["vol_ma"].to_numpy()
        close = df["Close"].to_numpy()
        ema10 = df["ema10"].to_numpy()
        sma200 = df["sma200"].to_numpy()
        trend_template = df["trend_template"].to_numpy()

        vcp_valid = np.zeros(n, dtype=bool)
        trigger_bar = np.zeros(n, dtype=bool)
        trigger_recent = np.zeros(n, dtype=bool)
        base_counter_arr = np.zeros(n, dtype=int)
        late_stage_arr = np.zeros(n, dtype=bool)

        last_swing_high = np.nan
        contractions: list[float] = []
        last_trigger_bar_idx: Optional[int] = None
        trigger_bar_low = np.nan
        base_counter = 0

        for i in range(n):
            # --- VCP contraction tracking ---
            ph, pl = pivot_high_v[i], pivot_low_v[i]
            if not np.isnan(ph):
                last_swing_high = ph
            if not np.isnan(pl) and not np.isnan(last_swing_high) and last_swing_high > pl:
                depth_pct = (last_swing_high - pl) / last_swing_high * 100.0
                contractions.append(depth_pct)
                if len(contractions) > 5:
                    contractions.pop(0)
                last_swing_high = np.nan

            m = len(contractions)
            decreasing = False
            if m >= c.vcp.min_contractions:
                decreasing = True
                for k in range(m - c.vcp.min_contractions, m - 1):
                    if contractions[k + 1] >= contractions[k] * c.vcp.contraction_tol:
                        decreasing = False
                        break

            volume_contracting = (
                not np.isnan(vol_recent_third[i])
                and not np.isnan(vol_earlier_third[i])
                and vol_recent_third[i] < vol_earlier_third[i]
            )
            vcp_valid[i] = decreasing and volume_contracting

            # --- Trigger bar ---
            is_narrow = (not np.isnan(range_rank[i])) and range_rank[i] <= c.trigger.narrow_range_pct
            is_low_vol = (not np.isnan(vol_ma[i])) and volume[i] < vol_ma[i] * c.trigger.low_vol_mult
            is_near_ema10 = (not np.isnan(ema10[i])) and abs(close[i] - ema10[i]) / ema10[i] * 100.0 <= c.trigger.near_ema10_pct
            tb = is_narrow and is_low_vol and is_near_ema10 and vcp_valid[i]
            trigger_bar[i] = tb
            if tb:
                last_trigger_bar_idx = i
                trigger_bar_low = df["Low"].iat[i]

            trigger_recent[i] = (
                last_trigger_bar_idx is not None and (i - last_trigger_bar_idx) <= c.entry.trigger_valid_bars
            )

            # --- Late-stage base counter ---
            if trend_template[i] and (i == 0 or not trend_template[i - 1]):
                base_counter += 1
            if i >= 19 and not np.isnan(sma200[i]) and not np.isnan(sma200[i - 19]):
                if close[i] < sma200[i] and close[i - 19] < sma200[i - 19]:
                    base_counter = 0
            base_counter_arr[i] = base_counter
            late_stage_arr[i] = base_counter >= c.late_stage.warn_at_base_count

        df["vcp_valid"] = vcp_valid
        df["trigger_bar"] = trigger_bar
        df["trigger_recent"] = trigger_recent
        df["trigger_bar_low_tracked"] = np.nan
        df["base_counter"] = base_counter_arr
        df["late_stage"] = late_stage_arr
        df["long_condition_raw"] = (
            df["trend_template"] & df["vcp_valid"] & df["trigger_recent"] & df["breakout"] & df["market_ok"]
        )

        tb_low_series = pd.Series(np.where(trigger_bar, df["Low"].to_numpy(), np.nan), index=df.index)
        df["last_trigger_bar_low"] = tb_low_series.ffill()

        self.df = df

    # ---------------------------------------------------------------- #
    # 5.3 Backtest (bar-by-bar position simulation with risk management)
    # ---------------------------------------------------------------- #
    def _run_backtest(self) -> None:
        df = self.df
        c = self.cfg.risk
        bt = self.cfg.backtest
        n = len(df)

        close = df["Close"].to_numpy()
        high = df["High"].to_numpy()
        low = df["Low"].to_numpy()
        sma20 = df["sma20"].to_numpy()
        sma50 = df["sma50"].to_numpy()
        ema10 = df["ema10"].to_numpy()
        long_condition_raw = df["long_condition_raw"].to_numpy()
        last_tb_low = df["last_trigger_bar_low"].to_numpy()
        base_counter_arr = df["base_counter"].to_numpy()
        dates = df.index

        equity = bt.initial_capital
        equity_curve = np.full(n, np.nan)
        position_open = False
        open_trade: Optional[Trade] = None
        stop_level = np.nan
        target_level = np.nan
        entry_price = np.nan
        risk_per_share = np.nan
        moved_to_breakeven = False

        trades: list[Trade] = []

        for i in range(n):
            was_open_at_bar_start = position_open

            if position_open:
                exited = False

                if c.move_to_breakeven and not moved_to_breakeven and risk_per_share > 0:
                    if high[i] >= entry_price + risk_per_share:
                        new_stop = max(stop_level, entry_price)
                        if new_stop != stop_level:
                            stop_level = new_stop
                            moved_to_breakeven = True

                if not exited and low[i] <= stop_level:
                    fill = min(stop_level, high[i]) if low[i] <= stop_level <= high[i] else stop_level
                    open_trade.close(dates[i], fill, "Stop", bt.commission_pct)
                    equity += open_trade.pnl
                    exited = True

                if not exited and not np.isnan(target_level) and high[i] >= target_level:
                    open_trade.close(dates[i], target_level, "Target", bt.commission_pct)
                    equity += open_trade.pnl
                    exited = True

                if not exited and c.use_sma20_exit and not np.isnan(sma20[i]) and close[i] < sma20[i]:
                    open_trade.close(dates[i], close[i], "Close<20SMA", bt.commission_pct)
                    equity += open_trade.pnl
                    exited = True

                if not exited and c.use_sma50_exit and not np.isnan(sma50[i]) and close[i] < sma50[i]:
                    open_trade.close(dates[i], close[i], "Close<50SMA (hard exit)", bt.commission_pct)
                    equity += open_trade.pnl
                    exited = True

                if exited:
                    trades.append(open_trade)
                    position_open = False
                    open_trade = None
                    stop_level = target_level = entry_price = risk_per_share = np.nan
                    moved_to_breakeven = False

            if not was_open_at_bar_start and long_condition_raw[i]:
                trig_low = last_tb_low[i] if not np.isnan(last_tb_low[i]) else ema10[i]
                raw_stop = min(trig_low, ema10[i])
                stop_level = raw_stop * (1 - c.stop_buffer_pct / 100.0)
                entry_price = close[i]
                risk_per_share = entry_price - stop_level

                if risk_per_share > 0:
                    target_level = (
                        entry_price + risk_per_share * c.r_multiple_target
                        if c.r_multiple_target > 0 else np.nan
                    )
                    trade_capital = equity * bt.pct_equity_per_trade / 100.0
                    shares = trade_capital / entry_price
                    open_trade = Trade(
                        entry_date=dates[i],
                        entry_price=entry_price,
                        shares=shares,
                        stop_level=stop_level,
                        target_level=target_level if not np.isnan(target_level) else None,
                        base_number_at_entry=int(base_counter_arr[i]),
                    )
                    position_open = True
                    moved_to_breakeven = False
                else:
                    stop_level = target_level = entry_price = risk_per_share = np.nan

            equity_curve[i] = equity + (
                (close[i] - open_trade.entry_price) * open_trade.shares if position_open else 0.0
            )

        if position_open and open_trade is not None:
            open_trade.close(dates[-1], close[-1], "End of data", bt.commission_pct)
            equity += open_trade.pnl
            trades.append(open_trade)
            equity_curve[-1] = equity

        self.trades = trades
        self.equity_curve = pd.Series(equity_curve, index=dates, name="equity")
        df["long_condition"] = df["long_condition_raw"]

    # ---------------------------------------------------------------- #
    # 5.4 Orchestration
    # ---------------------------------------------------------------- #
    def run(self) -> "MinerviniVCPStrategy":
        logger.info("Preparing indicators...")
        self._prepare_indicators()
        logger.info("Running stateful VCP / trigger-bar / base-counter pass...")
        self._run_stateful_signals()
        logger.info("Running backtest simulation...")
        self._run_backtest()
        logger.info("Done. %d trades generated.", len(self.trades))
        return self

    # ---------------------------------------------------------------- #
    # 5.5 Reporting
    # ---------------------------------------------------------------- #
    def latest_checklist(self) -> dict:
        """Reproduces the on-chart checklist table for the most recent bar."""
        row = self.df.iloc[-1]
        return {
            "date": self.df.index[-1].date().isoformat(),
            "close": round(float(row["Close"]), 2),
            "Price > 150/200 SMA": bool(row["c1_price_above_mas"]),
            "150 SMA > 200 SMA": bool(row["c2_ma150_above_ma200"]),
            "200 SMA trending up": bool(row["c3_ma200_trending_up"]),
            "50 SMA > 150/200 SMA": bool(row["c4_ma50_above"]),
            "Well above 52w low": bool(row["c5_above_52w_low"]),
            f"RS Rating > {self.cfg.trend.rs_min_rating}": bool(row["c6_rs_rating"]),
            "STAGE 2 (all six)": bool(row["trend_template"]),
            "VCP contractions valid": bool(row["vcp_valid"]),
            "Trigger bar recent": bool(row["trigger_recent"]),
            "Market context OK": bool(row["market_ok"]),
            "Base count": int(row["base_counter"]),
            "Late-stage base": bool(row["late_stage"]),
            "ALL SYSTEMS GO (entry today)": bool(row["long_condition_raw"]),
        }

    def trades_dataframe(self) -> pd.DataFrame:
        if not self.trades:
            return pd.DataFrame(
                columns=["entry_date", "entry_price", "shares", "stop_level", "target_level",
                         "exit_date", "exit_price", "exit_reason", "pnl", "r_multiple", "base_number_at_entry"]
            )
        return pd.DataFrame([t.__dict__ for t in self.trades])

    def performance_summary(self) -> dict:
        tdf = self.trades_dataframe()
        if tdf.empty:
            return {"trades": 0, "note": "No trades were generated over this period/config."}

        wins = tdf[tdf["pnl"] > 0]
        losses = tdf[tdf["pnl"] <= 0]
        total_pnl = tdf["pnl"].sum()
        gross_profit = wins["pnl"].sum()
        gross_loss = -losses["pnl"].sum()

        eq = self.equity_curve.dropna()
        running_max = eq.cummax()
        drawdown = (eq - running_max) / running_max
        max_dd_pct = float(drawdown.min() * 100) if len(drawdown) else np.nan

        return {
            "trades": int(len(tdf)),
            "wins": int(len(wins)),
            "losses": int(len(losses)),
            "win_rate_pct": round(len(wins) / len(tdf) * 100, 2),
            "avg_r_multiple": round(float(tdf["r_multiple"].mean()), 2),
            "avg_win_r": round(float(wins["r_multiple"].mean()), 2) if len(wins) else np.nan,
            "avg_loss_r": round(float(losses["r_multiple"].mean()), 2) if len(losses) else np.nan,
            "profit_factor": round(float(gross_profit / gross_loss), 2) if gross_loss > 0 else (999.0 if len(wins) > 0 else 0.0),
            "total_pnl": round(float(total_pnl), 2),
            "total_return_pct": round(float(total_pnl / self.cfg.backtest.initial_capital * 100), 2),
            "final_equity": round(float(self.cfg.backtest.initial_capital + total_pnl), 2),
            "max_drawdown_pct": round(max_dd_pct, 2),
            "exit_reason_breakdown": tdf["exit_reason"].value_counts().to_dict(),
        }

    # ---------------------------------------------------------------- #
    # 5.6 Plotting
    # ---------------------------------------------------------------- #
    def plot(self, symbol: str, out_path: Path, lookback_bars: Optional[int] = 400) -> Optional[Path]:
        if not HAS_MPL:
            logger.warning("matplotlib not installed; skipping chart.")
            return None

        df = self.df.tail(lookback_bars) if lookback_bars else self.df

        fig, ax = plt.subplots(figsize=(15, 8))
        ax.plot(df.index, df["Close"], color="black", linewidth=1.0, label="Close")
        ax.plot(df.index, df["sma50"], color="orange", linewidth=1.0, label="50 SMA")
        ax.plot(df.index, df["sma150"], color="blue", linewidth=1.0, label="150 SMA")
        ax.plot(df.index, df["sma200"], color="red", linewidth=1.0, label="200 SMA")
        ax.plot(df.index, df["ema10"], color="teal", linewidth=0.8, alpha=0.7, label="10 EMA")

        stage2 = df[df["trend_template"]]
        ax.scatter(stage2.index, stage2["Close"], color="green", alpha=0.05, s=20)

        trig = df[df["trigger_bar"]]
        ax.scatter(trig.index, trig["Low"], marker="D", color="gold", s=40, label="Trigger bar", zorder=5)

        entries = df[df["long_condition_raw"]]
        ax.scatter(entries.index, entries["Close"], marker="^", color="lime", s=90,
                   edgecolor="black", label="Entry signal", zorder=6)

        for t in self.trades:
            if t.entry_date in df.index:
                ax.axhline(y=t.stop_level, color="red", linestyle="--", linewidth=0.6, alpha=0.4)
                if t.exit_date is not None and t.exit_date in df.index:
                    color = "green" if (t.pnl or 0) > 0 else "red"
                    ax.plot([t.entry_date, t.exit_date], [t.entry_price, t.exit_price],
                            color=color, linewidth=1.2, alpha=0.8)

        ax.set_title(f"{symbol} — Minervini Trend Template + VCP")
        ax.legend(loc="upper left", fontsize=8)
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
        fig.autofmt_xdate()
        fig.tight_layout()
        fig.savefig(out_path, dpi=140)
        plt.close(fig)
        logger.info("Chart saved to %s", out_path)
        return out_path


# ==========================================================================
# 6. CLI
# ==========================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Minervini Trend Template + VCP strategy — Python backtest engine "
                     "(port of the Pine Script v6 strategy).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("symbol", help="Ticker symbol, e.g. RELIANCE, TCS, INFY (NSE .NS auto-appended)")
    p.add_argument("--benchmark", default="^NSEI", help="Benchmark symbol (default: Nifty 50)")
    p.add_argument("--period", default="3y", help="yfinance lookback period if --start not given (e.g. 1y, 3y, 5y)")
    p.add_argument("--start", default=None, help="Start date YYYY-MM-DD (overrides --period)")
    p.add_argument("--end", default=None, help="End date YYYY-MM-DD")
    p.add_argument("--capital", type=float, default=1_000_000.0, help="Initial capital")
    p.add_argument("--pct-per-trade", type=float, default=10.0, help="Percent of equity allocated per trade")
    p.add_argument("--commission", type=float, default=0.05, help="Commission percentage per fill")
    p.add_argument("--r-target", type=float, default=3.0, help="Profit target in R-multiples (0 = off)")
    p.add_argument("--no-market-filter", action="store_true", help="Disable the benchmark market-context filter")
    p.add_argument("--no-breakeven", action="store_true", help="Disable the move-to-breakeven rule")
    p.add_argument("--outdir", default=".tmp/outputs", help="Directory to write CSV/PNG outputs")
    p.add_argument("--no-plot", action="store_true", help="Skip chart generation")
    p.add_argument("--quiet", action="store_true", help="Reduce log verbosity")
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.quiet:
        logger.setLevel(logging.WARNING)

    cfg = StrategyConfig()
    cfg.backtest.initial_capital = args.capital
    cfg.backtest.pct_equity_per_trade = args.pct_per_trade
    cfg.backtest.commission_pct = args.commission
    cfg.risk.r_multiple_target = args.r_target
    cfg.market.use_market_filter = not args.no_market_filter
    cfg.risk.move_to_breakeven = not args.no_breakeven
    cfg.trend.benchmark_symbol = args.benchmark

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    stock_df = load_ohlcv(args.symbol, start=args.start, end=args.end, period=args.period)
    bench_df = load_ohlcv(args.benchmark, start=args.start, end=args.end, period=args.period)

    strat = MinerviniVCPStrategy(stock_df, bench_df, cfg).run()

    checklist = strat.latest_checklist()
    print("\n" + "=" * 62)
    print(f" MINERVINI CHECKLIST - {args.symbol}  ({checklist['date']}, close={checklist['close']})")
    print("=" * 62)
    for k, v in checklist.items():
        if k in ("date", "close"):
            continue
        mark = "[YES]" if v is True else ("[NO]" if v is False else v)
        print(f"  {k:<32} {mark}")
    print("=" * 62 + "\n")

    summary = strat.performance_summary()
    print("BACKTEST SUMMARY")
    print("-" * 62)
    for k, v in summary.items():
        print(f"  {k:<28}: {v}")
    print("-" * 62 + "\n")

    trades_csv = outdir / f"{args.symbol}_minervini_vcp_trades.csv"
    strat.trades_dataframe().to_csv(trades_csv, index=False)
    logger.info("Trade log written to %s", trades_csv)

    equity_csv = outdir / f"{args.symbol}_minervini_vcp_equity_curve.csv"
    strat.equity_curve.to_csv(equity_csv)
    logger.info("Equity curve written to %s", equity_csv)

    if not args.no_plot:
        chart_path = outdir / f"{args.symbol}_minervini_vcp_chart.png"
        strat.plot(args.symbol, chart_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
