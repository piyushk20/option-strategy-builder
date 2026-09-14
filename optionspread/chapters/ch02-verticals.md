# Chapter 2: Verticals

## Core Idea
Vertical spreads simultaneously buy and sell options of the same class and expiration but differing strike prices to trade moderate directional movements with strictly limited risk and return. Through put-call parity and the Box Spread relationship, call and put vertical spreads are synthetically equivalent, enabling traders to exploit pricing anomalies and optimize execution liquidity.

## Frameworks Introduced
- **The Four Vertical Archetypes**:
  1. *Bull Call Spread (Debit Call)*: Buy lower strike call ($K_1$), sell higher strike call ($K_2$).
  2. *Bull Put Spread (Credit Put)*: Buy lower strike put ($K_1$), sell higher strike put ($K_2$).
  3. *Bear Call Spread (Credit Call)*: Buy higher strike call ($K_2$), sell lower strike call ($K_1$).
  4. *Bear Put Spread (Debit Put)*: Buy higher strike put ($K_2$), sell lower strike put ($K_1$).
- **The Box Spread Pricing Arbitrage**:
  A box spread combines a bull spread and a bear spread of the exact same strikes and expiration:
  $$\\text{Bull Call Spread} + \\text{Bear Put Spread} = \\text{Long Box}$$
  $$\\text{Bull Spread Value} + \\text{Bear Spread Value} = \\text{Box Fair Value}$$
  $$\\text{Box Fair Value} = \\frac{K_2 - K_1}{(1 + r)^t}$$
  Where $K_2 - K_1$ is the strike difference, $r$ is the annual risk-free interest rate, and $t$ is time to expiration in years.
- **Spread Selection & Pricing Advantage Rules**:
  - *Bull Spread Rule*:
    - If $\\text{Call Spread Ask} + \\text{Put Spread Bid} > \\text{Box Value} \\rightarrow$ **Sell Put Spread** (credit spread is rich / call spread is expensive).
    - If $\\text{Call Spread Ask} + \\text{Put Spread Bid} < \\text{Box Value} \\rightarrow$ **Buy Call Spread** (debit call spread is cheap).
  - *Bear Spread Rule*:
    - If $\\text{Call Spread Bid} + \\text{Put Spread Ask} > \\text{Box Value} \\rightarrow$ **Sell Call Spread** (credit call spread is rich).
    - If $\\text{Call Spread Bid} + \\text{Put Spread Ask} < \\text{Box Value} \\rightarrow$ **Buy Put Spread** (debit put spread is cheap).
- **Rolling Verticals via Butterflies**:
  Rolling a vertical spread into adjacent strikes is structurally achieved by trading an overlapping butterfly:
  - Roll UP a Bull Call ($K_1/K_2 \\rightarrow K_2/K_3$): **Sell the $K_1/K_2/K_3$ Call Butterfly** (Sell $+1 K_1, -2 K_2, +1 K_3$).
  - Roll UP a Bull Put ($K_1/K_2 \\rightarrow K_2/K_3$): **Sell the $K_1/K_2/K_3$ Put Butterfly**.
  - Roll DOWN a Bear Call ($K_2/K_3 \\rightarrow K_1/K_2$): **Sell the $K_1/K_2/K_3$ Call Butterfly**.
  - Roll DOWN a Bear Put ($K_2/K_3 \\rightarrow K_1/K_2$): **Sell the $K_1/K_2/K_3$ Put Butterfly**.
  Selling the butterfly takes cash off the table, locks in partial profit, and shifts the spread's profit zone in the trend direction.

## Key Concepts
- **Strike Differential**: Difference between upper and lower strikes ($K_2 - K_1$), representing total spread range.
- **Debit Spread**: Strategy paid for upfront; maximum risk is strictly initial debit.
- **Credit Spread**: Strategy where premium is collected upfront; maximum profit is credit received; max risk is strike differential minus credit.
- **Moneyness Liquidity Discrepancy**: As options move deep ITM, their deltas approach 1.00, widening bid-ask spreads because market makers face higher hedging risk. OTM options maintain lower deltas and tighter bid-ask spreads.
- **Synthetic Liquidation (Boxing)**: Closing an ITM vertical by trading the synthetically equivalent OTM spread in the opposite direction (e.g., locking in a bull call with a bear put spread) to avoid wide bid-ask slippage.
- **Directional Greek Profile**: Delta is positive for bull spreads ($0$ to $+100$) and negative for bear spreads ($0$ to $-100$). Delta returns to zero at extremes beyond both strikes.

## Mental Models
- **Think of a vertical as a bounded highway**: You capture the move between $K_1$ and $K_2$, but pay nothing for moves outside that corridor.
- **Use verticals to strip out volatility risk**: Because long and short options partially offset in vega, verticals allow directional expression when outright options are prohibitively expensive.
- **Always compare call vs. put via the Box**: Never assume buying a debit spread is better or worse than selling a credit spread without checking the box parity equation.

## Anti-patterns
- **Using Verticals for Unbounded Breakouts**: Capping profit potential on explosive runaway moves where naked options or backspreads are appropriate.
- **Staying in Deep ITM Spreads Until Expiry**: Suffering through extreme gamma/pin risk or wide bid-ask illiquidity instead of boxing the position or rolling.
- **Fighting the Market**: Refusing to exit when key support or resistance is broken; hoping the position recovers before expiration.

## Reference Tables

### Vertical Spreads Comparison
| Spread Type | Strikes / Options | Cash Flow | Max Profit | Max Loss | Break-Even |
|---|---|---|---|---|---|
| **Bull Call** | Long $K_1$ Call, Short $K_2$ Call | Debit ($D$) | $(K_2 - K_1) - D$ | Debit ($D$) | $K_1 + D$ |
| **Bull Put** | Long $K_1$ Put, Short $K_2$ Put | Credit ($C$) | Credit ($C$) | $(K_2 - K_1) - C$ | $K_2 - C$ |
| **Bear Call** | Short $K_1$ Call, Long $K_2$ Call | Credit ($C$) | Credit ($C$) | $(K_2 - K_1) - C$ | $K_1 + C$ |
| **Bear Put** | Short $K_1$ Put, Long $K_2$ Put | Debit ($D$) | $(K_2 - K_1) - D$ | Debit ($D$) | $K_2 - D$ |

## Worked Example
**Scenario**: Bull spread on ABC stock trading at $100. Target is $105 in 90 days. Risk-free rate = 4.04%.
- Strikes: $K_1 = 95, K_2 = 100$ (5-point spread).
- Box Fair Value: $BOX = \\frac{100 - 95}{(1 + 0.0404)^{0.25}} = \\frac{5}{1.01} = 4.95$.
- Market Quotes:
  - 95/100 Call Spread: $2.50 Bid / $2.60 Ask.
  - 95/100 Put Spread: $2.45 Bid / $2.55 Ask.
- Test Bull Spread Rule:
  $$\\text{Call Spread Ask} + \\text{Put Spread Bid} = 2.60 + 2.45 = 5.05$$
  Since $5.05 > 4.95$ (Box Value), the put spread bid is overpriced relative to the call spread.
- **Decision**: **Sell the 95/100 Put Spread at $2.45 credit**. This yields a superior price compared to paying $2.60 for the call spread.

## Key Takeaways
1. Verticals are strictly limited-risk and limited-reward; maximum value never exceeds strike differential $K_2 - K_1$.
2. Bull Call and Bull Put spreads are synthetically equivalent; use the Box formula to identify the mathematically superior pricing.
3. Roll profitable verticals in the direction of the trend by selling overlapping butterflies.
4. When a spread moves deep ITM, wide bid-ask spreads make outright liquidation costly; leg into the synthetic equivalent (box) to lock in profits cleanly.

## Connects To
- **Ch 5 Butterflies and Condors**: A butterfly is composed of two adjoining vertical spreads.
- **Ch 7 Ratio Spreads**: A call ratio spread is an embedded bull call spread plus extra short calls.
