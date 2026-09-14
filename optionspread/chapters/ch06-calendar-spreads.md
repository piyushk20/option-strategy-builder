# Chapter 6: Calendar Spreads

## Core Idea
Calendar spreads (horizontal time spreads) exploit the non-linear term structure of time decay and implied volatility by pairing options of the same strike price and class across different expiration cycles. Long calendar spreads buy longer-dated options and sell near-term options, profiting from accelerated near-term theta decay and rising long-term implied volatility. Through the Jelly Roll structure, call and put calendar spreads are synthetically linked by interest rate carrying costs.

## Frameworks Introduced
- **The Horizontal Time Spread**:
  - *Long Time Spread*: Buy deferred-month option ($t+n$), Sell near-term option ($t$) at the same strike $K$.
  - *Short Time Spread*: Sell deferred-month option ($t+n$), Buy near-term option ($t$) at the same strike $K$.
  - *Payoff (Long)*: Max value occurs when stock is pinned at strike $K$ at near-term expiration; max loss is limited to initial debit paid (if closed prior to near-term expiry).
  - *Payoff (Short)*: Profits when stock makes a violent move far away from strike $K$ in either direction; max profit is credit received.
- **Directional Bias via Strike Placement**:
  - Strike $K = \\text{Spot Price} \\rightarrow$ Neutral / Sideways trade.
  - Strike $K > \\text{Spot Price} \\rightarrow$ Bullish target play (anticipating price arrives at $K$ at near-term expiry).
  - Strike $K < \\text{Spot Price} \\rightarrow$ Bearish target play (anticipating price declines to $K$ at near-term expiry).
- **The Jelly Roll & Pricing Parity**:
  A jelly roll combines a long call time spread and a short put time spread at the same strike and expiration pair:
  $$\\text{Long Call Time Spread} + \\text{Short Put Time Spread} = \\text{Long Jelly Roll}$$
  $$\\text{Call Time Spread (CTS)} - \\text{Put Time Spread (PTS)} = \\text{Jelly Roll Value (JR)}$$
  $$\\text{Jelly Roll Value} = K \\times (d_2 - d_1) \\times \\left(\\frac{r}{360}\\right)$$
  Where $K$ is strike, $d_2$ is days to deferred expiry, $d_1$ is days to near expiry, and $r$ is risk-free interest rate.
- **Calendar Spread Arbitrage Rules**:
  - *Long Time Spread Rule*:
    - If $\\text{CTS Ask} - \\text{PTS Ask} > \\text{Jelly Roll Value} \\rightarrow$ **Put Time Spread is cheap** (buy put time spread).
    - If $\\text{CTS Ask} - \\text{PTS Ask} < \\text{Jelly Roll Value} \\rightarrow$ **Call Time Spread is cheap** (buy call time spread).
  - *Short Time Spread Rule*:
    - If $\\text{CTS Bid} - \\text{PTS Bid} > \\text{Jelly Roll Value} \\rightarrow$ **Call Time Spread is rich** (sell call time spread).
    - If $\\text{CTS Bid} - \\text{PTS Bid} < \\text{Jelly Roll Value} \\rightarrow$ **Put Time Spread is rich** (sell put time spread).

## Key Concepts
- **Horizontal Time Spread**: Calendar spread with identical strikes and different expirations.
- **Term Structure of Implied Volatility**: The curve of implied volatility across progressive expiration months.
  - *Upward Sloping (Contango)*: Near-term IV lower than long-term IV (typical in tranquil markets); favors short calendar spreads.
  - *Downward Sloping (Backwardation / Inverted)*: Near-term IV elevated above long-term IV (typical during crises or pre-earnings); favors long calendar spreads.
- **Jelly Roll**: A pure interest-rate arbitrage structure that links call and put calendar spreads.
- **Early Arrival Problem**: When the underlying moves to the target strike much faster than forecast, failing to collect sufficient near-term theta decay.
- **Assignment Risk at Expiry**:
  - Long Call Calendar: If stock $> K$ at near expiry, short call is assigned $\\rightarrow$ leaves **Synthetic Long Put** ($-100$ shares stock + long deferred call).
  - Long Put Calendar: If stock $< K$ at near expiry, short put is assigned $\\rightarrow$ leaves **Synthetic Long Call** ($+100$ shares stock + long deferred put).

## Mental Models
- **Think of the calendar spread as renting out a room in a house you own**: You own the long-term lease (deferred option) and rent it out short-term (near option).
- **Theta differential is your edge**: Near-term options lose extrinsic value at an accelerating curve compared to deferred options.
- **Never carry unmanaged legs through expiration**: Exercise or assignment instantly converts your spread into an unhedged directional equity position.

## Anti-patterns
- **Buying Long Calendars in Severely Upward-Sloping Term Structures**: Paying exorbitant premiums for long-dated options while selling depressed near-term options.
- **Freezing on Early Arrival**: Holding a target calendar after a rapid move and watching the underlying blast through the strike while near-term theta has not yet decayed.
- **Ignoring Exercise Risk on Deep ITM Legs**: Getting assigned short stock on an ITM short call and incurring unforeseen margin fees or dividend liabilities.

## Reference Tables

### Long vs. Short Time Spread Greeks
| Spread Type | Delta (at Strike) | Gamma (at Strike) | Vega | Theta (at Strike) | Optimal Volatility Condition |
|---|---|---|---|---|---|
| **Long Time Spread** | $\\approx 0$ | Negative | Positive | Positive | Low IV / Near IV elevated vs Long IV |
| **Short Time Spread**| $\\approx 0$ | Positive | Negative | Negative | High IV / Near IV depressed vs Long IV |

*Note: Call and Put time spreads of the same strike and expirations possess identical Greeks.*

## Worked Example
**Scenario**: XYZ trading at $50.00. Investor plans a 60-day / 28-day long calendar at the 50 strike. Risk-free rate = 5.00%.
- Parameters: $K = 50, d_1 = 28, d_2 = 60, r = 0.05$.
- Jelly Roll Fair Value:
  $$JR = 50 \\times (60 - 28) \\times \\left(\\frac{0.05}{360}\\right) = 50 \\times 32 \\times 0.0001389 = +\\$0.22$$
- Market Quotes:
  - Call Time Spread: $1.25 Bid / $1.35 Ask.
  - Put Time Spread: $1.15 Bid / $1.20 Ask.
- Valuation Check:
  $$\\text{CTS Ask} - \\text{PTS Ask} = 1.35 - 1.20 = \\$0.15$$
  Since $\$0.15 < \\$0.22$ (Jelly Roll Value), the call time spread ask is underpriced relative to the put time spread.
- **Execution Decision**: **Buy the Call Time Spread at $1.35**.

## Trade Management & Adjustments
1. **Early Arrival (Underlying Reaches Strike Ahead of Schedule)**:
   - If velocity continues, exit immediately.
   - If expecting consolidation at the new level, **roll up** by buying a call vertical in the deferred month and selling a call vertical in the near month.
2. **Late Arrival / Wrong Direction**:
   - If underlying breaks support/resistance away from the strike, time decay reverses to negative. Exit immediately.
3. **Approaching Expiration**:
   - Always close or roll the position before 4:00 PM on expiration Friday of the front-month contract to eliminate assignment risk and avoid synthetic stock positions.

## Key Takeaways
1. Calendar spreads trade the differential decay between near-term and longer-term options.
2. Long calendars are long vega and positive theta; short calendars are short vega and negative theta.
3. Call and put time spreads are synthetically linked via the Jelly Roll; calculate $JR = K(d_2 - d_1)(r/360)$ to pick the cheaper vehicle.
4. Never allow front-month options to expire unmanaged, which risks unexpected stock assignment.

## Connects To
- **Ch 3 Collars**: Collars that fail to trigger are rolled into future cycles using calendar spreads.
- **Ch 2 Verticals**: Adjusting a calendar spread to a new strike requires executing verticals across both months.
