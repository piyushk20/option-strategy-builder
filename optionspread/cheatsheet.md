# Option Spread Strategies Cheat Sheet

Quick-reference decision rules, Greek matrices, arbitrage formulas, and risk heuristics based on Anthony J. Saliba, Joseph C. Corona, and Karen E. Johnson.

---

## 1. Master Strategy Decision Matrix

| Market Forecast | Implied Volatility Outlook | Primary Objective | Recommended Strategy | Chapter |
|---|---|---|---|---|
| **Neutral to Mild Bull** | Steady or Falling | Income / Low Basis | **Covered-Write** | Ch 1 |
| **Moderate Bull** | Neutral / High | Limited Risk Bull | **Bull Call / Bull Put Spread** | Ch 2 |
| **Moderate Bear** | Neutral / High | Limited Risk Bear | **Bear Put / Bear Call Spread** | Ch 2 |
| **Explosive Bull (Timing Unsure)** | Moderate / High (Skew) | Zero-drag Directional | **Reverse-Collar** | Ch 3 |
| **Explosive Bear (Timing Unsure)** | Moderate / High | Zero-drag Directional | **Collar** | Ch 3 |
| **Unhedged Long Stock Threat** | Any | Capital Protection | **Collar Hedge (Synthetic Bull)**| Ch 3 |
| **Explosive Move (Either Way)**| Low / Rising | Volatility Breakout | **Long Straddle / Strangle** | Ch 4 |
| **Stagnant / Sideways (Pinned)**| High / Falling | Income / Time Decay | **Long Butterfly (Call/Put/Iron)**| Ch 5 |
| **Stagnant / Sideways (Range)** | High / Falling | Income / Wider Zone | **Long Condor (Call/Put/Iron)** | Ch 5 |
| **Slow Sideways / Target Move** | Low / Upward Term IV | Time Decay Differential| **Long Calendar (Time Spread)** | Ch 6 |
| **Contratrend Bounce (Oversold)**| Falling from Spike | High-probability Income| **Call Ratio Spread (1:2)** | Ch 7 |
| **Contratrend Pullback (Overbought)**| Falling from Spike| High-probability Income| **Put Ratio Spread (1:2)** | Ch 7 |
| **High-Velocity Breakout (Up)** | Low to Rising | Unlimited Upside Breakout| **Call Backspread (1:2)** | Ch 8 |
| **High-Velocity Breakdown (Down)**| Low to Rising | Panic Breakdown Play | **Put Backspread (1:2)** | Ch 8 |

---

## 2. Core Greeks Reference Matrix

| Strategy | Delta ($\\\\Delta$) | Gamma ($\\\\Gamma$) | Vega ($\\\\nu$) | Theta ($\\\\theta$) | Max Loss Zone |
|---|---|---|---|---|---|
| **Covered-Write** | $+ (0 \\rightarrow 100)$ | Negative | Negative | Positive | Downside to zero |
| **Bull Vertical** | $+ (0 \\rightarrow 100)$ | $+ \\text{ near } K_1, - \\text{ near } K_2$ | $+ \\text{ near } K_1, - \\text{ near } K_2$ | $- \\text{ near } K_1, + \\text{ near } K_2$ | Below $K_1$ |
| **Bear Vertical** | $- (0 \\rightarrow -100)$ | $- \\text{ near } K_1, + \\text{ near } K_2$ | $- \\text{ near } K_1, + \\text{ near } K_2$ | $+ \\text{ near } K_1, - \\text{ near } K_2$ | Above $K_2$ |
| **Collar (Spec.)** | $- (0 \\rightarrow -100)$ | $+ \\text{ near } K_1, - \\text{ near } K_2$ | $+ \\text{ near } K_1, - \\text{ near } K_2$ | $- \\text{ near } K_1, + \\text{ near } K_2$ | Unlimited above $K_2$|
| **Reverse-Collar** | $+ (0 \\rightarrow 100)$ | $- \\text{ near } K_1, + \\text{ near } K_2$ | $- \\text{ near } K_1, + \\text{ near } K_2$ | $+ \\text{ near } K_1, - \\text{ near } K_2$ | Downside to zero |
| **Long Straddle** | $\\approx 0$ at ATM | Positive (Peak) | Positive (High) | Negative (Valley) | At strike $K$ |
| **Short Straddle**| $\\approx 0$ at ATM | Negative (Valley) | Negative (High) | Positive (Peak) | Outside breakevens |
| **Long Butterfly**| $\\approx 0$ at center| Negative at body, + at wings | Negative at body, + at wings | Positive at body, - at wings | Outside wings |
| **Long Calendar** | $\\approx 0$ at strike| Negative at strike | Positive (Term difference) | Positive at strike | Far from strike |
| **Ratio Spread** | Grows in favor | Turns negative near short | Net Negative (Short Vega) | Net Positive (Long Theta)| Beyond short strike |
| **Backspread** | Grows on breakout| Turns positive near long | Net Positive (Long Vega) | Net Negative (Short Theta)| Between strikes |

---

## 3. Mathematical & Pricing Formulas

### 1. Covered-Write
- $\\text{Break-Even} = S_1 - C$
- $\\text{Return to Call} = \\left(\\frac{K}{S_1 - C} - 1\\right) \\times 100\\%$
- $\\text{Return to Unchanged} = \\left(\\frac{S_1}{S_1 - C} - 1\\right) \\times 100\\%$

### 2. Box Spread Arbitrage
- $\\text{Fair Value} = \\frac{K_2 - K_1}{(1 + r)^t}$
- $\\text{Call Spread Value} + \\text{Put Spread Value} = \\text{Box Value}$
- **Bull Spread Decision**:
  - $\\text{Call Spread Ask} + \\text{Put Spread Bid} > \\text{Box Value} \\rightarrow$ **Sell Put Spread**
  - $\\text{Call Spread Ask} + \\text{Put Spread Bid} < \\text{Box Value} \\rightarrow$ **Buy Call Spread**
- **Bear Spread Decision**:
  - $\\text{Call Spread Bid} + \\text{Put Spread Ask} > \\text{Box Value} \\rightarrow$ **Sell Call Spread**
  - $\\text{Call Spread Bid} + \\text{Put Spread Ask} < \\text{Box Value} \\rightarrow$ **Buy Put Spread**

### 3. Jelly Roll Arbitrage
- $\\text{Jelly Roll Value (JR)} = K \\times (d_2 - d_1) \\times \\left(\\frac{r}{360}\\right)$
- $\\text{Call Time Spread (CTS)} - \\text{Put Time Spread (PTS)} = JR$
- **Long Time Spread Decision**:
  - $\\text{CTS Ask} - \\text{PTS Ask} > JR \\rightarrow$ **Put Time Spread is cheap**
  - $\\text{CTS Ask} - \\text{PTS Ask} < JR \\rightarrow$ **Call Time Spread is cheap**

### 4. Ratio Spread Breakeven (1:$N$)
- $\\text{Upper BE (Call Ratio)} = \\frac{(N \\times \\text{Short Call BE}) - (1 \\times \\text{Long Call BE})}{N - 1}$
- $\\text{Lower BE (Put Ratio)} = \\frac{(N \\times \\text{Short Put BE}) - (1 \\times \\text{Long Put BE})}{N - 1}$

---

## 4. Saliba's Golden Rules of Execution

1. **"If You Are Wrong, Get Out!"**
   - Never hope, pray, or rationalize when your market forecast is broken. If technical boundaries or timing constraints fail, close the position immediately.
2. **"There Is No Free Lunch"**
   - Long gamma always costs theta. Positive theta always carries negative gamma or tail risk.
3. **Moneyness Liquidity Rule**
   - Deep ITM options have wide bid-ask spreads because market makers face high hedging delta. Never sell deep ITM spreads into the bid; leg into the synthetic equivalent (box) using tighter OTM options.
4. **The Rolling Mechanic**
   - Roll a winning directional position by **selling vertical spreads** or **selling butterflies**. This banks realized cash, moves the profit zone along with the asset, and reduces risk.
5. **Manage Expiration Day Actively**
   - In time spreads and butterflies, never allow front-month options to expire unmonitored. Automatic exercise turns spreads into unhedged stock positions.
