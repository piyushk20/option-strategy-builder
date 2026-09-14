---
name: option-collars
description: "Anthony Saliba's framework for Equity Collars and Reverse-Collars. Use for low-cost portfolio protection, speculative breakout collars, volatility skew exploitation, and synthetic vertical adjustments."
---

# Option Collars and Reverse-Collars (Saliba Ch 3)
**Source**: *Option Spread Strategies: Trading Up, Down, and Sideways Markets* by Anthony J. Saliba (Bloomberg Press)

# Chapter 3: Collars and Reverse-Collars

## Core Idea
Collars and reverse-collars combine an out-of-the-money long option with an out-of-the-money short option on opposite sides of the market. This structure neutralizes time decay (theta) and vega risk, allowing patient positioning for large-magnitude breakouts without timing decay penalty. When applied to existing equity holdings, collars transform open-ended stock risk into synthetic vertical spreads.

## Frameworks Introduced
- **The Speculative Collar (Bearish)**: Buy OTM Put at lower strike $K_1$, Sell OTM Call at upper strike $K_2$.
  - *When to use*: Expecting a severe breakdown below support, but uncertain of exact timing; want zero or near-zero theta decay while waiting.
  - *Payoff*: Max profit below $K_1$ ($K_1 \\pm \\text{net debit/credit}$); open-ended risk above $K_2$.
- **The Speculative Reverse-Collar (Bullish)**: Buy OTM Call at upper strike $K_2$, Sell OTM Put at lower strike $K_1$.
  - *When to use*: Expecting a sharp upside breakout above resistance; timing is uncertain; want long vega exposure to offset short vega.
  - *Payoff*: Unlimited profit above $K_2$; substantial risk below $K_1$ down to zero.
- **Collar Hedging Framework (Synthetic Verticals)**:
  - $\\text{Long Stock} + \\text{Collar (Long Put } K_1 + \\text{Short Call } K_2) \\equiv \\text{Synthetic Bull Call Spread } (K_1/K_2)$.
  - $\\text{Short Stock} + \\text{Reverse-Collar (Long Call } K_2 + \\text{Short Put } K_1) \\equiv \\text{Synthetic Bear Spread } (K_1/K_2)$.
  - *Why it works*: Converts unhedged equity risk into a protected, bounded synthetic spread during events or high-risk periods.
- **Implied Volatility Skew Exploitation**:
  - *Equity Skew (Smirk)*: OTM puts trade at higher IV than equidistant OTM calls. A reverse-collar sells rich OTM puts to buy cheaper OTM calls, establishing a bullish trade for an initial net credit.
  - *Flat Skew*: Makes bearish collars attractive as OTM calls can fully finance OTM puts.

## Key Concepts
- **Collar**: Long put + short call (bearish speculative or protective long-stock hedge).
- **Reverse-Collar**: Long call + short put (bullish speculative or short-stock hedge).
- **Zero-Cost Collar**: Selecting strikes such that the premium collected from the short option exactly equals the premium paid for the long option.
- **Trigger Price (Pivot Price)**: The technical price level that confirms a breakout; the long option strike must be placed as close to this price as possible.
- **Resistance / Support Anchors**: The structural barrier where the short option is sold; short calls placed at resistance, short puts placed at support.
- **Event Risk**: The danger that an unexpected news gap bypasses stop-loss orders outside market hours.

## Mental Models
- **Think of the collar as self-funding insurance**: The short option pays the premium for the long option, allowing you to hold catastrophe insurance for free.
- **Use collars when you know the destination but not the arrival time**: Eliminating net theta lets you wait out choppy consolidation.
- **Mind the naked tail**: The speculative collar has an uncovered short option; you MUST place stop-losses at key technical boundaries.

## Anti-patterns
- **Ignoring Overnight Gap Risk**: Relying on market stop-loss orders to protect naked short options during earnings announcements or weekend gaps.
- **Placing Long Strikes Far From the Trigger**: Placing the long option too far out-of-the-money, requiring a massive move just to reach breakeven.
- **Leaving Trailing Short Options Open**: Failing to close the worthless short leg after a major breakout, leaving tail risk alive for zero reward.

## Reference Tables

### Collar & Reverse-Collar Structure
| Strategy | Legs | Directional Bias | Theta / Vega | Primary Risk |
|---|---|---|---|---|
| **Collar (Speculative)** | Long $K_1$ Put, Short $K_2$ Call | Bearish | Flat between strikes | Unlimited above $K_2$ |
| **Reverse-Collar (Spec.)**| Short $K_1$ Put, Long $K_2$ Call | Bullish | Flat between strikes | Substantial below $K_1$ |
| **Collar Hedge** | Long Stock + Long $K_1$ Put + Short $K_2$ Call | Synthetic Bull Vertical | Flat | Limited to $S_1 - K_1 - \\text{Credit}$ |
| **Reverse-Collar Hedge** | Short Stock + Short $K_1$ Put + Long $K_2$ Call | Synthetic Bear Vertical | Flat | Limited to $K_2 - S_1 - \\text{Credit}$ |

## Worked Example
**Scenario**: Long 100 shares ABC stock at $125.00 in family trust. Wants downside crash protection with zero capital outlay.
- Stock trading at $125.00.
- 6-month 100 Put trading at $3.00 (downside protection floor).
- 6-month 135 Call trading at $6.50 (overhead upside ceiling).
- Construction: Sell 135 Call at $6.50, Buy 100 Put at $3.00 $\\rightarrow$ **Net Credit collected = $3.50**.
- **Outcomes**:
  - Stock unchanged at $125: Keep $3.50 credit ($350 gain).
  - Stock rallies to $135+: Stock gains $10.00 + $3.50 credit = **Maximum Gain of $13.50** ($1,350).
  - Stock plummets to $80: Downside protected below $100. Effective exit is $100 + $3.50 credit = $103.50. Max loss is $125 - 103.50 = $21.50, saving $23.50 compared to holding stock down to $80.

## Trade Management & Adjustments
1. **Managing Winning Breakouts**:
   - As the underlying breaks out through the long strike, **roll the long option** by selling vertical spreads to extract cash and maintain directional exposure.
   - **Close the trailing short option** once it decays to negligible value to eliminate lingering tail risk.
2. **Managing Unsuccessful Moves**:
   - When the underlying breaches the short option strike, trigger stop-loss orders immediately. Do not hold losing short options.
3. **Position Fails to Trigger by Expiration**:
   - Roll both legs to the next expiration cycle via calendar spreads: buy calendar spread on long option, sell calendar spread on short option.

## Key Takeaways
1. Collars solve the "double whammy" of long options: paying theta and losing value when IV drops.
2. Long stock plus a collar synthesizes a limited-risk bull vertical spread; short stock plus reverse-collar synthesizes a bear vertical spread.
3. Always place the long strike near the trigger/breakout level and the short strike beyond significant support or resistance.
4. Exploit the equity volatility skew: high OTM put IV enables reverse-collars to be opened for net credits.

## Connects To
- **Ch 1 Covered-Write**: A collar is simply a covered-write plus a protective put.
- **Ch 6 Calendar Spreads**: Used to roll collars that fail to trigger before expiration.

