import os
import json
import pandas as pd
import numpy as np


# ═══════════════════════════════════════════════════════════════════════════════
# QUANTITATIVE METRIC CALCULATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_quant_metrics(returns: pd.Series, benchmark_returns: pd.Series = None):
    """
    Comprehensive vectorized performance statistics including Alpha, Beta,
    Information Ratio, and monthly returns breakdown.
    """
    clean_r = returns.replace([np.inf, -np.inf], 0.0).fillna(0.0)
    n_bars = len(clean_r)
    if n_bars == 0:
        return _empty_metrics()

    cum_prod = (1 + clean_r).cumprod()
    total_return = (cum_prod.iloc[-1] - 1.0) * 100.0
    years = n_bars / 252.0
    cagr = ((cum_prod.iloc[-1] ** (1.0 / max(years, 0.01))) - 1.0) * 100.0 if cum_prod.iloc[-1] > 0 else -100.0

    daily_std = clean_r.std()
    ann_vol = daily_std * np.sqrt(252) * 100.0
    daily_mean = clean_r.mean()

    sharpe = (daily_mean * np.sqrt(252)) / (daily_std + 1e-9)

    neg_returns = clean_r[clean_r < 0]
    downside_std = neg_returns.std() if len(neg_returns) > 0 else 1e-9
    sortino = (daily_mean * np.sqrt(252)) / (downside_std + 1e-9)

    peak = cum_prod.cummax()
    drawdown = (cum_prod - peak) / peak
    max_dd = abs(float(drawdown.min())) * 100.0

    calmar = (cagr / max_dd) if max_dd > 0 else 0.0

    non_zero = clean_r[clean_r != 0]
    win_rate = (len(clean_r[clean_r > 0]) / len(non_zero) * 100.0) if len(non_zero) > 0 else 0.0

    # ── Alpha & Beta vs Benchmark ──────────────────────────────────────────────
    alpha, beta, info_ratio = 0.0, 1.0, 0.0
    if benchmark_returns is not None:
        bench = benchmark_returns.replace([np.inf, -np.inf], 0.0).fillna(0.0)
        bench = bench.reindex(clean_r.index, method="ffill").fillna(0.0)

        cov_matrix = np.cov(clean_r.values, bench.values)
        bench_var = np.var(bench.values) + 1e-12
        beta = cov_matrix[0, 1] / bench_var

        bench_ann = (bench.mean() * 252)
        strat_ann = daily_mean * 252
        rf = 0.06  # 6% Indian risk-free rate proxy

        alpha = (strat_ann - (rf + beta * (bench_ann - rf))) * 100.0

        tracking_error = (clean_r - bench).std() * np.sqrt(252)
        excess_return = (daily_mean - bench.mean()) * 252
        info_ratio = excess_return / (tracking_error + 1e-9)

    return {
        "total_return": round(float(total_return), 2),
        "cagr": round(float(cagr), 2),
        "sharpe": round(float(sharpe), 2),
        "sortino": round(float(sortino), 2),
        "max_dd": round(float(max_dd), 2),
        "win_rate": round(float(win_rate), 2),
        "volatility": round(float(ann_vol), 2),
        "calmar": round(float(calmar), 2),
        "alpha": round(float(alpha), 2),
        "beta": round(float(beta), 3),
        "info_ratio": round(float(info_ratio), 3),
    }


def _empty_metrics():
    return {k: 0.0 for k in [
        "total_return", "cagr", "sharpe", "sortino", "max_dd",
        "win_rate", "volatility", "calmar", "alpha", "beta", "info_ratio"
    ]}


def compute_monthly_returns(returns: pd.Series) -> dict:
    """
    Returns a dict {year: {month_abbr: pct_return}} for rendering a heatmap.
    """
    clean_r = returns.replace([np.inf, -np.inf], 0.0).fillna(0.0)
    monthly = clean_r.resample("ME").apply(lambda x: (1 + x).prod() - 1) * 100.0
    monthly.index = monthly.index.to_period("M")

    result = {}
    for period, val in monthly.items():
        yr = str(period.year)
        mo = period.strftime("%b")
        result.setdefault(yr, {})[mo] = round(float(val), 2)
    return result


MONTH_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ═══════════════════════════════════════════════════════════════════════════════
# HTML TEARSHEET GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def create_html_tearsheet(asset: str, strategy: str,
                          returns: pd.Series,
                          benchmark_returns: pd.Series,
                          output_path: str):
    """
    Generates a standalone, interactive dark-mode HTML tearsheet featuring:
    - Equity curve vs benchmark
    - Drawdown underwater chart
    - Monthly returns heatmap
    - Full quant metrics panel (Sharpe, Sortino, CAGR, Alpha, Beta, Info Ratio)
    """
    returns = returns.fillna(0.0)
    benchmark_returns = benchmark_returns.fillna(0.0)

    metrics = compute_quant_metrics(returns, benchmark_returns)
    monthly = compute_monthly_returns(returns)

    cum_returns = (1 + returns).cumprod() - 1
    cum_bench = (1 + benchmark_returns).cumprod() - 1

    dates = [d.strftime("%Y-%m-%d") for d in returns.index]
    strat_cum = [round(float(v) * 100.0, 2) for v in cum_returns.values]
    bench_cum = [round(float(v) * 100.0, 2) for v in cum_bench.values]

    rolling_max = (1 + returns).cumprod().cummax()
    drawdown = ((1 + returns).cumprod() - rolling_max) / rolling_max * 100.0
    dd_vals = [round(float(v), 2) for v in drawdown.values]

    # ── Monthly Heatmap HTML ───────────────────────────────────────────────────
    years = sorted(monthly.keys())

    heatmap_rows = ""
    for yr in years:
        row_cells = f"<td class='yr-label'>{yr}</td>"
        for mo in MONTH_ABBRS:
            val = monthly.get(yr, {}).get(mo, None)
            if val is None:
                row_cells += "<td class='cell empty'>—</td>"
            else:
                intensity = min(abs(val) / 5.0, 1.0)  # cap at ±5%
                if val > 0:
                    r, g, b = int(30 * (1 - intensity)), int(180 + 70 * intensity), int(30 * (1 - intensity))
                else:
                    r, g, b = int(180 + 70 * intensity), int(30 * (1 - intensity)), int(30 * (1 - intensity))
                txt_color = "#0f172a" if abs(val) > 2 else "#f8fafc"
                row_cells += f"<td class='cell' style='background:rgb({r},{g},{b});color:{txt_color}'>{val:+.1f}%</td>"
        heatmap_rows += f"<tr>{row_cells}</tr>"

    month_headers = "".join(f"<th>{m}</th>" for m in MONTH_ABBRS)

    # ── Metric color helpers ───────────────────────────────────────────────────
    def cls(val, positive_good=True):
        if positive_good:
            return "positive" if val >= 0 else "negative"
        return "negative" if val >= 0 else "positive"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{asset} — {strategy} Tearsheet</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: #0a0f1e;
      color: #e2e8f0;
      padding: 24px;
      line-height: 1.5;
    }}
    .container {{ max-width: 1280px; margin: 0 auto; }}
    /* Header */
    .header {{
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 1px solid #1e2d4a; padding-bottom: 18px; margin-bottom: 28px;
    }}
    .header h1 {{ font-size: 22px; font-weight: 700; color: #38bdf8; }}
    .header p {{ color: #64748b; font-size: 13px; margin-top: 4px; }}
    .header-right {{ text-align: right; color: #64748b; font-size: 12px; line-height: 1.8; }}
    .badge {{
      display: inline-block; background: #0f2744; color: #38bdf8;
      padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
      margin-top: 6px; border: 1px solid #1e3a5f;
    }}
    /* KPI Cards */
    .kpi-grid {{
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px; margin-bottom: 28px;
    }}
    .kpi {{
      background: #111827; border: 1px solid #1e2d4a; border-radius: 10px;
      padding: 14px 16px;
    }}
    .kpi-label {{ font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; color: #64748b; }}
    .kpi-value {{ font-size: 20px; font-weight: 700; margin-top: 5px; }}
    .positive {{ color: #34d399; }}
    .negative {{ color: #f87171; }}
    .neutral  {{ color: #e2e8f0; }}
    /* Dividers */
    .section-label {{
      font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
      color: #64748b; margin-bottom: 12px; margin-top: 8px;
    }}
    /* Charts */
    .chart-card {{
      background: #111827; border: 1px solid #1e2d4a; border-radius: 10px;
      padding: 20px; margin-bottom: 20px;
    }}
    .chart-title {{ font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 16px; }}
    /* Monthly Heatmap */
    .heatmap-wrap {{ overflow-x: auto; }}
    .heatmap {{
      border-collapse: collapse; width: 100%; font-size: 11px;
    }}
    .heatmap th {{
      background: #0a0f1e; color: #64748b; padding: 6px 8px;
      font-weight: 500; text-align: center; border: 1px solid #1e2d4a;
    }}
    .heatmap td.yr-label {{
      color: #94a3b8; font-weight: 600; padding: 6px 10px;
      background: #111827; border: 1px solid #1e2d4a; white-space: nowrap;
    }}
    .heatmap td.cell {{
      text-align: center; padding: 6px 5px; font-weight: 600;
      border: 1px solid #0a0f1e; border-radius: 3px;
    }}
    .heatmap td.cell.empty {{ background: #111827; color: #334155; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>{asset} &mdash; {strategy.replace("_", " ")}</h1>
        <p>VectorBT Backtest · QuantStats Performance Tearsheet</p>
        <span class="badge">Daily Timeframe · NSE India · 5-Year Lookback</span>
      </div>
      <div class="header-right">
        Period: {dates[0]} → {dates[-1]}<br>
        Benchmark: {asset} Buy &amp; Hold<br>
        Brokerage: 0.05% per trade
      </div>
    </div>

    <!-- KPI Row 1: Returns & Risk -->
    <p class="section-label">Return & Risk Metrics</p>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total Return</div>
        <div class="kpi-value {cls(metrics['total_return'])}">{metrics['total_return']:+.2f}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">CAGR</div>
        <div class="kpi-value {cls(metrics['cagr'])}">{metrics['cagr']:+.2f}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Sharpe Ratio</div>
        <div class="kpi-value {'positive' if metrics['sharpe'] >= 1.0 else 'neutral'}">{metrics['sharpe']:.2f}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Sortino Ratio</div>
        <div class="kpi-value {'positive' if metrics['sortino'] >= 1.0 else 'neutral'}">{metrics['sortino']:.2f}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Max Drawdown</div>
        <div class="kpi-value negative">-{metrics['max_dd']:.2f}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Win Rate</div>
        <div class="kpi-value neutral">{metrics['win_rate']:.1f}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ann. Volatility</div>
        <div class="kpi-value neutral">{metrics['volatility']:.1f}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Calmar Ratio</div>
        <div class="kpi-value {'positive' if metrics['calmar'] >= 0 else 'negative'}">{metrics['calmar']:.2f}</div>
      </div>
    </div>

    <!-- KPI Row 2: Alpha / Beta -->
    <p class="section-label">Benchmark Relative Metrics (vs {asset} Buy &amp; Hold)</p>
    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="kpi">
        <div class="kpi-label">Jensen's Alpha (Ann.)</div>
        <div class="kpi-value {cls(metrics['alpha'])}">{metrics['alpha']:+.2f}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Beta vs Benchmark</div>
        <div class="kpi-value neutral">{metrics['beta']:.3f}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Information Ratio</div>
        <div class="kpi-value {'positive' if metrics['info_ratio'] > 0.3 else 'neutral'}">{metrics['info_ratio']:.3f}</div>
      </div>
    </div>

    <!-- Equity Curve -->
    <div class="chart-card">
      <p class="chart-title">Cumulative Return vs Benchmark (Buy &amp; Hold)</p>
      <canvas id="equityChart" height="80"></canvas>
    </div>

    <!-- Drawdown -->
    <div class="chart-card">
      <p class="chart-title">Drawdown Underwater (%)</p>
      <canvas id="drawdownChart" height="50"></canvas>
    </div>

    <!-- Monthly Returns Heatmap -->
    <div class="chart-card">
      <p class="chart-title">Monthly Returns Heatmap (%)</p>
      <div class="heatmap-wrap">
        <table class="heatmap">
          <thead>
            <tr><th>Year</th>{month_headers}</tr>
          </thead>
          <tbody>
            {heatmap_rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    const DATES = {json.dumps(dates)};
    const STRAT = {json.dumps(strat_cum)};
    const BENCH = {json.dumps(bench_cum)};
    const DD    = {json.dumps(dd_vals)};

    const gridColor = '#1e2d4a';
    const tickColor = '#64748b';

    new Chart(document.getElementById('equityChart'), {{
      type: 'line',
      data: {{
        labels: DATES,
        datasets: [
          {{
            label: '{strategy.replace("_", " ")} (%)',
            data: STRAT,
            borderColor: '#38bdf8',
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            tension: 0.2
          }},
          {{
            label: '{asset} Buy & Hold (%)',
            data: BENCH,
            borderColor: '#475569',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            tension: 0.2
          }}
        ]
      }},
      options: {{
        animation: false,
        responsive: true,
        interaction: {{ mode: 'index', intersect: false }},
        scales: {{
          x: {{ grid: {{ color: gridColor }}, ticks: {{ color: tickColor, maxTicksLimit: 14 }} }},
          y: {{ grid: {{ color: gridColor }}, ticks: {{ color: tickColor, callback: v => v + '%' }} }}
        }},
        plugins: {{ legend: {{ labels: {{ color: '#e2e8f0', font: {{ size: 12 }} }} }} }}
      }}
    }});

    new Chart(document.getElementById('drawdownChart'), {{
      type: 'line',
      data: {{
        labels: DATES,
        datasets: [{{
          label: 'Drawdown (%)',
          data: DD,
          borderColor: '#f87171',
          backgroundColor: 'rgba(248,113,113,0.15)',
          borderWidth: 1.5,
          fill: true,
          pointRadius: 0,
          tension: 0.2
        }}]
      }},
      options: {{
        animation: false,
        responsive: true,
        scales: {{
          x: {{ grid: {{ color: gridColor }}, ticks: {{ color: tickColor, maxTicksLimit: 14 }} }},
          y: {{ grid: {{ color: gridColor }}, ticks: {{ color: tickColor, callback: v => v + '%' }} }}
        }},
        plugins: {{ legend: {{ labels: {{ color: '#e2e8f0', font: {{ size: 12 }} }} }} }}
      }}
    }});
  </script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    return metrics, output_path
