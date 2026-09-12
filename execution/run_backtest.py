import os
import json
import pandas as pd
import numpy as np
import vectorbt as vbt
import logging

from strategies_vectorbt import (
    compute_vcp_signals,
    compute_elder_impulse_signals,
    compute_high_momentum_signals,
    compute_nday_high_signals,
    compute_bull_call_spread_signals,
    compute_iron_condor_signals,
    compute_max_pain_straddle_signals,
    run_vbt_backtest,
    STRATEGY_RISK_PARAMS,
)
from generate_tearsheets import create_html_tearsheet, compute_quant_metrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_backtest")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, ".tmp", "data")
REPORTS_DIR = os.path.join(BASE_DIR, ".tmp", "reports")

STRATEGIES = {
    "VCP_Breakout":        compute_vcp_signals,
    "Elder_Impulse":       compute_elder_impulse_signals,
    "High_Momentum":       compute_high_momentum_signals,
    "NDay_High_Breakout":  compute_nday_high_signals,
    "Bull_Call_Spread":    compute_bull_call_spread_signals,
    "Iron_Condor":         compute_iron_condor_signals,
    "Max_Pain_Straddle":   compute_max_pain_straddle_signals,
}

ASSETS = ["NIFTY", "BANKNIFTY", "RELIANCE"]


def run_all_backtests():
    os.makedirs(REPORTS_DIR, exist_ok=True)
    summary_results = []

    for asset in ASSETS:
        file_path = os.path.join(DATA_DIR, f"{asset}.csv")
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}. Skipping {asset}.")
            continue

        df = pd.read_csv(file_path, index_col="Date", parse_dates=True)
        for col in ["Open", "High", "Low", "Close", "Volume"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna()

        benchmark_returns = df["Close"].pct_change().fillna(0.0)

        for strat_name, strat_func in STRATEGIES.items():
            logger.info(f"Running: {asset} × {strat_name}  [SL={STRATEGY_RISK_PARAMS[strat_name]['sl_pct']}, TP={STRATEGY_RISK_PARAMS[strat_name]['tp_pct']}]")
            try:
                entries, exits = strat_func(df)

                risk = STRATEGY_RISK_PARAMS.get(strat_name, {})
                pf = run_vbt_backtest(
                    df, entries, exits,
                    sl_pct=risk.get("sl_pct"),
                    tp_pct=risk.get("tp_pct"),
                )

                daily_returns = pf.returns().replace([np.inf, -np.inf], 0.0).fillna(0.0)

                report_filename = f"{asset}_{strat_name}_tearsheet.html"
                report_path = os.path.join(REPORTS_DIR, report_filename)
                metrics, _ = create_html_tearsheet(
                    asset=asset,
                    strategy=strat_name,
                    returns=daily_returns,
                    benchmark_returns=benchmark_returns,
                    output_path=report_path,
                )
                logger.info(
                    f"  ✓ {asset} {strat_name}: Return={metrics['total_return']}% "
                    f"CAGR={metrics['cagr']}% Sharpe={metrics['sharpe']} "
                    f"MaxDD={metrics['max_dd']}% WinRate={metrics['win_rate']}%"
                )

                summary_results.append({
                    "Asset": asset,
                    "Strategy": strat_name,
                    "Total_Return_Pct": metrics["total_return"],
                    "CAGR_Pct": metrics["cagr"],
                    "Sharpe_Ratio": metrics["sharpe"],
                    "Sortino_Ratio": metrics["sortino"],
                    "Max_Drawdown_Pct": metrics["max_dd"],
                    "Win_Rate_Pct": metrics["win_rate"],
                    "Total_Trades": int(len(pf.trades)),
                    "SL_Pct": risk.get("sl_pct"),
                    "TP_Pct": risk.get("tp_pct"),
                    "Tearsheet": report_path,
                })

            except Exception as e:
                logger.error(f"Error on {asset} × {strat_name}: {e}", exc_info=True)

    results_df = pd.DataFrame(summary_results)
    csv_path = os.path.join(REPORTS_DIR, "backtest_summary.csv")
    json_path = os.path.join(REPORTS_DIR, "backtest_summary.json")
    results_df.to_csv(csv_path, index=False)
    with open(json_path, "w") as f:
        json.dump(summary_results, f, indent=2)

    logger.info("\n" + "=" * 70)
    logger.info("BACKTEST SUMMARY (Phase 1 Improved)")
    logger.info("=" * 70)
    logger.info("\n" + results_df.to_string(columns=[
        "Asset", "Strategy", "Total_Return_Pct", "CAGR_Pct",
        "Sharpe_Ratio", "Sortino_Ratio", "Max_Drawdown_Pct", "Win_Rate_Pct", "Total_Trades"
    ]))
    logger.info(f"\nSummary saved → {csv_path}")
    return results_df


if __name__ == "__main__":
    run_all_backtests()
