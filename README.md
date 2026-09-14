# 📈 Elite Option Strategy Builder

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![NSE India](https://img.shields.io/badge/NSE_India-Live_Derivatives-orange?style=for-the-badge)](https://www.nseindia.com)

An institutional-grade, full-stack quantitative options strategy builder and derivatives analytics platform designed for the **National Stock Exchange of India (NSE)**. Powered by a high-performance **FastAPI** backend and an institutional **React + Vite** frontend, the platform features real-time option chains, complete Black-Scholes Greeks simulation, institutional momentum screeners, and automated algorithmic strategy recommendations grounded in literature by **Anthony J. Saliba**, **Dr. Alexander Elder**, and **Mark Minervini**.

---

## 🚀 Key Features

### 1. 🎯 Near-ATM Open Interest Concentration (ATM ± 3 / ± 5 Strikes)
- **Top Summary Tab Above Option Chain**: Instantly analyzes the high-leverage near-the-money zone:
  - **Call OI (ATM + 3 Strikes)**: Aggregated Call Open Interest & Change in OI across ATM and the 3 consecutive strikes on the Call side (Resistance Zone).
  - **Put OI (ATM + 3 Strikes)**: Aggregated Put Open Interest & Change in OI across ATM and the 3 consecutive strikes on the Put side (Support Zone).
  - **Near-ATM PCR & Net Bias**: Real-time Put-Call Ratio for the near-ATM strikes with dynamic sentiment indicators (`🟢 BULLISH Support`, `🔴 BEARISH Resistance`, `🟡 NEUTRAL Consolidation`).
  - **Visual OI Concentration Bar**: Proportional dual-color progress bar showing relative Call vs Put concentration.
  - **ATM Micro-Matrix Table**: 7-row compact matrix with highlighted ATM row, proportional volume bars, and 1-click execution into the Strategy Workbench.
  - **Custom Depth Switch**: Toggle dynamically between **ATM ± 3 Strikes** and **ATM ± 5 Strikes**.

### 2. 📚 Anthony Saliba Institutional Spreads Framework
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

### 3. 📉 Interactive Payoff Profile with Time & Price Sliders
- **Real-Time SVG Payoff Curve**: Plots exact mathematical P&L at Expiration, Today, and at a Simulated Target Date.
- **Target Expiration Date Slider**: Simulate multi-day Black-Scholes Greek decay ($\theta$) day-by-day.
- **Target Price Movement Slider**: Dynamically stress-test setups from $-10\%$ to $+10\%$ underlying spot movements.
- **Aggregate Greeks Engine**: Real-time Delta ($\Delta$), Gamma ($\Gamma$), Theta ($\Theta$), Vega ($\nu$), and Rho ($\rho$).

### 4. ⚡ Option Chain Analyzer (Sameer Dharaskar Methodology)
- Dedicated multi-expiry strike matrix tracking institutional positioning, Net OI Shifts, Volume Spurts, and Strike Trends.
- Automatic ATM centering with live polling support.

### 5. 🔍 Institutional Technical Screeners
- **Elder Impulse Pro Scanner**: Multi-indicator confluence combining Dr. Alexander Elder's Impulse System (`EMA(13) + MACD Hist`), Welles Wilder's `ADX(14) ≥ 25` / `DMI`, and Supertrend (`Factor 3.0, ATR 10`) across multiple timeframes (1H, 4H, 1D, 1W) and universes (**Nifty 50**, **Nifty 200**, **Midcap**, **Smallcap**).
- **High Momentum Stock Scanner**: Dhan's 3-step momentum checklist: EMA Stack Alignment (`20 > 50 > 200 EMA`), Trend Strength (`Wilder's ADX ≥ 20`), and Comparative Relative Strength (`CRS` vs Nifty 50) with target pricing and stop-loss rules.
- **Minervini Volatility Contraction Pattern (VCP) Screener**: 8-stage trend template screener with regression slope modeling and an interactive backtest lab.
- **Futures Positioning Quadrants**: Real-time NSE Futures tracker grouping contracts into **Long Buildup**, **Short Buildup**, **Long Unwinding**, and **Short Covering**.

---

## 🛠️ Technology Stack & Architecture

| Layer | Technologies | Port | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, NumPy, SciPy | `8005` | RESTful API, Black-Scholes Greeks, live NSE data ingestion, Saliba Strategist engine |
| **Frontend** | React 18, TypeScript, Vite, Recharts, Lucide-React | `5174` | Strategy Workbench, Near-ATM OI tab, Payoff profile, dynamic glassmorphic UI |
| **Data Synchronization** | NSE India v3 API, Zerodha Kite Instruments | — | Live options chain, automated daily lot size caching, multi-timeframe OHLCV |

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
*Health check:* Visit `http://127.0.0.1:8005/health` (returns `{"status": "ok"}`).

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

### 3. Build for Production
```bash
cd frontend
npm run build
```

---

## 📖 Strategy Workbench Workflow

1. **Asset Selection**: Pick any of the major NSE indices (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY) or 215 tradeable F&O stocks.
2. **Near-ATM OI Analysis**: Review the tab directly above the Option Chain for immediate Call vs Put dominance across ATM ± 3 strikes.
3. **Strategist Recommendation**: View automated Saliba recommendations ranked by market structure, PCR, and Max Pain.
4. **Predefined Templates**: 1-click loading of Equity Collars, Reverse-Collars, Spreads, Butterflies, Condors, Straddles, or ZEBRA structures.
5. **Interactive Payoff Simulation**: Use the Date and Price sliders to test Greeks decay and volatility impact before executing.

---

## 📄 Further Reading

For an in-depth explanation of the trading literature, Black-Scholes mathematics, and institutional frameworks implemented across this codebase, refer to [ABOUT.md](./ABOUT.md).

---

## 📝 Disclaimer

This platform is developed strictly for educational and quantitative analysis purposes. Options trading involves substantial risk of capital loss. Always perform your own risk assessments and consult a certified financial advisor before trading live markets.
