# Chapter 9: Final Exam & Practical Scenarios

## Core Idea
This synthesis chapter integrates all spread strategies through the 50 foundational exam questions and 5 master market scenarios developed by Anthony Saliba, testing trade selection, Greek sensitivities, pricing parity, and dynamic risk adjustments.

## Master Practical Scenarios

### Scenario 1: The Covered-Write Dilemma
- **Setup**: Buy 100 shares XYZ at $45.50. Expecting flat trading over next 30 days, sell 47.50 Call at $1.50.
- **Analysis**:
  - Break-Even: $45.50 - $1.50 = $44.00. Below $44.00, losses accrue dollar-for-dollar.
  - Maximum Profit: If stock rises to $47.50+, gain $2.00 on stock + $1.50 call premium = $3.50 ($350).
  - Synthetic Identity: Synthetically a short put; downside is unprotected below $44.00.
- **Management on Unexpected Rally**:
  - Stock surges to $48.50, breaking resistance. 47.50 Call is $2.00; 50 Call is $0.75.
  - **Adjustment**: Roll up the call by buying the 47.50/50 Call Spread for $1.25 ($2.00 - $0.75).
  - **New State**: Net credit remaining = $1.50 initial - $1.25 roll cost = $0.25 credit. Now short the 50 Call with stock at $48.50. Upside is unlocked to $50.00, capturing an additional $1.75 of potential profit.

### Scenario 2: Index Put Spread vs. Outright Put & Boxing
- **Setup**: Market index at 1365. Target is 1300–1325 support. Compare buying 1350 Put at $23.00 vs buying 1300/1350 Put Spread at $15.00.
- **Selection**:
  - If index drops to 1325, both are worth $25.00 at expiry. Profit on spread = $10.00 ($25 - $15); profit on outright put = $2.00 ($25 - $23).
  - If index drops to 1300, both are worth $50.00 at expiry. Profit on spread = $35.00 ($50 - $15); profit on outright put = $27.00 ($50 - $23).
  - **Decision**: The 1300/1350 Put Spread is vastly superior across the entire target zone.
- **Unwinding via Box Arbitrage**:
  - Stock drops to 1300. Outright sale of the 1300/1350 put spread suffers wide bid-ask spreads because both puts are deep ITM.
  - **The Solution**: Buy the OTM 1300/1350 Call Spread!
  - Combining Long 1300/1350 Put Spread + Long 1300/1350 Call Spread creates a **Long Box Spread**, locking in the $50.00 maturity value with tight execution spreads and zero Greek risk.

### Scenario 3: Long Stock Portfolio Hedging via Collar
- **Setup**: Long ABC stock in family trust at $125.00. Massive unrealized gain. Needs catastrophe insurance without paying cash.
- **Construction**:
  - 6-month 100 Put = $3.00; 6-month 135 Call = $6.50.
  - Buy 100 Put ($3.00) and Sell 135 Call ($6.50) $\\rightarrow$ **Net Credit collected = $3.50**.
  - Risk/Reward: Downside protected below $100 (effective exit $103.50). Max profit at $135 = $10 stock gain + $3.50 credit = $13.50.
- **Adjustment on Market Decline**:
  - Stock drops below $100. To prevent stock sale while monetizing insurance, **roll the 100 put down** by selling put spreads (e.g. Sell 95/100 put spread for credit). This extracts cash like cashing in an insurance policy without relinquishing coverage.

### Scenario 4: Binary Biotech Event, IV Crush, and Strangle Recovery
- **Setup**: Stock at $100. Impending FDA drug verdict. 100 Call = $20.00, 100 Put = $19.00.
- **Trap**: Buyer pays $39.00 for straddle. Stock surges to $120 on approval, but IV collapses from 120% to 35%. Straddle only trades at $40.00 ($1.00 net gain) because IV crush wiped out $19.00 of extrinsic value.
- **Post-Event Transition**:
  - Liquidate straddle. Stock now consolidates at $120.
  - Sell 100 Put at $5.00 and Sell 140 Call at $4.50 $\\rightarrow$ **Short 100/140 Strangle for $9.50 credit**.
  - Break-Even: $90.50 and $149.50. Negative vega captures ongoing post-event IV contraction.
- **Managing Secondary Threat**:
  - New unexpected catalyst emerges. To prevent naked tail risk, purchase the 120 Straddle while holding the 100/140 Short Strangle. This transforms the position into an **Iron Butterfly**, capping all risk.

### Scenario 5: Range-Bound Put Butterfly into Condor
- **Setup**: DEF stock at $55.00. 52.5 Put = $0.50, 55 Put = $1.35, 57.5 Put = $3.00.
- **Trade**: Buy 52.5/55/57.5 Put Butterfly for $0.80 debit ($3.50 long wings - $2.70 short body).
  - Max loss = $0.80; Max reward at $55.00 = $1.70 ($2.50 strike spread - $0.80).
- **Widening Range**:
  - Stock drifts into 55–58 corridor. Purchase the 55/57.5/60 Put Butterfly.
  - Result: Turns original fly into the **52.5/55/57.5/60 Put Condor**, expanding the maximum profit zone to a 55–57.5 plateau.

## Key Takeaways
1. Always evaluate execution through synthetic equivalents and box relationships when spreads move deep ITM.
2. High implied volatility is a seller's market; low implied volatility is a buyer's market.
3. Every trade must have an exit plan for three outcomes: thesis confirmed, thesis refuted, and timing delayed.
4. Spreads can be dynamically transformed: verticals into butterflies, ratio spreads into butterflies, butterflies into condors, and calendars into jelly rolls.
