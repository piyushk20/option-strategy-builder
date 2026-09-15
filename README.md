# 📈 Elite Option Strategy Builder

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![jugaad-data](https://img.shields.io/badge/jugaad--data-Live_NSE_Streaming-brightgreen?style=for-the-badge)](https://github.com/jugaad-py/jugaad-data.git)
[![NSE India](https://img.shields.io/badge/NSE_India-Live_Derivatives-orange?style=for-the-badge)](https://www.nseindia.com)

An institutional-grade, full-stack quantitative options strategy builder and derivatives analytics platform designed for the **National Stock Exchange of India (NSE)**. Powered by a high-performance **FastAPI** backend and an institutional **React + Vite** frontend, the platform features real-time option chains, complete Black-Scholes Greeks simulation, live institutional momentum screeners, and automated algorithmic strategy recommendations grounded in literature by **Anthony J. Saliba**, **Dr. Alexander Elder**, and **Mark Minervini**.

---

## 🚀 Key Features

### 1. 🎯 Live Open = High / Open = Low (OHL) Scanner (Powered by `jugaad-data`)
- **Direct NSE Exchange Streaming**: Integrates [`jugaad-data`](https://github.com/jugaad-py/jugaad-data.git) to stream real-time contract quotes directly from NSE's `GetQuoteApi` / `getSymbolDerivativesData` endpoint.
- **100% Authentic Tick-Level Accuracy**:
  - Exact `openPrice`, `highPrice`, `lowPrice`, `lastPrice` (LTP), `totalTradedVolume`, `openInterest`, and `changeinOpenInterest` for every single contract.
  - Zero synthetic heuristics or approximations.
- **Mathematical Formulations**:
  $$\text{Open = Low (Bullish)}: \frac{|Open - Low|}{Open} \le 0.25\% \quad \text{and} \quad LTP \ge Open$$
  $$\text{Open = High (Bearish)}: \frac{|Open - High|}{Open} \le 0.25\% \quad \text{and} \quad LTP \le Open$$
- **Spot-Option Confluence**: Matches spot market breakdowns (`Open = High`) with surging Put options (`Open = Low`), and spot breakouts (`Open = Low`) with surging Call options (`Open = Low`), tagging them with `🔥 Confluence`.
- **Dual-Engine Candlestick Chart Modal**:
  - Native SVG/Canvas intraday candlestick engine with green/red candles, upper/lower wicks, color-coded volume bars, dashed Open reference line, VWAP curve, and EMA-9 curve.
  - Live embedded TradingView widget (`tv.js`) for underlying spot indices and stocks (`NSE:NIFTY`, `NSE:BANKNIFTY`, `NSE:TITAN`, etc.).
  - 1-click strategy builder export to load winning contracts directly into the Option Workbench.

### 2. 📊 Quantsapp-Style Open Interest Visualizer
- **Dual Layout Options**:
  - Quantsapp-style Horizontal Bar Visualizer: Side-by-side comparative Call vs Put OI bars centered on strike prices.
  - Classic Vertical Bar layout with strike-level volume distribution.
- **Total OI & Net OI Change Modes**: Instant visualization of support and resistance walls.

### 3. 🎯 Near-ATM Open Interest Concentration (ATM ± 3 / ± 5 Strikes)
- **Top Summary Tab Above Option Chain**: Instantly analyzes the high-leverage near-the-money zone:
  - **Call OI (ATM + 3 Strikes)**: Aggregated Call Open Interest & Change in OI across ATM and the 3 consecutive strikes on the Call side (Resistance Zone).
  - **Put OI (ATM + 3 Strikes)**: Aggregated Put Open Interest & Change in OI across ATM and the 3 consecutive strikes on the Put side (Support Zone).
  - **Near-ATM PCR & Net Bias**: Real-time Put-Call Ratio for the near-ATM strikes with dynamic sentiment indicators (`🟢 BULLISH Support`, `🔴 BEARISH Resistance`, `🟡 NEUTRAL Consolidation`).
  - **Visual OI Concentration Bar**: Proportional dual-color progress bar showing relative Call vs Put concentration.
  - **ATM Micro-Matrix Table**: 7-row compact matrix with highlighted ATM row, proportional volume bars, and 1-click execution into the Strategy Workbench.
  - **Custom Depth Switch**: Toggle dynamically between **ATM ± 3 Strikes** and **ATM ± 5 Strikes**.

### 4. 📚 Anthony Saliba Institutional Spreads Framework
Direct implementation of Anthony J. Saliba’s *Option Spread Strategies* (Bloomberg Press):
- **Chapter 1: The Covered-Write / Buy-Write**: Equity income optimization, return-to-call vs return-to-unchanged, and diagonal rolling rules.
- **Chapter 2: Verticals & Box Spread Parity**: Bull/Bear Call & Put Spreads, synthetic equivalents, and real-time European Box Spread Arbitrage detection.
- **Chapter 3: Collars & Reverse-Collars**:
  - **Classic Equity Collar**: Long Stock + Long Protective Put ($K_1$) + Short Covered Call ($K_2$) $\equiv$ Synthetic Bull Call Spread (Defined Risk).
  - **Speculative Bearish Collar**: Long OTM Put ($K_1$) + Short OTM Call ($K_2$) with no stock (zero-theta breakdown setup).
  - **Bullish Reverse-Collar**: Long OTM Call ($K_2$) + Short OTM Put ($K_1$) (exploits equity IV skew for net credit / near-zero cost breakout participation).
  - **Reverse-Collar Hedge**: Short Stock + Long Protective Call ($K_2$) + Short OTM Put ($K_1$) $\equiv$ Synthetic Bear Put Spread.
  - **Dynamic Adjustment Playbooks**: Encoded rule triggers (`on_target_reached`, `on_adverse_drop`, `on_upside_breakout`, `on_support_threatened`, `on_stalled_consolidation`).
- **Chapter 4: Straddles & Strangles**: Max Pain straddle harvesting, volatility crush setups, and strict dual-side stop loss discipline.
- **Chapter 5: Butterflies & Condors**: Iron Butterflies, Long Butterflies, and Iron Condors with wing adjustments.
- **Chapter 6: Calendar Spreads**: Term structure volatility plays, intermonth Jelly Roll parity, and early arrival management.
- **Chapter 7 & 8: Ratio Spreads & Backspreads**: Front Ratios (1:2 & 2:3) for contratrend trading and Volatility Ratio Backspreads for high-velocity breakout trading.

### 5. 📉 Interactive Payoff Profile with Time & Price Sliders
- **Real-Time SVG Payoff Curve**: Plots exact mathematical P&L at Expiration, Today, and at a Simulated Target Date.
- **Target Expiration Date Slider**: Simulate multi-day Black-Scholes Greek decay ($\theta$) day-by-day.
- **Target Price Movement Slider**: Dynamically stress-test setups from $-10\%$ to $+10\%$ underlying spot movements.
- **Aggregate Greeks Engine**: Real-time Delta ($\Delta$), Gamma ($\Gamma$), Theta ($\Theta$), Vega ($\nu$), and Rho ($\rho$).

### 6. 🔍 Institutional Technical Screeners
- **Elder Impulse Pro Scanner**: Multi-indicator confluence combining Dr. Alexander Elder's Impulse System (`EMA(13) + MACD Hist`), Welles Wilder's `ADX(14) ≥ 25` / `DMI`, and Supertrend (`Factor 3.0, ATR 10`) across multiple timeframes (1H, 4H, 1D, 1W) and universes (**Nifty 50**, **Nifty 200**, **Midcap**, **Smallcap**).
- **High Momentum Stock Scanner**: Dhan's 3-step momentum checklist: EMA Stack Alignment (`20 > 50 > 200 EMA`), Trend Strength (`Wilder's ADX ≥ 20`), and Comparative Relative Strength (`CRS` vs Nifty 50) with target pricing and stop-loss rules.
- **Minervini Volatility Contraction Pattern (VCP) Screener**: 8-stage trend template screener with regression slope modeling and an interactive backtest lab.
- **Futures Positioning Quadrants**: Real-time NSE Futures tracker grouping contracts into **Long Buildup**, **Short Buildup**, **Long Unwinding**, and **Short Covering**.

---

## 🛠️ Technology Stack & Architecture

| Layer | Technologies | Port | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, NumPy, SciPy, `jugaad-data` | `8005` | RESTful API, Black-Scholes Greeks, live NSE data ingestion, Saliba Strategist engine, OHL engine |
| **Frontend** | React 18, TypeScript, Vite, Recharts, Lucide-React | `5174` | Strategy Workbench, Near-ATM OI tab, Payoff profile, OHL Scanner, dynamic glassmorphic UI |
| **Data Synchronization** | `jugaad-data`, NSE India v3 API, Zerodha Kite Instruments | — | Live options streaming, automated daily lot size caching, multi-timeframe OHLCV |

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- npm or yarn

### 1. Start the Backend Server (FastAPI)
The backend runs on port `8005`.
```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start backend server
python main.py
```
*Health check:* Visit `http://127.0.0.1:8005/health` (returns `{"status": "healthy"}`).

### 2. Start the Frontend Dev Server (Vite + React)
The frontend runs on port `5174` and proxies `/api` requests to port `8005`.
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*Application URL:* Open `http://localhost:5174/` in your browser.

---

## 📖 Further Reading

For an in-depth explanation of the trading literature, Black-Scholes mathematics, and institutional frameworks implemented across this codebase, refer to [ABOUT.md](./ABOUT.md).

---

## 📝 Disclaimer

This platform is developed strictly for educational and quantitative analysis purposes. Options trading involves substantial risk of capital loss. Always perform your own risk assessments and consult a certified financial advisor before trading live markets.
