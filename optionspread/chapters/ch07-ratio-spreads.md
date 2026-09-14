# Chapter 7: Ratio Spreads

## Core Idea
Ratio spreads buy a near-the-money option and underwrite it by selling a greater number of further out-of-the-money options (typically 1:2, 2:3, or 1:4). Being net short options, ratio spreads possess positive theta and negative vega, making them powerful contratrend tools for trading decelerating trends, oversold bounces, and overbought pullbacks. However, they carry unlimited tail risk in the direction of the short options.

## Frameworks Introduced
- **The Call Ratio Spread (Bullish Contratrend / Moderately Bullish)**:
  - *Structure*: Buy 1 lower call ($K_1$), Sell $N$ higher calls ($K_2$) ($N \\ge 2$).
  - *Structural Decomposition*:
    - $\\text{1:2 Call Ratio Spread} = \\text{Bull Call Spread } (K_1/K_2) + \\text{Naked Short Call at } K_2$.
    - $\\text{1:2 Call Ratio Spread} = \\text{Long Call Butterfly } (K_1/K_2/K_3) + \\text{Naked Short Call at } K_2$.
  - *When to use*: Expecting a mild oversold bounce into known resistance, accompanied by declining implied volatility.
  - *Payoff*:
    - Max Profit at $K_2 = (K_2 - K_1) + \\text{Credit}$ (or $- \\text{Debit}$).
    - Downside Risk: Limited to net debit paid (zero if done for even money or credit).
    - Upside Risk: **Unlimited above upper breakeven**.
    - Upside Breakeven $= \\frac{(N \\times \\text{Short Call BE}) - (1 \\times \\text{Long Call BE})}{N - 1}$.
- **The Put Ratio Spread (Bearish Contratrend / Moderately Bearish)**:
  - *Structure*: Buy 1 higher put ($K_2$), Sell $N$ lower puts ($K_1$) ($N \\ge 2$).
  - *Structural Decomposition*: Bear Put Spread ($K_1/K_2$) + Naked Short Put at $K_1$.
  - *When to use*: Expecting a mild overbought pullback into known support with declining volatility.
  - *Payoff*:
    - Max Profit at $K_1 = (K_2 - K_1) + \\text{Credit}$ (or $- \\text{Debit}$).
    - Upside Risk: Limited to net debit paid (zero if credit).
    - Downside Risk: **Substantial down to stock price zero**.
- **Dynamic Delta "Growth" Over Time**:
  As time passes and implied volatility declines, the delta of the short out-of-the-money options decays much faster than the near-the-money long option. This causes the net delta of the ratio spread to automatically "grow" in favor of the trader as long as the market doesn't blow through the short strike.

## Key Concepts
- **Ratio**: The proportion of short options to long options (e.g. 1:2, 2:3, 1:4). Higher ratios increase leverage and credit, but double tail risk.
- **Contratrend Move**: A counter-trend reaction (e.g., oversold bounce in a downtrend or pullback in an uptrend) characterized by lower volume and decelerating momentum.
- **Congestion Zone**: A historical consolidation range where trading volume creates heavy support or resistance, stalling price advances.
- **Capping the Spread**: Purchasing an outer out-of-the-money option to transform an endangered ratio spread into a limited-risk butterfly.
- **Rolling the Ratio Spread**: Shifting short strikes further out to give the position breathing room, either 1:1 or by expanding the ratio (e.g., from 1:2 to 1:4) for even money.

## Mental Models
- **Think of the ratio spread as a one-winged butterfly**: You capture the exact profit peak of a butterfly without paying for the outer wing, but you assume catastrophic tail risk if the market explodes.
- **Backstop the short strike with heavy technical masonry**: Never place short strikes in open air; always anchor them behind major resistance (calls) or support (puts).
- **Free trade in the opposite direction**: When initiated for a credit or even money, a ratio spread has literally zero risk if the market moves entirely opposite your thesis.

## Anti-patterns
- **Trading Ratio Spreads Without Capital for Overnight Gaps**: Trading naked short options without the margin or emotional discipline to handle overnight gap openings.
- **Greedily Expanding Ratios into 1:4 or 1:5**: Multiplying naked option risk to collect tiny incremental credits.
- **Failing to Cap when Short Strikes are Tested**: Watching the underlying surge through the short strike into unlimited loss territory without capping into a butterfly.

## Reference Tables

### Call vs. Put Ratio Spread Payoff Dynamics
| Dimension | 1:2 Call Ratio Spread | 1:2 Put Ratio Spread |
|---|---|---|
| **Optimal Market View** | Mild rally into resistance; falling IV | Mild dip into support; falling IV |
| **Max Profit Point** | Exactly at short strike $K_2$ | Exactly at short strike $K_1$ |
| **Max Profit Formula** | $(K_2 - K_1) + \\text{Credit}$ | $(K_2 - K_1) + \\text{Credit}$ |
| **Safe Side Risk** | Downside: Limited to Debit (or keep credit) | Upside: Limited to Debit (or keep credit) |
| **Dangerous Side Risk**| Upside: Unlimited | Downside: Substantial to zero |
| **Vega Exposure** | Net Negative (Short Vega) | Net Negative (Short Vega) |
| **Theta Exposure** | Net Positive (Long Theta) | Net Positive (Long Theta) |

## Worked Example
**Scenario**: Stock XYZ is at $102. Strong overhead resistance at $110. Expected mild bounce.
- Trades:
  - Buy 1 Jan 105 Call at $3.40.
  - Sell 2 Jan 110 Calls at $2.00 each ($4.00 total credit).
  - **Net Credit Received = $0.60** ($60 per spread).
- Payoffs:
  - Downside (Stock drops below $105): Keep $0.60 net credit.
  - At Strike $110 at Expiry: Long 105 Call is worth $5.00; short calls expire worthless. Total gain = $\$5.00 + \\$0.60 = \\mathbf{\\$5.60}$ ($560 profit).
  - Upper Breakeven:
    - Short Call BE = $110 + 2.00 = $112.00.
    - Long Call BE = $105 + 3.40 = $108.40.
    - Upper $\\text{BE} = \\frac{(2 \\times 112.00) - (1 \\times 108.40)}{2 - 1} = 224.00 - 108.40 = \\mathbf{\\$115.60}$.
  - Above $115.60: Position loses $1.00 per share per dollar of stock advance without limit.

## Trade Management & Adjustments
1. **Taking Profits**:
   - Scale out as the stock drifts into the short strike and IV collapses.
2. **Short Strike Threatened**:
   - *Cap into Butterfly*: Buy 1 OTM Call at $K_3$ (e.g. 115 Call), turning the ratio spread into a 105/110/115 call butterfly with capped risk.
   - *Roll Short Strike Away*: Buy back short 110 calls and sell 115 calls. Can be funded 1:1 for a debit or by expanding ratio to 1:4 for even money.
3. **Market Reverses Through Long Strike**:
   - If entered for a credit or even money, there is zero risk. The trader can hold through the expiration cycle for a potential secondary rebound.

## Key Takeaways
1. Ratio spreads are high-reward, asymmetric tools designed for decelerating trends and contratrend reversals.
2. They profit from two distinct tailwinds: positive theta and short vega.
3. The short strike must always be backstopped by impenetrable support or resistance.
4. When the short strike is threatened, cap the position into a butterfly immediately.

## Connects To
- **Ch 2 Verticals**: A ratio spread is a vertical spread plus extra short options.
- **Ch 5 Butterflies**: Capping an endangered ratio spread turns it into a long butterfly.
- **Ch 8 Backspreads**: The inverse of a ratio spread.
