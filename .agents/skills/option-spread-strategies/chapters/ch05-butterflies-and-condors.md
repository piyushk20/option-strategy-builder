# Chapter 5: Butterflies and Condors

## Core Idea
Butterflies and condors are limited-risk, directionless option structures designed to harvest time decay (theta) and declining volatility within bounded trading ranges. Structurally, a long butterfly is an embedded short straddle wrapped by a protective long strangle; a long condor is an embedded short strangle wrapped by a protective long strangle. They eliminate the catastrophic tail risk of naked short option selling.

## Frameworks Introduced
- **The Long Butterfly Family (+1 / -2 / +1)**:
  - *Long Call Butterfly*: Buy 1 lower call ($K_1$), Sell 2 middle calls ($K_2$), Buy 1 upper call ($K_3$) (where $K_2 - K_1 = K_3 - K_2$).
  - *Long Put Butterfly*: Buy 1 lower put ($K_1$), Sell 2 middle puts ($K_2$), Buy 1 upper put ($K_3$).
  - *Long Iron Butterfly*: Buy 1 lower put ($K_1$), Sell 1 middle put ($K_2$), Sell 1 middle call ($K_2$), Buy 1 upper call ($K_3$).
  - *When to use*: Neutral outlook with price expected to pin near center strike $K_2$ (mean-reversion point).
  - *Payoff*: Max profit at $K_2 = (K_2 - K_1) - \\text{Debit}$; Max loss = Net Debit.
  - *Break-Even*: $K_1 + \\text{Debit}$ and $K_3 - \\text{Debit}$.
- **The Long Condor Family (+1 / -1 / -1 / +1)**:
  - *Long Call Condor*: Buy $K_1$ Call, Sell $K_2$ Call, Sell $K_3$ Call, Buy $K_4$ Call.
  - *Long Put Condor*: Buy $K_1$ Put, Sell $K_2$ Put, Sell $K_3$ Put, Buy $K_4$ Put.
  - *Long Iron Condor*: Buy $K_1$ Put, Sell $K_2$ Put, Sell $K_3$ Call, Buy $K_4$ Call.
  - *When to use*: Directionless market with a wider expected trading range ($K_2$ to $K_3$) rather than a single pin price.
  - *Payoff*: Max profit across the entire $K_2 - K_3$ plateau $= (K_2 - K_1) - \\text{Debit}$.
- **Synthetic Equivalence of Flies and Condors**:
  Call butterflies, put butterflies, and iron butterflies sharing identical strikes and expiration are synthetically identical and possess identical Greeks. The choice of which to trade depends entirely on execution pricing and bid-ask spreads.
- **Dynamic Trade Widening & Narrowing**:
  - *Widen Butterfly into Condor*: Buy an adjacent butterfly at higher or lower strikes to extend coverage.
  - *Narrow Condor into Butterfly*: Sell an embedded butterfly to lock in partial profits and concentrate on a pinning strike.

## Key Concepts
- **Mean-Reversion Area**: The central price level around which an asset oscillates within a consolidation range; ideal location for short middle strikes.
- **Wings**: The outer protective long options ($K_1$ and $K_3/K_4$) that cap maximum loss.
- **Body**: The inside short options ($2 \\times K_2$ or $K_2 + K_3$) that generate positive theta.
- **Iron Structure**: A spread combining both calls and puts (e.g., iron butterfly or iron condor), typically initiated for a net credit.
- **Greek Transition**: Near center strikes, the position exhibits short option Greeks (positive theta, negative gamma, negative vega). Near outer wings, Greeks flip to long option behavior (negative theta, positive gamma, positive vega).

## Mental Models
- **Think of a butterfly as a tent pitched on a support/resistance floor**: The center pole is your target pin price, and the ropes are anchored at support and resistance.
- **Think of condors as paying for margin of error**: You sacrifice maximum peak profit to turn the butterfly's sharp apex into a broad, forgiving plateau.
- **Never wait for expiration day for the last 10%**: In trying to squeeze the final pennies of theta on expiry day, a sudden breakout will forfeit all accumulated gains.

## Anti-patterns
- **Taking Butterflies into High-Volatility Binary Catalysts**: Holding range-bound flies through earnings announcements where a gap outside the wings guarantees maximum loss.
- **Greedily Refusing to Scale Out**: Holding 100% of a butterfly position into the final week rather than taking partial profits when the stock is pinned at the body.
- **Ignoring Wider Wings Cost**: Buying condors with wings spread too wide, increasing upfront cost and destroying reward-to-risk ratio.

## Reference Tables

### Butterfly vs. Condor Comparison
| Strategy | Structure | Profit Zone | Peak Profit | Max Loss | Cost |
|---|---|---|---|---|---|
| **Long Butterfly** | $+1 / -2 / +1$ | Triangle peaked at $K_2$ | Highest (at exact strike $K_2$) | Lowest | Cheaper |
| **Long Condor** | $+1 / -1 / -1 / +1$ | Plateau between $K_2$ & $K_3$| Flat plateau across $K_2 - K_3$ | Moderate | More expensive |

## Worked Example
**Scenario**: Stock DEF is range-bound at $55.00. Support at $52.50, resistance at $57.50.
- Option Prices:
  - 52.5 Put = $0.50 | 55 Put = $1.35 | 57.5 Put = $3.00
- **Long 52.5/55/57.5 Put Butterfly**:
  - Buy 1 52.5 Put ($0.50) + Buy 1 57.5 Put ($3.00) = $3.50 Debit.
  - Sell 2 55 Puts ($1.35 $\\times 2$) = $2.70 Credit.
  - Net Debit = $3.50 - $2.70 = **$0.80** ($80 max loss).
  - Strike Difference: $55.00 - $52.50 = $2.50.
  - Maximum Profit: $2.50 - $0.80 = **$1.70** ($170 per spread, occurring at exactly $55.00).
  - Break-Even Points: $52.50 + $0.80 = **$53.30** and $57.50 - $0.80 = **$56.70**.
- **Adjustment Scenario**: Stock trades up to $57.00. Trader buys 55/57.5/60 Put Butterfly to transform position into a **52.5/55/57.5/60 Put Condor**, expanding the profit plateau to cover $55.00–$57.50.

## Trade Management & Adjustments
1. **Taking Profits & Scaling Out**:
   - Scale out in increments (e.g. close 20–30% of lots) as theta accumulates while stock is pinned at the body.
   - **Synthetic Strangle Exit**: Buy back the short straddle at the center strike at maximum decay, leaving a virtually free long strangle at the wings for tail protection.
2. **Modifying Range**:
   - If stock drifts toward a wing, purchase an adjacent butterfly to convert the structure into a condor, widening the profit zone.
3. **Handling Thesis Breakdown**:
   - If price breaches support or resistance ("lines in the sand"), exit immediately. Accept the limited loss rather than hoping for a reversal.

## Key Takeaways
1. Butterflies and condors provide directionless, short-volatility exposure without naked tail risk.
2. Maximum profit occurs at the center short strike (butterfly) or center plateau (condor).
3. The Greeks shift depending on underlying price: positive theta and negative gamma at the body, negative theta and positive gamma at the wings.
4. Use synthetic relationships to modify positions dynamically: stretch flies into condors, or buy back the inside body to leave a free outside strangle.

## Connects To
- **Ch 4 Straddles and Strangles**: A butterfly is a short straddle wrapped by a long strangle.
- **Ch 2 Verticals**: Verticals are rolled by selling butterflies.
