# About Elite Option Strategy Builder

**Elite Option Strategy Builder** is an institutional-grade, full-stack quantitative options analysis and trade engineering platform tailored for the **National Stock Exchange of India (NSE)** derivatives market.

---

## 🏛️ Foundational Literature & Methodological Frameworks

The platform integrates proven mathematical principles and trading literature from world-renowned options traders, quantitative analysts, and momentum strategists:

### 1. Anthony J. Saliba — *Option Spread Strategies* (Bloomberg Press)
The application natively encodes Saliba’s complete spreads curriculum across Chapters 1 through 8:
- **Chapter 1: The Covered-Write & Buy-Write**: Return-to-Call vs. Return-to-Unchanged calculations, diagonal rolls, and defensive unwinds.
- **Chapter 2: Verticals & Box Spread Parity**: Bull/Bear Call & Put Spreads, synthetic vertical equivalents, and European Box Spread Arbitrage (`(Call Debit + Put Credit) vs. Strike Spread`).
- **Chapter 3: Collars & Reverse-Collars**:
  - *Classic Equity Collar*: Long Stock + Long Protective Put ($K_1$) + Short Covered Call ($K_2$) $\equiv$ Synthetic Bull Call Spread.
  - *Speculative Bearish Collar*: Long OTM Put ($K_1$) + Short OTM Call ($K_2$) (zero-theta breakdown setup).
  - *Bullish Reverse-Collar*: Long OTM Call ($K_2$) + Short OTM Put ($K_1$) (exploits high-IV put skew to enter breakout call for net credit or near-zero cost).
  - *Reverse-Collar Hedge*: Short Stock + Long Protective Call ($K_2$) + Short OTM Put ($K_1$) $\equiv$ Synthetic Bear Put Spread.
  - *Saliba Dynamic Adjustment Playbooks*: Trigger-based rolling instructions (`on_target_reached`, `on_adverse_drop`, `on_upside_breakout`, `on_support_threatened`, `on_stalled_consolidation`).
- **Chapter 4: Straddles & Strangles**: Directionless volatility trading, Max Pain straddles, dual-side stop loss discipline, and IV crush harvesting.
- **Chapter 5: Butterflies & Condors**: Range-bound pinning at Max Pain, positive theta decay structures, and synthetic wings.
- **Chapter 6: Calendar Time Spreads**: Term structure implied volatility, intermonth Jelly Roll parity, and early arrival syndrome management.
- **Chapter 7 & 8: Ratio Spreads & Backspreads**: Front Ratios (1:2 / 2:3) for contratrend trades and Volatility Ratio Backspreads for asymmetric breakout explosions.

### 2. Live Open = High / Open = Low (OHL) Momentum Engine (Powered by `jugaad-data`)
- **Direct NSE Exchange Streaming**: Integrates `jugaad-data` directly tapping into NSE's `GetQuoteApi` / `getSymbolDerivativesData` endpoint.
- **100% Authentic Live Data**: Fetches true tick-level `openPrice`, `highPrice`, `lowPrice`, `lastPrice`, `totalTradedVolume`, `openInterest`, `changeinOpenInterest`, and `underlyingValue`.
- **True Mathematical Formulation**:
  $$\text{Open = Low (Bullish)}: \frac{|Open - Low|}{Open} \le 0.25\% \quad \text{and} \quad LTP \ge Open$$
  $$\text{Open = High (Bearish)}: \frac{|Open - High|}{Open} \le 0.25\% \quad \text{and} \quad LTP \le Open$$
- **Institutional Spot-Option Confluence**: Automatically matches spot breakdowns (`Open = High`) with surging Put options (`Open = Low`), and spot breakouts (`Open = Low`) with surging Call options (`Open = Low`), tagging them with `🔥 Confluence`.
- **Dual-Engine Interactive Candlestick Modal**:
  - Native SVG/Canvas 25-candle intraday option engine with green/red bodies, wicks, volume bars, dashed Open price reference line, VWAP curve, and EMA-9 curve.
  - Live TradingView widget integration (`tv.js`) for spot assets (`NSE:NIFTY`, `NSE:TITAN`, etc.).

### 3. Quantsapp-Style Open Interest Visualizer
- **Dual Layout Modes**:
  - Horizontal Bar Visualizer (Quantsapp style) with side-by-side or stacked Call vs Put comparison.
  - Classic Vertical OI distribution layout.
- **Metrics**: Total OI, Net Change in OI, and PCR tracking across all active strike matrices.

### 4. Sameer Dharaskar — Option Chain Analysis Methodology
- **Option Chain Analyzer**: Multi-timeframe tracking of Net Open Interest shifts, Volume spurts, Strike Trend Matrices, and institutional positioning accumulation.
- Real-time strike matrix with ATM auto-detection and color-coded contract activity.

### 5. Dr. Alexander Elder — *Trading for a Living* & The Impulse System
- **Elder Impulse Pro Scanner**: Multi-indicator technical confluence uniting:
  - 13-period Exponential Moving Average (EMA) — measures trend direction.
  - 12/26/9 Moving Average Convergence Divergence (MACD) Histogram — measures market momentum.
  - Welles Wilder’s Average Directional Index ($ADX(14) \ge 25$) and Directional Movement Indicators ($+DI / -DI$).
  - Supertrend Filter (Factor 3.0, ATR 10).
- Universes: Nifty 50, Nifty 200, Midcap 100, Smallcap 100.
- Timeframes: 1 Hour, 4 Hours, 1 Day, 1 Week.

### 6. Mark Minervini — *Trade Like a Stock Market Wizard*
- **Volatility Contraction Pattern (VCP) Screener**:
  - 8-stage Minervini Trend Template (200 SMA slope, 150 SMA, 50 SMA alignment, 52-week high proximity $\le 25\%$, 52-week low $\ge +30\%$).
  - Linear regression slope modeling for moving average validation.
  - Interactive Tearsheet & Checklist Drawer with backtesting logs.

### 7. Institutional Momentum & Market Microstructure (Dhan & Zerodha)
- **High Momentum 3-Step Checklist**:
  1. Exponential Moving Average Stack: $20 > 50 > 200\text{ EMA}$.
  2. Trend Strength: Wilder's $ADX(14) \ge 20$.
  3. Comparative Relative Strength (CRS) vs NIFTY 50 benchmark.
- **Futures Positioning Quadrants**: Real-time classification into Long Buildup, Short Buildup, Long Unwinding, and Short Covering.
- **Zerodha Kite Contract Lot Synchronization**: Automated daily caching of F&O lot sizes for exact per-contract risk/reward computation.

---

## ⚡ Real-Time Option Analytics & Architecture

### Near-ATM Open Interest Concentration (ATM ± 3 / ± 5 Strikes)
Located directly above the Option Chain:
- **Total Call OI (ATM + 3 Strikes)**: Sum of Open Interest and Change in OI across the ATM and 3 consecutive Call strikes (Resistance zone).
- **Total Put OI (ATM + 3 Strikes)**: Sum of Open Interest and Change in OI across the ATM and 3 consecutive Put strikes (Support zone).
- **Near-ATM Put-Call Ratio (PCR)**: Real-time sentiment rating (`BULLISH`, `BEARISH`, `NEUTRAL`) and net contract bias.
- **ATM Micro-Matrix**: 7-row compact strike table with highlighted ATM row, relative volume bars, and 1-click leg execution.

### Interactive Greeks Payoff Simulation Engine
- **Full Black-Scholes Greeks**: Delta ($\Delta$), Gamma ($\Gamma$), Theta ($\Theta$), Vega ($\nu$), and Rho ($\rho$).
- **Target Expiration Slider**: Simulate multi-day time decay ($\theta$) day-by-day towards expiration.
- **Spot Price Movement Slider**: Stress-test portfolio P&L across $-10\%$ to $+10\%$ underlying moves with real-time SVG charting.

---

## 🛠️ Technology Stack & Architecture

| Component | Technologies | Port | Description |
| :--- | :--- | :--- | :--- |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SciPy, NumPy, `jugaad-data` | `8005` | Async API, Black-Scholes Greeks engine, live NSE scraping, Saliba recommendations, OHL engine |
| **Frontend** | React 18, TypeScript, Vite, Recharts, Lucide-React | `5174` | Responsive dark-mode interface, custom SVG payoff charts, live HMR, TradingView charts |
| **Data Engine** | `jugaad-data`, NSE India v3 API, Yahoo Finance, Zerodha Kite instruments | — | Auto-fallback resilient data ingestion with local caching |

---

## 🔒 Security & Performance Guidelines
- All external requests utilize resilient session management with anti-rate-limiting headers and proxy routing.
- Custom security middleware enforces strict `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`.
- Mathematical calculations run synchronously in compiled NumPy/SciPy modules with zero blocking.
