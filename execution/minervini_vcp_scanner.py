#!/usr/bin/env python3
"""
Minervini Growth Stock Scanner (Trend Template + VCP)
======================================================

A line-by-line Python port of the Pine Script v6 strategy
"Minervini Growth Stock Strategy (Trend Template + VCP)" — converted from a
TradingView *strategy* (single-symbol, bar-by-bar, backtestable) into a
*scanner* (many symbols, evaluated as of the latest bar, no order execution).

WHAT THIS SCRIPT DOES
----------------------
For each ticker in the universe it reproduces, as faithfully as pandas/numpy
allow, the eight logic blocks from the original script:

    1. Trend Template (Stage 2)              -> c1..c6 + trend_template
    2. VCP Detection (shrinking pullbacks)    -> vcp_valid
    3. Trigger Bar ("one-two punch")          -> trigger_bar / trigger_recent
    4. Pivot Point & Breakout                 -> breakout
    5. Risk Management (stop / target)        -> stop_level / target_level
    6. Late-Stage Base Counter                -> base_counter / late_stage
    7. Market Context ("91% rule")            -> market_ok
    8. Code 3 Fundamentals (optional, OFF)    -> code3_ok

A row is flagged as an actionable "ALL SYSTEMS GO" candidate when
`trend_template & vcp_valid & trigger_recent & breakout & market_ok` is True
on the most recent bar — the exact same AND-condition as `longCondition` in
the Pine script (minus `strategy.position_size == 0`, which has no meaning
outside a backtest).
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List

import numpy as np
import pandas as pd

try:
    import yfinance as yf
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "yfinance is required: pip install yfinance --break-system-packages"
    ) from exc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("minervini_vcp")


# ============================================================================
# CONFIG — one field per Pine `input.*()`, grouped exactly as in the source
# ============================================================================
@dataclass
class ScannerConfig:
    # --- 1. Trend Template (Stage 2) ---
    len_sma50: int = 50
    len_sma150: int = 150
    len_sma200: int = 200
    slope_lookback: int = 100          # "200MA trending up" lookback
    min_above_52w_low_pct: float = 25.0
    rs_lookback: int = 252
    rs_min_rating: float = 70.0
    benchmark_symbol: str = "^NSEI"    # Yahoo proxy for Pine default NSE:NIFTY

    # --- 2. VCP Detection ---
    pivot_strength: int = 5
    base_lookback: int = 130
    min_contractions: int = 2
    contraction_tol: float = 0.90

    # --- 3. Trigger Bar ("one-two punch") ---
    narrow_range_len: int = 20
    narrow_range_pct: float = 25.0
    vol_ma_len: int = 50
    low_vol_mult: float = 0.7
    near_ema10_pct: float = 3.0

    # --- 4. Entry / Breakout ---
    breakout_vol_mult: float = 1.5
    trigger_valid_bars: int = 10
    require_52w_high_breakout: bool = False

    # --- 5. Risk Management ---
    stop_buffer_pct: float = 1.0
    r_multiple_target: float = 3.0     # 0 = off

    # --- 6. Late-Stage Base Awareness ---
    late_base_warn_at: int = 4

    # --- 7. Market Context (91% Rule) ---
    use_market_filter: bool = True

    # --- 8. Code 3 Fundamentals (experimental, informational only) ---
    enable_code3: bool = False

    # --- Data / scan mechanics (not in the original script) ---
    history_period: str = "3y"         # yfinance `period`
    request_pause_sec: float = 0.35    # be polite to Yahoo between tickers


# ============================================================================
# INDICATOR PRIMITIVES — pandas/numpy equivalents of the Pine `ta.*` calls
# ============================================================================
def sma(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(length, min_periods=length).mean()


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False, min_periods=length).mean()


def highest(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(length, min_periods=length).max()


def lowest(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(length, min_periods=length).min()


def percent_rank(series: pd.Series, length: int) -> pd.Series:
    """
    Approximation of Pine's ta.percentrank(source, length): for each bar,
    the percentage of the trailing `length` bars (current bar included,
    window size = length + 1) whose value is strictly less than the
    current bar's value.
    """
    window = length + 1

    def _rank(x: np.ndarray) -> float:
        current = x[-1]
        past = x[:-1]
        return float((past < current).sum()) / length * 100.0

    return series.rolling(window, min_periods=window).apply(_rank, raw=True)


def pivot_high(high: pd.Series, left: int, right: int) -> pd.Series:
    """
    Strict local maximum over a symmetric window. Confirmed `right` bars
    after the pivot bar (matches Pine's lag — the value is only known once
    `right` future bars exist).
    """
    n = len(high)
    out = pd.Series(np.nan, index=high.index)
    vals = high.values
    for i in range(left, n - right):
        window = vals[i - left : i + right + 1]
        center = vals[i]
        if center == window.max() and (window == center).sum() == 1:
            out.iloc[i] = center
    return out


def pivot_low(low: pd.Series, left: int, right: int) -> pd.Series:
    n = len(low)
    out = pd.Series(np.nan, index=low.index)
    vals = low.values
    for i in range(left, n - right):
        window = vals[i - left : i + right + 1]
        center = vals[i]
        if center == window.min() and (window == center).sum() == 1:
            out.iloc[i] = center
    return out


def crossover(a: pd.Series, b: pd.Series) -> pd.Series:
    return (a > b) & (a.shift(1) <= b.shift(1))


# ============================================================================
# DATA FETCH
# ============================================================================
def normalize_ticker(raw: str) -> str:
    raw = raw.strip().upper()
    if raw.startswith("^") or "." in raw:
        return raw
    return f"{raw}.NS"


def fetch_history(symbol: str, period: str) -> Optional[pd.DataFrame]:
    try:
        df = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=False)
    except Exception as exc:  # network / yfinance internal errors
        log.warning("yfinance error for %s: %s", symbol, exc)
        return None
    if df is None or df.empty:
        log.warning("No data returned for %s", symbol)
        return None
    df = df.rename(columns=str.lower)
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df[["open", "high", "low", "close", "volume"]].dropna()


def fetch_monthly_ema10(symbol: str, period: str) -> Optional[pd.DataFrame]:
    """
    Reproduces request.security(benchmark, "M", close) and its
    ta.ema(close, 10) using only *completed* calendar months.
    """
    df = fetch_history(symbol, period)
    if df is None:
        return None
    monthly_close = df["close"].resample("ME").last()
    now = pd.Timestamp.now()
    if len(monthly_close) > 0 and monthly_close.index[-1].month == now.month and monthly_close.index[-1].year == now.year:
        monthly_close = monthly_close.iloc[:-1]
    monthly_ema10 = ema(monthly_close, 10)
    out = pd.DataFrame({"month_close": monthly_close, "month_ema10": monthly_ema10})
    out["month_ok"] = out["month_close"] > out["month_ema10"]
    return out


# ============================================================================
# CORE STRATEGY LOGIC
# ============================================================================
class MinerviniVCPScanner:
    def __init__(self, cfg: ScannerConfig):
        self.cfg = cfg
        self._benchmark_daily: Optional[pd.DataFrame] = None
        self._benchmark_monthly: Optional[pd.DataFrame] = None

    # -- shared benchmark data, fetched once for the whole scan run --------
    def load_benchmark(self) -> bool:
        cfg = self.cfg
        self._benchmark_daily = fetch_history(cfg.benchmark_symbol, cfg.history_period)
        self._benchmark_monthly = fetch_monthly_ema10(cfg.benchmark_symbol, cfg.history_period)
        if self._benchmark_daily is None or self._benchmark_monthly is None:
            log.error("Could not load benchmark %s — aborting scan.", cfg.benchmark_symbol)
            return False
        return True

    # -- 1. Trend Template --------------------------------------------------
    def _trend_template(self, df: pd.DataFrame) -> pd.DataFrame:
        cfg = self.cfg
        out = pd.DataFrame(index=df.index)
        out["sma20"] = sma(df["close"], 20)
        out["sma50"] = sma(df["close"], cfg.len_sma50)
        out["sma150"] = sma(df["close"], cfg.len_sma150)
        out["sma200"] = sma(df["close"], cfg.len_sma200)
        out["ema10"] = ema(df["close"], 10)
        out["ema21"] = ema(df["close"], 21)
        out["high52"] = highest(df["high"], 252)
        out["low52"] = lowest(df["low"], 252)

        out["c1_price_above_mas"] = (df["close"] > out["sma150"]) & (df["close"] > out["sma200"])
        out["c2_ma150_above_ma200"] = out["sma150"] > out["sma200"]
        out["c3_ma200_trending_up"] = out["sma200"] > out["sma200"].shift(cfg.slope_lookback)
        out["c4_ma50_above"] = (out["sma50"] > out["sma150"]) & (out["sma50"] > out["sma200"])
        out["c5_above_52w_low"] = df["close"] >= out["low52"] * (1 + cfg.min_above_52w_low_pct / 100)

        # RS rating proxy vs benchmark, aligned on trading dates
        bench = self._benchmark_daily["close"].reindex(df.index).ffill()
        rel_perf = df["close"] / bench
        rs_percentile = percent_rank(rel_perf, cfg.rs_lookback)
        out["rs_percentile"] = rs_percentile
        out["c6_rs_rating"] = rs_percentile > cfg.rs_min_rating

        out["trend_template"] = (
            out["c1_price_above_mas"]
            & out["c2_ma150_above_ma200"]
            & out["c3_ma200_trending_up"]
            & out["c4_ma50_above"]
            & out["c5_above_52w_low"]
            & out["c6_rs_rating"]
        )
        return out

    # -- 2. VCP Detection (stateful — mirrors Pine `var`/array logic) ------
    def _vcp_detection(self, df: pd.DataFrame) -> pd.Series:
        cfg = self.cfg
        n = len(df)
        ph = pivot_high(df["high"], cfg.pivot_strength, cfg.pivot_strength)
        pl = pivot_low(df["low"], cfg.pivot_strength, cfg.pivot_strength)

        third_len = max(round(cfg.base_lookback / 3), 5)
        vol_recent_third = sma(df["volume"], third_len)
        vol_earlier_third = vol_recent_third.shift(third_len)
        volume_contracting = (vol_recent_third < vol_earlier_third).fillna(False)

        last_swing_high = np.nan
        contractions: list[float] = []
        contractions_decreasing = np.full(n, False)

        ph_vals = ph.values
        pl_vals = pl.values

        for i in range(n):
            if not np.isnan(ph_vals[i]):
                last_swing_high = ph_vals[i]

            if not np.isnan(pl_vals[i]) and not np.isnan(last_swing_high) and last_swing_high > pl_vals[i]:
                depth_pct = (last_swing_high - pl_vals[i]) / last_swing_high * 100.0
                contractions.append(depth_pct)
                if len(contractions) > 5:
                    contractions.pop(0)
                last_swing_high = np.nan  # wait for a fresh swing high

            m = len(contractions)
            decreasing = False
            if m >= cfg.min_contractions:
                decreasing = True
                for j in range(m - cfg.min_contractions, m - 1):
                    if contractions[j + 1] >= contractions[j] * cfg.contraction_tol:
                        decreasing = False
                        break
            contractions_decreasing[i] = decreasing

        vcp_valid = pd.Series(contractions_decreasing, index=df.index) & volume_contracting
        return vcp_valid

    # -- 3. Trigger Bar -------------------------------------------------------
    def _trigger_bar(self, df: pd.DataFrame, ema10: pd.Series, vcp_valid: pd.Series) -> pd.DataFrame:
        cfg = self.cfg
        bar_range = df["high"] - df["low"]
        range_rank = percent_rank(bar_range, cfg.narrow_range_len)
        is_narrow_range = range_rank <= cfg.narrow_range_pct
        vol_ma = sma(df["volume"], cfg.vol_ma_len)
        is_low_volume = df["volume"] < vol_ma * cfg.low_vol_mult
        is_near_ema10 = (df["close"] - ema10).abs() / ema10 * 100 <= cfg.near_ema10_pct

        trigger_bar = (is_narrow_range & is_low_volume & is_near_ema10 & vcp_valid).fillna(False)

        # stateful "recency since last trigger bar" — vectorized via ffill of index
        idx_where_true = pd.Series(np.where(trigger_bar, np.arange(len(df)), np.nan), index=df.index)
        last_trigger_idx = idx_where_true.ffill()
        bar_index = pd.Series(np.arange(len(df)), index=df.index)
        gap = bar_index - last_trigger_idx
        trigger_recent = (gap <= cfg.trigger_valid_bars) & last_trigger_idx.notna()

        trigger_bar_low = df["low"].where(trigger_bar).ffill()

        return pd.DataFrame(
            {
                "trigger_bar": trigger_bar,
                "trigger_recent": trigger_recent,
                "trigger_bar_low": trigger_bar_low,
            },
            index=df.index,
        )

    # -- 4. Pivot Point & Breakout -------------------------------------------
    def _breakout(self, df: pd.DataFrame, high52: pd.Series) -> pd.DataFrame:
        cfg = self.cfg
        pivot_price = highest(df["high"].shift(1), cfg.base_lookback)
        vol_ma = sma(df["volume"], cfg.vol_ma_len)
        vol_surge = df["volume"] > vol_ma * cfg.breakout_vol_mult
        new_high_ok = (not cfg.require_52w_high_breakout) | (df["high"] >= high52)
        breakout = crossover(df["close"], pivot_price) & vol_surge & new_high_ok
        return pd.DataFrame(
            {"pivot_price": pivot_price, "breakout": breakout.fillna(False)}, index=df.index
        )

    # -- 6. Late-Stage Base Counter (stateful) -------------------------------
    def _base_counter(self, df: pd.DataFrame, trend_template: pd.Series, sma200: pd.Series) -> pd.Series:
        cfg = self.cfg
        n = len(df)
        counter = np.zeros(n, dtype=int)
        tt = trend_template.fillna(False).values
        close = df["close"].values
        sma200_v = sma200.values
        running = 0
        for i in range(n):
            if tt[i] and (i == 0 or not tt[i - 1]):
                running += 1
            if i >= 19 and not np.isnan(sma200_v[i]) and not np.isnan(sma200_v[i - 19]):
                if close[i] < sma200_v[i] and close[i - 19] < sma200_v[i - 19]:
                    running = 0
            counter[i] = running
        return pd.Series(counter, index=df.index)

    # -- 8. Code 3 fundamentals (optional, informational, best-effort) ------
    def _code3(self, symbol: str) -> dict:
        result = {"eps_accel": None, "sales_accel": None, "margin_accel": None, "code3_ok": None}
        try:
            tkr = yf.Ticker(symbol)
            qfin = tkr.quarterly_financials
            if qfin is None or qfin.empty:
                return result
            revenue_row = next((r for r in qfin.index if "Total Revenue" in r), None)
            net_income_row = next((r for r in qfin.index if r == "Net Income"), None)
            eps_row = None
            qeps = getattr(tkr, "quarterly_earnings", None)
            if revenue_row is not None and len(qfin.columns) >= 5:
                rev = qfin.loc[revenue_row]
                result["sales_accel"] = bool(rev.iloc[0] > rev.iloc[4])
            if revenue_row is not None and net_income_row is not None and len(qfin.columns) >= 5:
                rev = qfin.loc[revenue_row]
                ni = qfin.loc[net_income_row]
                margin = ni / rev
                result["margin_accel"] = bool(margin.iloc[0] > margin.iloc[4])
            if qeps is not None and not qeps.empty and len(qeps) >= 5:
                result["eps_accel"] = bool(qeps["Earnings"].iloc[-1] > qeps["Earnings"].iloc[-5])
            flags = [result["eps_accel"], result["sales_accel"], result["margin_accel"]]
            if all(f is not None for f in flags):
                result["code3_ok"] = all(flags)
        except Exception as exc:
            log.debug("Code3 fetch failed for %s: %s", symbol, exc)
        return result

    # -- full pipeline for one symbol ---------------------------------------
    def scan_symbol(self, raw_symbol: str) -> dict:
        cfg = self.cfg
        symbol = normalize_ticker(raw_symbol)
        df = fetch_history(symbol, cfg.history_period)
        if df is None:
            return {"symbol": symbol, "error": "no_data"}

        min_bars_needed = max(cfg.len_sma200 + cfg.slope_lookback, cfg.rs_lookback, 260)
        if len(df) < min_bars_needed:
            return {
                "symbol": symbol,
                "error": f"insufficient_history ({len(df)} bars, need >= {min_bars_needed})",
            }

        tt = self._trend_template(df)
        vcp_valid = self._vcp_detection(df)
        trig = self._trigger_bar(df, tt["ema10"], vcp_valid)
        brk = self._breakout(df, tt["high52"])
        base_counter = self._base_counter(df, tt["trend_template"], tt["sma200"])
        late_stage = base_counter >= cfg.late_base_warn_at

        # 7. Market context — forward-filled monthly benchmark flag onto daily index
        month_ok_series = self._benchmark_monthly["month_ok"].reindex(
            self._benchmark_monthly["month_ok"].index.union(df.index)
        ).ffill().reindex(df.index).ffill()
        market_ok = (not cfg.use_market_filter) | month_ok_series.fillna(False)

        i = -1  # latest completed bar
        row_close = float(df["close"].iloc[i])
        row_ema10 = float(tt["ema10"].iloc[i])
        trigger_bar_low = trig["trigger_bar_low"].iloc[i]

        long_condition = bool(
            tt["trend_template"].iloc[i]
            and vcp_valid.iloc[i]
            and trig["trigger_recent"].iloc[i]
            and brk["breakout"].iloc[i]
            and market_ok.iloc[i]
        )

        stop_level = target_level = None
        if long_condition:
            base_for_stop = min(trigger_bar_low if not pd.isna(trigger_bar_low) else row_ema10, row_ema10)
            stop_level = base_for_stop * (1 - cfg.stop_buffer_pct / 100)
            risk_per_share = row_close - stop_level
            if cfg.r_multiple_target > 0:
                target_level = row_close + risk_per_share * cfg.r_multiple_target

        code3 = (
            self._code3(symbol)
            if cfg.enable_code3
            else {"eps_accel": None, "sales_accel": None, "margin_accel": None, "code3_ok": None}
        )

        result = {
            "symbol": symbol.replace(".NS", ""),
            "raw_symbol": symbol,
            "as_of": df.index[i].strftime("%Y-%m-%d"),
            "close": round(row_close, 2),
            "sma50": round(float(tt["sma50"].iloc[i]), 2) if not pd.isna(tt["sma50"].iloc[i]) else 0.0,
            "sma150": round(float(tt["sma150"].iloc[i]), 2) if not pd.isna(tt["sma150"].iloc[i]) else 0.0,
            "sma200": round(float(tt["sma200"].iloc[i]), 2) if not pd.isna(tt["sma200"].iloc[i]) else 0.0,
            "ema10": round(float(tt["ema10"].iloc[i]), 2) if not pd.isna(tt["ema10"].iloc[i]) else 0.0,
            "c1_price_above_mas": bool(tt["c1_price_above_mas"].iloc[i]),
            "c2_ma150_above_ma200": bool(tt["c2_ma150_above_ma200"].iloc[i]),
            "c3_ma200_trending_up": bool(tt["c3_ma200_trending_up"].iloc[i]),
            "c4_ma50_above": bool(tt["c4_ma50_above"].iloc[i]),
            "c5_above_52w_low": bool(tt["c5_above_52w_low"].iloc[i]),
            "c6_rs_rating": bool(tt["c6_rs_rating"].iloc[i]) if not pd.isna(tt["c6_rs_rating"].iloc[i]) else None,
            "rs_percentile": round(float(tt["rs_percentile"].iloc[i]), 1) if not pd.isna(tt["rs_percentile"].iloc[i]) else None,
            "trend_template": bool(tt["trend_template"].iloc[i]),
            "vcp_valid": bool(vcp_valid.iloc[i]),
            "trigger_bar": bool(trig["trigger_bar"].iloc[i]),
            "trigger_recent": bool(trig["trigger_recent"].iloc[i]),
            "pivot_price": round(float(brk["pivot_price"].iloc[i]), 2) if not pd.isna(brk["pivot_price"].iloc[i]) else None,
            "breakout": bool(brk["breakout"].iloc[i]),
            "market_ok": bool(market_ok.iloc[i]),
            "base_counter": int(base_counter.iloc[i]),
            "late_stage": bool(late_stage.iloc[i]),
            "code3_eps_accel": code3["eps_accel"],
            "code3_sales_accel": code3["sales_accel"],
            "code3_margin_accel": code3["margin_accel"],
            "code3_ok": code3["code3_ok"],
            "stop_level": round(stop_level, 2) if stop_level is not None else None,
            "target_level": round(target_level, 2) if target_level is not None else None,
            "long_condition": long_condition,
        }
        return result


# ============================================================================
# CLI / REPORTING
# ============================================================================
def load_universe(args: argparse.Namespace) -> list[str]:
    tickers: list[str] = []
    if args.tickers:
        tickers.extend(t for t in args.tickers.split(",") if t.strip())
    if args.tickers_file:
        with open(args.tickers_file, "r", encoding="utf-8") as fh:
            tickers.extend(line.strip() for line in fh if line.strip() and not line.startswith("#"))
    if not tickers:
        raise SystemExit(
            "No tickers provided. Use --tickers RELIANCE,TCS,INFY or --tickers-file path.txt"
        )
    seen, ordered = set(), []
    for t in tickers:
        u = t.strip().upper()
        if u and u not in seen:
            seen.add(u)
            ordered.append(u)
    return ordered


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Minervini Trend Template + VCP scanner (Pine Script -> Python port).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--tickers", type=str, default="", help="Comma-separated symbols, e.g. RELIANCE,TCS,INFY")
    p.add_argument("--tickers-file", type=str, default="", help="Path to a file with one symbol per line")
    p.add_argument("--benchmark", type=str, default="^NSEI", help="Benchmark symbol (Yahoo Finance ticker)")
    p.add_argument("--history-period", type=str, default="3y", help="yfinance history period, e.g. 2y, 3y, 5y")
    p.add_argument("--rs-min-rating", type=float, default=70.0)
    p.add_argument("--min-above-52w-low", type=float, default=25.0)
    p.add_argument("--min-contractions", type=int, default=2)
    p.add_argument("--contraction-tol", type=float, default=0.90)
    p.add_argument("--pivot-strength", type=int, default=5)
    p.add_argument("--base-lookback", type=int, default=130)
    p.add_argument("--breakout-vol-mult", type=float, default=1.5)
    p.add_argument("--trigger-valid-bars", type=int, default=10)
    p.add_argument("--require-52w-high-breakout", action="store_true")
    p.add_argument("--stop-buffer-pct", type=float, default=1.0)
    p.add_argument("--r-multiple-target", type=float, default=3.0)
    p.add_argument("--late-base-warn-at", type=int, default=4)
    p.add_argument("--no-market-filter", action="store_true", help="Disable the 91%% rule market gate")
    p.add_argument("--enable-code3", action="store_true", help="Fetch best-effort fundamentals (slow, patchy coverage)")
    p.add_argument("--only-signals", action="store_true", help="Print only rows where long_condition is True")
    p.add_argument("--json", type=str, default="", help="Write full results to this JSON path")
    p.add_argument("--csv", type=str, default="", help="Write full results to this CSV path")
    return p


def config_from_args(args: argparse.Namespace) -> ScannerConfig:
    return ScannerConfig(
        benchmark_symbol=args.benchmark,
        history_period=args.history_period,
        rs_min_rating=args.rs_min_rating,
        min_above_52w_low_pct=args.min_above_52w_low,
        min_contractions=args.min_contractions,
        contraction_tol=args.contraction_tol,
        pivot_strength=args.pivot_strength,
        base_lookback=args.base_lookback,
        breakout_vol_mult=args.breakout_vol_mult,
        trigger_valid_bars=args.trigger_valid_bars,
        require_52w_high_breakout=args.require_52w_high_breakout,
        stop_buffer_pct=args.stop_buffer_pct,
        r_multiple_target=args.r_multiple_target,
        late_base_warn_at=args.late_base_warn_at,
        use_market_filter=not args.no_market_filter,
        enable_code3=args.enable_code3,
    )


def main() -> int:
    args = build_arg_parser().parse_args()
    universe = load_universe(args)
    cfg = config_from_args(args)
    scanner = MinerviniVCPScanner(cfg)

    log.info("Loading benchmark %s ...", cfg.benchmark_symbol)
    if not scanner.load_benchmark():
        return 1

    results = []
    for idx, raw in enumerate(universe, start=1):
        log.info("[%d/%d] Scanning %s ...", idx, len(universe), raw)
        try:
            res = scanner.scan_symbol(raw)
        except Exception as exc:
            log.exception("Unhandled error scanning %s", raw)
            res = {"symbol": raw, "error": f"exception: {exc}"}
        results.append(res)
        time.sleep(cfg.request_pause_sec)

    df_out = pd.DataFrame(results)

    errors = df_out[df_out.get("error").notna()] if "error" in df_out.columns else pd.DataFrame()
    ok = df_out[df_out.get("error").isna()] if "error" in df_out.columns else df_out

    if not errors.empty:
        log.warning("Could not evaluate %d/%d symbols:", len(errors), len(universe))
        for _, r in errors.iterrows():
            log.warning("  %s -> %s", r["symbol"], r["error"])

    display_cols = [
        "symbol", "as_of", "close", "trend_template", "vcp_valid",
        "trigger_recent", "breakout", "market_ok", "base_counter",
        "late_stage", "long_condition", "stop_level", "target_level",
    ]
    display_cols = [c for c in display_cols if c in ok.columns]

    view = ok[ok["long_condition"]] if args.only_signals and "long_condition" in ok.columns else ok

    print("\n" + "=" * 100)
    print(f"MINERVINI VCP SCAN — {len(ok)} symbols evaluated, {len(errors)} errors, "
          f"benchmark={cfg.benchmark_symbol}, as of {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 100)
    if view.empty:
        print("No rows to display" + (" (no ALL-SYSTEMS-GO signals today)" if args.only_signals else "."))
    else:
        with pd.option_context("display.max_rows", None, "display.width", 160):
            print(view[display_cols].to_string(index=False))
    print("=" * 100)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=2, default=str)
        log.info("Wrote JSON results to %s", args.json)

    if args.csv:
        df_out.to_csv(args.csv, index=False)
        log.info("Wrote CSV results to %s", args.csv)

    return 0


if __name__ == "__main__":
    sys.exit(main())
