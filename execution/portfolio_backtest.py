"""
Portfolio-Level Backtest (Phase 3.1)
Combines multiple strategies into a single allocated portfolio and compares
against NIFTY Buy & Hold benchmark.
"""
import os
import json
import logging
import pandas as pd
import numpy as np
import vectorbt as vbt

from strategies_vectorbt import (
    compute_vcp_signals,
    compute_elder_impulse_signals,
    compute_high_momentum_signals,
    compute_nday_high_signals,
    compute_iron_condor_signals,
    run_vbt_backtest,
    STRATEGY_RISK_PARAMS,
)
from generate_tearsheets import create_html_tearsheet, compute_quant_metrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("portfolio_backtest")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, ".tmp", "data")
REPORTS_DIR = os.path.join(BASE_DIR, ".tmp", "reports")

# Capital allocation weights per strategy (must sum to 1.0)
PORTFOLIO_WEIGHTS = {
    "Elder_Impulse":      0.35,   # Best risk-adjusted trend follower
    "High_Momentum":      0.30,   # Steady compounder
    "VCP_Breakout":       0.20,   # Low-drawdown breakout
    "Iron_Condor":        0.10,   # Uncorrelated theta harvester
    "NDay_High_Breakout": 0.05,   # Small allocation after ADX fix
}

ASSET_WEIGHTS = {
    "BANKNIFTY": 0.45,   # Highest performer
    "NIFTY":     0.35,
    "RELIANCE":  0.20,
}

STRATEGY_FUNCS = {
    "Elder_Impulse":      compute_elder_impulse_signals,
    "High_Momentum":      compute_high_momentum_signals,
    "VCP_Breakout":       compute_vcp_signals,
    "Iron_Condor":        compute_iron_condor_signals,
    "NDay_High_Breakout": compute_nday_high_signals,
}


def build_combined_portfolio():
    """
    Builds a blended daily return series weighted by strategy + asset allocation.
    """
    os.makedirs(REPORTS_DIR, exist_ok=True)
    all_return_series = []
    weights_applied = []

    for asset, asset_w in ASSET_WEIGHTS.items():
        file_path = os.path.join(DATA_DIR, f"{asset}.csv")
        if not os.path.exists(file_path):
            logger.error(f"Missing: {file_path}. Skip.")
            continue

        df = pd.read_csv(file_path, index_col="Date", parse_dates=True)
        for col in ["Open", "High", "Low", "Close", "Volume"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna()

        for strat_name, strat_func in STRATEGY_FUNCS.items():
            strat_w = PORTFOLIO_WEIGHTS.get(strat_name, 0)
            combined_w = asset_w * strat_w
            if combined_w == 0:
                continue

            logger.info(f"  Portfolio: {asset} × {strat_name}  weight={combined_w:.3f}")
            try:
                entries, exits = strat_func(df)
                risk = STRATEGY_RISK_PARAMS.get(strat_name, {})
                pf = run_vbt_backtest(df, entries, exits,
                                      sl_pct=risk.get("sl_pct"),
                                      tp_pct=risk.get("tp_pct"))
                daily_r = pf.returns().replace([np.inf, -np.inf], 0.0).fillna(0.0)
                all_return_series.append(daily_r * combined_w)
                weights_applied.append(combined_w)
            except Exception as e:
                logger.error(f"Error {asset} × {strat_name}: {e}")

    if not all_return_series:
        logger.error("No return series collected. Aborting portfolio backtest.")
        return None

    # Align all return series to common date index
    combined_df = pd.concat(all_return_series, axis=1).fillna(0.0)
    portfolio_returns = combined_df.sum(axis=1)

    # Benchmark: weighted NIFTY returns
    nifty_df = pd.read_csv(os.path.join(DATA_DIR, "NIFTY.csv"), index_col="Date", parse_dates=True)
    nifty_df["Close"] = pd.to_numeric(nifty_df["Close"], errors="coerce")
    benchmark_returns = nifty_df["Close"].pct_change().fillna(0.0)
    benchmark_returns = benchmark_returns.reindex(portfolio_returns.index, method="ffill").fillna(0.0)

    # Compute metrics
    metrics = compute_quant_metrics(portfolio_returns, benchmark_returns)
    logger.info(f"\n{'='*60}")
    logger.info("COMBINED PORTFOLIO PERFORMANCE")
    logger.info(f"{'='*60}")
    for k, v in metrics.items():
        logger.info(f"  {k:20s}: {v}")

    # Generate tearsheet
    report_path = os.path.join(REPORTS_DIR, "PORTFOLIO_Combined_tearsheet.html")
    create_html_tearsheet(
        asset="Multi-Asset Portfolio",
        strategy="Combined_Strategy_Portfolio",
        returns=portfolio_returns,
        benchmark_returns=benchmark_returns,
        output_path=report_path,
    )
    logger.info(f"Portfolio tearsheet saved → {report_path}")

    # Save metrics JSON
    summary_path = os.path.join(REPORTS_DIR, "portfolio_summary.json")
    with open(summary_path, "w") as f:
        json.dump({"weights": PORTFOLIO_WEIGHTS, "asset_weights": ASSET_WEIGHTS, "metrics": metrics}, f, indent=2)
    logger.info(f"Portfolio summary saved → {summary_path}")

    return metrics


if __name__ == "__main__":
    build_combined_portfolio()
