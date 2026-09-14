---
name: option-covered-writes
description: "Anthony Saliba's framework for Covered-Writes, Buy-Writes, and synthetic short puts. Use when trading equity income, analyzing return to call vs. return to unchanged, rolling covered calls diagonally, and executing defensive unwinds."
---

# Option Covered-Writes & Buy-Writes (Saliba Ch 1)
**Source**: *Option Spread Strategies: Trading Up, Down, and Sideways Markets* by Anthony J. Saliba (Bloomberg Press)

# Chapter 1: The Covered-Write

## Core Idea
A covered-write combines a long underlying stock position with a short call option to generate income via time decay (theta) and provide modest downside protection, in exchange for relinquishing upside appreciation above the strike price. Synthetically, a covered-write is identical in risk, reward, and break-even profile to an outright short put.

## Frameworks Introduced
- **Covered-Write / Buy-Write**: Simultaneous purchase of 100 shares of underlying stock and sale of one call option per 100 shares.
  - *When to use*: When holding a neutral to moderately bullish outlook on an underlying asset and desiring income generation or modest downside cushion.
  - *How*: Buy 100 shares at spot price $S_1$ and sell 1 call at strike $K$ for premium $C$.
  - *Payoff*:
    - $\\text{Maximum Profit} = (K - S_1) + C$ (if $K > S_1$, capped at strike $K$).
    - $\\text{Maximum Loss} = S_1 - C$ (substantial downside risk down to zero).
    - $\\text{Break-Even Point} = S_1 - C$.
  - *Why it works / Failure mode*: Works by converting extrinsic value into cash flow via theta decay. Fails catastrophically in sharp bear markets because the short call premium provides only minimal buffer before exposing the trader to full dollar-for-dollar downside loss.
- **Return to Call vs. Return to Unchanged**: Analytical framework to evaluate trade viability before entry based on whether the stock rises to the strike or remains flat.
  - *When to use*: Pre-trade screening of covered-call candidates.
  - *How*:
    - $\\text{Return to Call} = \\left(\\frac{K}{S_1 - C} - 1\\right) \\times 100\\%$
    - $\\text{Return to Unchanged} = \\left(\\frac{S_1}{S_1 - C} - 1\\right) \\times 100\\%$
- **Synthetic Put Equivalence**: Recognition that a long stock plus short call synthetically replicates a short put: $\\text{Long Stock} + \\text{Short Call} \\equiv \\text{Short Put}$.
  - *When to use*: Risk assessment and rapid position neutralization.
  - *How*: If market turns sharply bearish, buying a put at the same strike and expiration transforms the covered call into a risk-free conversion arbitrage (locking in price and eliminating directional delta).

## Key Concepts
- **Covered Call**: Selling call options against equivalent long shares (1 call per 100 shares), covering assignment risk.
- **Buy-Write**: Entering both the stock purchase and call sale simultaneously as a single package spread.
- **Intrinsic Value**: Amount by which an option is in-the-money ($\max(0, S - K)$ for calls).
- **Extrinsic Value**: Time value and implied volatility premium beyond intrinsic value; decays toward zero at expiration.
- **Theta ($\\\\theta$)**: Rate of theoretical option price erosion per calendar day; positive for covered-write sellers.
- **Delta ($\\\\Delta$)**: Net sensitivity to underlying $1.00 move; for covered-writes, $\\Delta = 100 - (100 \\times \\Delta_{\\text{call}})$.
- **Gamma ($\\\\Gamma$)**: Sensitivity of delta to underlying price changes; peak magnitude occurs at-the-money near expiration.
- **Vega ($\\\\nu$)**: Sensitivity to a 1% change in implied volatility; negative for covered-writes (rising IV hurts the position).
- **Called Away**: The assignment of the short call at expiration when the stock price finishes above strike $K$, requiring delivery of shares.
- **Conversion Arbitrage**: Combining long stock, short call, and long put at the same strike and expiration, locking in carrying cost and eliminating directional risk.

## Mental Models
- **Think of the covered-write as an asymmetric tradeoff**: You sell unlimited upside potential in exchange for a fixed insurance check that only protects a tiny fraction of downside risk.
- **Use short duration for income**: Target options with $\\le 45$ days to expiration where theta decay accelerates non-linearly.
- **Never trade yield over trend**: A huge rate of return on a covered-write is a market warning signal of high risk and elevated implied volatility—never choose a covered-write solely for yield.

## Anti-patterns
- **The "Instant Cash Machine" Trap**: Treating covered-writes as passive "fire-and-forget" trades without planning for downside risk or exit adjustments.
- **Holding through Meltdowns**: Rationalizing that "at least I collected premium" while a stock plummets 30% below the break-even point.
- **Writing OTM Calls on Raging Bulls**: Capping explosive upside on high-momentum growth stocks where outright long stock or call options would generate far superior returns.

## Reference Tables

### Covered-Write Greeks Profile
| Greek | Exposure | Behavior |
|---|---|---|
| **Delta ($\\\\Delta$)** | Positive ($0$ to $+100$) | Grows toward $+100$ as stock falls; drops toward $0$ as stock rises above $K$. |
| **Gamma ($\\\\Gamma$)** | Negative | Delta moves against you: stock drops $\\rightarrow$ delta increases; stock rallies $\\rightarrow$ delta decreases. |
| **Vega ($\\\\nu$)** | Negative | Rising IV increases the short call value, lowering position P&L; falling IV benefits position. |
| **Theta ($\\\\theta$)** | Positive | Daily time decay works in favor of the position, accelerating in final 30–45 days. |

## Worked Example
**Scenario**: Buy 100 shares of XYZ at $100.00 and sell 105 strike 30-day Call at $5.00.
- Net Capital Outlay: $100.00 - $5.00 = $95.00 per share ($9,500 total).
- Break-Even Point: $S_1 - C = $100.00 - $5.00 = $95.00.
- Maximum Profit: $(K - S_1) + C = ($105.00 - $100.00) + $5.00 = $10.00 ($1,000 total).
- Return to Call: $\\left(\\frac{105}{100 - 5} - 1\\right) \\times 100\\% = \\left(\\frac{105}{95} - 1\\right) \\times 100\\% = 10.53\\%$.
- Return to Unchanged: $\\left(\\frac{100}{100 - 5} - 1\\right) \\times 100\\% = \\left(\\frac{100}{95} - 1\\right) \\times 100\\% = 5.26\\%$.
- Greek calculation: With stock at $100 and Call delta 0.50, Position Delta = $100 + (100 \\times -0.50) = +50$ shares equivalent. If Call gamma is $0.10$, a $1 move up changes Call delta to $0.60$, shifting Position Delta to $100 - 60 = +40$ shares.

## Trade Management & Adjustments
1. **Underlying Moves Up Through Strike**:
   - *Roll Up (Same Expiration)*: Buy back short call and sell higher strike call (buy vertical call spread). Adds to cost basis but frees upside.
   - *Roll Up and Out (Diagonal)*: Buy back near-term short call and sell higher strike call in deferred month. Often done for flat or credit.
2. **Underlying Weakens / Moves Lower**:
   - *Roll Down (Same Expiration)*: Sell vertical call spread to buy back existing call and sell lower strike call, collecting additional credit to lower breakeven.
   - *Roll Down and Out (Diagonal)*: Buy back near-term call and sell lower strike call in deferred month for a substantial credit cushion.
3. **Emergency Liquidation**:
   - Outright sale of stock and buy-back of call.
   - Or buy put at same strike and expiration to create a conversion arbitrage, locking in position value immediately without slippage.

## Key Takeaways
1. A covered-write is synthetically a short put; it carries large downside risk and capped upside.
2. The optimal entry regime is neutral to moderately bullish with elevated IV that is expected to stabilize or fall.
3. Keep trades on a short duration ($\le 45$ days) to maximize theta capture and limit duration of downside exposure.
4. Active management is mandatory: roll up when tested on upside, roll down when tested on downside, or exit immediately if the thesis breaks.

## Connects To
- **Ch 2 Verticals**: Rolling covered-writes up or down is executed via vertical spreads.
- **Ch 3 Collars**: Adding a protective put to a covered-write converts it into a collar (synthetic vertical spread).

