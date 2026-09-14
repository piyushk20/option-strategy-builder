# Chapter 4: Straddles and Strangles

## Core Idea
Straddles and strangles are pure nondirectional volatility strategies that decouple market direction from market magnitude. Long positions purchase both a call and a put to capture explosive moves and rising implied volatility at the expense of severe theta decay; short positions sell both options to capture time decay and volatility collapses, accepting unlimited tail risk.

## Frameworks Introduced
- **The Long Volatility Spread (Long Straddle & Strangle)**:
  - *Long Straddle*: Buy 1 ATM Call + Buy 1 ATM Put (same strike $K$, same expiration).
  - *Long Strangle*: Buy 1 OTM Call ($K_2$) + Buy 1 OTM Put ($K_1$) ($K_1 < K_2$).
  - *When to use*: Forecasting a massive price breakout (earnings, FDA approval, macro release) or sharp rise in implied volatility from depressed levels.
  - *Payoff*: Unlimited upside profit; substantial downside profit; max loss = total debit paid.
  - *Break-Even*:
    - Straddle: $K + \\text{Debit}$ (upside) and $K - \\text{Debit}$ (downside).
    - Strangle: $K_2 + \\text{Debit}$ (upside) and $K_1 - \\text{Debit}$ (downside).
- **The Short Volatility Spread (Short Straddle & Strangle)**:
  - *Short Straddle*: Sell 1 ATM Call + Sell 1 ATM Put.
  - *Short Strangle*: Sell 1 OTM Call ($K_2$) + Sell 1 OTM Put ($K_1$).
  - *When to use*: Forecasting subdued sideways consolidation or imminent post-event implied volatility collapse (IV crush).
  - *Payoff*: Maximum profit = credit collected; unlimited risk on upside, substantial risk on downside.
- **The "No Free Lunch" Greek Tradeoff**:
  - Long Straddles/Strangles have **positive gamma and negative theta**: Every point the market moves increases delta in your favor, but every passing day bleeds theta.
  - Short Straddles/Strangles have **negative gamma and positive theta**: Every day earns income, but any market move expands delta against you.

## Key Concepts
- **Nondirectional Strategy**: Strategy that does not require forecasting whether price goes up or down, only how far and how fast.
- **Delta-Neutral**: A position whose net delta is approximately zero, eliminating initial directional bias.
- **Gamma Topography**:
  - *Straddle Gamma*: Forms a single sharp peak at the ATM strike near expiration.
  - *Strangle Gamma*: Forms a double-peaked "M" shape clustered at the two wing strikes near expiration.
- **Theta Topography**:
  - *Straddle Theta*: Forms a single deep valley of rapid decay at the ATM strike.
  - *Strangle Theta*: Forms a double-valley "W" shape of peak decay centered at the two strikes.
- **Volatility Crush**: Sudden collapse in implied volatility immediately following a major binary event (e.g. earnings release or regulatory verdict), destroying option prices regardless of price movement.
- **Time Stop-Loss**: A pre-determined date/time to close long volatility positions to prevent fatal theta erosion if the anticipated move fails to happen promptly.

## Mental Models
- **Think of long straddles as paying rent for explosive movement**: If the tenant (the stock) doesn't produce, the rent (theta) will bankrupt you.
- **Think of short straddles as collecting pennies in front of a steamroller**: Time decay provides steady small gains until an unexpected move causes devastating losses unless hedged.
- **The Strangle is a dampened Straddle**: Lower initial cost and wider breakevens in exchange for needing a larger directional leap to reach profitability.

## Anti-patterns
- **Buying Straddles Immediately Before Earnings Without Sizing for IV Crush**: Being right on direction but losing money because implied volatility drops 50% overnight.
- **Holding Short Straddles Without Position Stop-Losses**: Experiencing unlimited losses when an unexpected takeover bid or scandal causes a stock to gap 40%.
- **Holding Long Volatility "Hoping for Tomorrow"**: Letting theta consume 80% of capital while waiting for a breakout that already missed its catalyst.

## Reference Tables

### Straddles vs. Strangles Greeks Comparison
| Strategy | Delta (ATM) | Gamma | Vega | Theta | Risk Profile |
|---|---|---|---|---|---|
| **Long Straddle** | $\\approx 0$ | Positive (Single Peak) | Positive (High) | Negative (Single Valley) | Limited to Debit |
| **Long Strangle** | $\\approx 0$ | Positive (Double-Peak M) | Positive (Moderate) | Negative (Double-Valley W) | Limited to Debit |
| **Short Straddle** | $\\approx 0$ | Negative (Single Valley) | Negative (High) | Positive (Single Peak) | Unlimited |
| **Short Strangle** | $\\approx 0$ | Negative (Double-Valley W)| Negative (Moderate) | Positive (Double-Peak M) | Unlimited |

## Worked Example
**Scenario**: Biotech stock XYZ trading at $100 awaiting FDA drug trial results.
- Option Prices: 100 Call = $20.00, 100 Put = $19.00.
- Long Straddle Cost: $20.00 + $19.00 = $39.00 Debit ($3,900 per spread).
- Break-Even Points: Upside = $100 + $39 = $139.00; Downside = $100 - $39 = $61.00.
- **Post-Announcement Case**: Drug approved! Stock surges to $120.00.
  - Intrinsic Value of 100 Call = $20.00. Put is worthless ($0.00).
  - Implied volatility collapses from 120% to 35%, wiping out extrinsic value.
  - Straddle trades at only $40.00 ($20 intrinsic + $20 total extrinsic remaining) $\\rightarrow$ Profit is only $1.00 despite a 20% move!
  - **Lesson**: IV crush neutralized the directional gain because the move ($20) was smaller than the pre-priced straddle cost ($39).

## Trade Management & Adjustments
1. **Managing Long Straddles/Strangles on Breakout**:
   - When one leg surges deep ITM, **roll that winning leg** by selling vertical spreads to bank cash while keeping upside open.
   - Hold the losing leg as a free "lottery ticket" or close for scrap value.
2. **Managing Poor Timing on Long Positions**:
   - Enforce both a **price stop-loss** (e.g. exit if spread drops 30%) and a **time stop-loss** (e.g. exit 10 days before expiration if no move occurs).
3. **Managing Short Straddles/Strangles**:
   - Always maintain a stop-loss order set on the **total price of the structure** itself to exit if IV spikes even if price is still near ATM.
   - If stock breaks out, roll the untested side closer to collect credit, or convert the position into an **iron butterfly/condor** to cap tail risk.

## Key Takeaways
1. Straddles and strangles trade volatility and magnitude, completely independent of market direction.
2. Long straddles have positive gamma and negative theta: time is the enemy, movement is the friend.
3. Never buy straddles into binary events without evaluating whether implied volatility is already so high that post-event IV crush will destroy profits.
4. Short straddles have unlimited risk; always maintain structural stop-losses and time constraints.

## Connects To
- **Ch 5 Butterflies and Condors**: A long butterfly is synthetically a short straddle wrapped in a long strangle to eliminate tail risk.
- **Ch 8 Backspreads**: Backspreads provide a directional alternative to straddles with positive gamma and limited loss.
