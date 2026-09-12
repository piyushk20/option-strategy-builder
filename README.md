# 📈 Elite Option Strategy Builder

An institutional-grade, full-stack options strategy builder tailored specifically for the Indian Equity Derivatives Market (NSE). Built with a blazing fast FastAPI Python backend and a highly polished React + Vite frontend, this application provides sophisticated options analysis with live market data.

![Elite Option Strategy Builder Dashboard](https://github.com/piyushk20/option-strategy-builder/blob/master/screenshot.png?raw=true)

## 🚀 Key Features

- **Live NSE Options Chain Integration**: Real-time fetching of National Stock Exchange (NSE) indices and 215 F&O stocks with zero blocking.
- **⚡ Elder Impulse Pro Scanner**: Multi-indicator confluence scanner combining Dr. Alexander Elder's Impulse System (`EMA(13) + MACD Hist`), Supertrend (`Factor 3.0, ATR 10`), and Wilder's `ADX(14) ≥ 25` / `DMI`. Features multi-universe scanning (**Nifty 50**, **Nifty 200**, **Midcap**, **Smallcap**) and multi-timeframe analysis (**1 Hour**, **4 Hours**, **1 Day**, **1 Week**).
- **🔥 Advanced High Momentum Stock Scanner**: Institutional swing/momentum scanner implementing Dhan's 3-step checklist: EMA Stack Alignment (`20 > 50 > 200 EMA`), Trend Strength (`Wilder's ADX(14) ≥ 20`), and Comparative Relative Strength (`CRS` outperformance vs Nifty 50). Renders Target Price (60% profit booking), Stop Loss (50 EMA), Trailing Exit Rules, Composite Score, and direct Strategy Trading integration.
- **📊 Open Interest (OI) Bar Graph & Insights**: Dhan.co-styled interactive chart displaying grouped **Call OI (Gold)** vs **Put OI (Purple)** per strike around ATM, with vertical ATM reference line, top summary metrics (Total Put OI, Total Call OI, PCR, Max Pain, ATM IV), strike range selectors, and Total OI vs Change in OI toggles.
- **⚡ Futures Buildup Tracker**: Dedicated dashboard fetching live Stock & Index Futures contracts from NSE, structured into 4 positioning quadrants:
  - **Long Build-up** (Price Rise + OI Rise) — Bullish Buyers
  - **Short Build-up** (Price Fall + OI Rise) — Bearish Sellers
  - **Long Unwinding** (Price Fall + OI Fall) — Longs Liquidating
  - **Short Covering** (Price Rise + OI Fall) — Shorts Liquidating
  Renders **Symbol**, **Instrument Name** (`Stock Futures` / `Index Futures` + Expiry Date), **LTP** (with % Price Change), **OI (Contracts)**, **% Change in OI**, and **Action** button.
- **Change in Open Interest (OI) Momentum Scanner**: Interactive dashboard tracking F&O contracts with the highest positioning shifts across all 4 momentum quadrants.
- **Dynamic Lot Size Synchronization**: Pulls and caches exact F&O lot sizes directly from the Zerodha Kite Instruments API for precise `Per Lot` P&L calculations.
- **Elite Strategist Engine**: Automatically computes and ranks the top directional (buying) and non-directional (selling) strategies based on the current Put-Call Ratio (PCR) and Max Pain metrics.
- **Advanced Strategy Templates**: Single-click setup for complex, professional-grade strategies:
  - Z.E.B.R.A (Zero Extrinsic Back Ratio)
  - Synthetic Long/Short Futures
  - Ratio Backspreads (Call & Put)
  - Iron Condors & Straddles
  - Bull/Bear Credit & Debit Spreads
- **Interactive Payoff Graphing**: Visually models the exact mathematical payoff curve (both at Expiration and Today) for complex multi-leg setups.
- **Institutional-Grade UI/UX**: Engineered with a custom Glassmorphic design system, `Inter` and `JetBrains Mono` dual-typography, and seamless hover interactions.

---

## 🛠️ Technology Stack

- **Backend:** Python, FastAPI, Uvicorn, `nsepython` (for live market scraping)
- **Frontend:** React 18, TypeScript, Vite, Recharts (for dynamic SVG graphing), Lucide-React
- **Styling:** Vanilla CSS 3 with Custom Design Tokens

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- npm or yarn

### 1. Start the Backend (FastAPI)
The backend runs on port `8005`. It serves live NSE data endpoints and mathematical calculations.
```bash
# Navigate to the backend directory
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run the Uvicorn server
python main.py
```
*Verify the backend is running by visiting: `http://localhost:8005/health`*

### 2. Start the Frontend (Vite + React)
The frontend runs on port `5174` and proxies API requests seamlessly to the backend.
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```
*Access the application in your browser at: `http://localhost:5174/`*

---

## 📊 Core Application Workflow

1. **Asset Selection:** Choose any NSE Index (NIFTY, BANKNIFTY) or any of the 215 tradeable F&O Stocks from the top-right dropdown.
2. **Analysis:** Review the Elite Strategist Status Bar to immediately gauge market sentiment via PCR, Max Pain, and Maximum Open Interest Support/Resistance strikes.
3. **Strategy Loading:** Select a predefined institutional strategy from the left sidebar or the highlighted spot cards to instantly populate the workbench.
4. **Customization:** Add, remove, or modify custom option legs (Buy/Sell, Call/Put, Strikes, Quantities). 
5. **Execution Verification:** Analyze the precise Max Loss, Max Profit, Breakeven points, and Risk/Reward (R:R) ratios alongside the live-rendered Payoff Graph before pushing trades to your broker.

---

## 📝 Disclaimer

This application is built for educational and analytical purposes only. Live options trading carries significant financial risk. Always verify data and perform your own mathematical due diligence before risking capital in live markets.
