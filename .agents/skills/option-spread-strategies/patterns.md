# Option Spread Patterns & Execution Blueprints

Comprehensive architectural guide to constructing, executing, and adjusting all core option spread strategies from Anthony Saliba's *Option Spread Strategies*.

---

## 1. The Covered-Write (Buy-Write)
- **Structure**: Long 100 shares stock + Sell 1 Call ($K$)
- **Market Bias**: Neutral to moderately bullish ($\le 45$ days duration)
- **Greeks**: $+\\Delta, -\\Gamma, -\\text{Vega}, +\\Theta$
- **Payoff Equations**:
  - $\\text{Max Profit} = (K - S_1) + C$
  - $\\text{Max Loss} = S_1 - C$ (down to stock price 0)
  - $\\text{Break-Even} = S_1 - C$
- **Adjustments**:
  - *Stock rallies through $K$*: Buy vertical call spread to roll strike up, or execute diagonal "up-and-out" spread to roll up and out to a deferred month for credit.
  - *Stock drops*: Sell vertical call spread to roll strike down, or execute diagonal "down-and-out" spread to collect additional downside cushion.
  - *Emergency exit*: Buy put at strike $K$ to create conversion arbitrage (locks in price with zero delta).

---

## 2. Bull Vertical Spreads (Bull Call & Bull Put)
- **Structure**:
  - *Bull Call (Debit)*: Long Call ($K_1$) + Short Call ($K_2$) ($K_1 < K_2$)
  - *Bull Put (Credit)*: Long Put ($K_1$) + Short Put ($K_2$) ($K_1 < K_2$)
- **Market Bias**: Moderately bullish toward $K_2$ target
- **Greeks**: $+\\Delta$, Gamma positive near $K_1$ and negative near $K_2$, Vega positive near $K_1$ and negative near $K_2$
- **Arbitrage Selection**:
  - Calculate Box Value: $BOX = (K_2 - K_1) / (1 + r)^t$.
  - If $\\text{Call Spread Ask} + \\text{Put Spread Bid} > BOX \\rightarrow$ **Sell Put Spread**.
  - If $\\text{Call Spread Ask} + \\text{Put Spread Bid} < BOX \\rightarrow$ **Buy Call Spread**.
- **Adjustments**:
  - *Roll Up*: Sell overlapping Call or Put Butterfly ($K_1 / K_2 / K_3$).
  - *Deep ITM Liquidation*: Leg into the opposite spread (Bear Put) to box the trade and avoid wide ITM bid-ask spreads.

---

## 3. Bear Vertical Spreads (Bear Call & Bear Put)
- **Structure**:
  - *Bear Call (Credit)*: Short Call ($K_1$) + Long Call ($K_2$) ($K_1 < K_2$)
  - *Bear Put (Debit)*: Short Put ($K_1$) + Long Put ($K_2$) ($K_1 < K_2$)
- **Market Bias**: Moderately bearish down to $K_1$ target
- **Greeks**: $-\\Delta$, Gamma negative near $K_1$ and positive near $K_2$
- **Arbitrage Selection**:
  - If $\\text{Call Spread Bid} + \\text{Put Spread Ask} > BOX \\rightarrow$ **Sell Call Spread**.
  - If $\\text{Call Spread Bid} + \\text{Put Spread Ask} < BOX \\rightarrow$ **Buy Put Spread**.
- **Adjustments**:
  - *Roll Down*: Sell overlapping Call or Put Butterfly ($K_0 / K_1 / K_2$) to take cash off the table and extend downward participation.

---

## 4. The Collar & Reverse-Collar
- **Structure**:
  - *Collar (Bearish)*: Long Put ($K_1$) + Short Call ($K_2$) ($K_1 < \\text{Spot} < K_2$)
  - *Reverse-Collar (Bullish)*: Short Put ($K_1$) + Long Call ($K_2$) ($K_1 < \\text{Spot} < K_2$)
  - *Collar Hedge*: Long Stock + Collar $\\equiv$ Synthetic Bull Vertical Spread
  - *Reverse-Collar Hedge*: Short Stock + Reverse-Collar $\\equiv$ Synthetic Bear Vertical Spread
- **Market Bias**: Sharp breakout expected; timing uncertain; neutralizes theta and vega drag
- **Adjustments**:
  - *On Breakout*: Roll winning long option by selling vertical spreads; close trailing short option immediately once near worthless.
  - *On Adverse Move*: Trigger mandatory stop-loss on the naked short option.
  - *No Move at Expiry*: Roll both legs via calendar spreads.

---

## 5. Straddles and Strangles
- **Structure**:
  - *Long Straddle*: Long 1 ATM Call ($K$) + Long 1 ATM Put ($K$)
  - *Long Strangle*: Long 1 OTM Call ($K_2$) + Long 1 OTM Put ($K_1$) ($K_1 < K_2$)
  - *Short Straddle*: Short 1 ATM Call ($K$) + Short 1 ATM Put ($K$)
  - *Short Strangle*: Short 1 OTM Call ($K_2$) + Short 1 OTM Put ($K_1$)
- **Market Bias**:
  - Long: Nondirectional; massive breakout / rising IV.
  - Short: Nondirectional; quiet sideways consolidation / post-event IV crush.
- **Adjustments**:
  - *Long*: On breakout, roll winning leg by selling vertical spreads; enforce strict time stop-loss.
  - *Short*: Enforce structural stop-loss on spread price; hedge unexpected breakouts by buying outside strangle (creating iron condor).

---

## 6. Butterflies & Condors
- **Structure**:
  - *Long Butterfly*: $+1 K_1 / -2 K_2 / +1 K_3$ (Calls, Puts, or Iron)
  - *Long Condor*: $+1 K_1 / -1 K_2 / -1 K_3 / +1 K_4$ (Calls, Puts, or Iron)
- **Market Bias**: Sideways range-bound market; pin at $K_2$ (butterfly) or plateau $K_2-K_3$ (condor)
- **Greeks**: Short gamma, short vega, positive theta at body; flips to long gamma, long vega, negative theta at wings
- **Adjustments**:
  - *Taking Profit*: Scale out in pieces; or buy back short inside straddle to leave low-cost synthetic long strangle.
  - *Widening Range*: Buy adjacent butterfly to convert butterfly into condor.
  - *Narrowing Range*: Sell adjacent butterfly from condor to lock in cash and convert to butterfly.

---

## 7. Calendar Spreads (Horizontal Time Spreads)
- **Structure**:
  - *Long Calendar*: Long Deferred Option ($t+n$) + Short Near Option ($t$) at strike $K$
  - *Short Calendar*: Short Deferred Option ($t+n$) + Long Near Option ($t$) at strike $K$
- **Jelly Roll Parity**:
  - $\\text{Call Time Spread} - \\text{Put Time Spread} = K \\times (d_2 - d_1) \\times (r / 360)$.
  - If $\\text{CTS Ask} - \\text{PTS Ask} < JR \\rightarrow$ **Buy Call Time Spread**.
- **Adjustments**:
  - *Early Arrival*: Roll strike up/down by executing vertical spreads in both expiration months.
  - *Expiration*: Always close before near-term 4:00 PM expiry to prevent assignment into naked stock.

---

## 8. Ratio Spreads
- **Structure**:
  - *Call Ratio Spread*: Long 1 Call ($K_1$) + Short $N$ Calls ($K_2$) ($N \\ge 2, K_1 < K_2$)
  - *Put Ratio Spread*: Long 1 Put ($K_2$) + Short $N$ Puts ($K_1$) ($N \\ge 2, K_1 < K_2$)
- **Market Bias**: Contratrend bounce/pullback, trend deceleration into congestion, falling IV
- **Greeks**: Positive theta, short vega, delta grows in trader's favor over time
- **Adjustments**:
  - *Short Strikes Threatened*: Cap into butterfly by buying outer wing option; or roll short strike higher/lower.
  - *Market Reverses Opposite*: If done for credit/even money, hold through expiry with zero downside risk.

---

## 9. Backspreads (Volatility Spreads)
- **Structure**:
  - *Call Backspread*: Short 1 Call ($K_1$) + Long $N$ Calls ($K_2$) ($N \\ge 2, K_1 < K_2$)
  - *Put Backspread*: Short 1 Put ($K_2$) + Long $N$ Puts ($K_1$) ($N \\ge 2, K_1 < K_2$)
- **Market Bias**: High-velocity breakout from tight consolidation, rising IV, "back door" catastrophe puts
- **Greeks**: Long gamma, long vega, negative theta; danger zone between $K_1$ and $K_2$
- **Adjustments**:
  - *On Breakout*: Roll long options up/down by selling vertical spreads to bank cash while preserving unlimited tail; or expand ratio (1:2 to 1:4) for credit.
  - *Stalling in Danger Zone*: Exit immediately when price or time stop is triggered.
