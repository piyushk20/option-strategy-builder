# Glossary of Option Spread Terms

Alphabetical reference of options strategies, market mechanics, Greeks, and arbitrage structures based on Anthony J. Saliba, Joseph C. Corona, and Karen E. Johnson.

### A
- **At-the-Money (ATM)** — An option whose strike price equals or is nearest to the current underlying market price. Has maximum gamma, vega, and theta.
- **Assignment** — The obligation imposed on an option seller to fulfill the terms of the contract (deliver shares for a short call, purchase shares for a short put).

### B
- **Backspread (Volatility Spread)** — An options spread that is net long options, buying multiple out-of-the-money options financed by selling fewer near-the-money options (e.g. 1:2 or 1:3). Benefits from high-velocity breakouts and rising IV (Ch 8).
- **Bear Call Spread (Short Call Spread / Credit Call Spread)** — A vertical spread formed by selling a lower strike call and buying a higher strike call of the same expiration. Initiated for a net credit (Ch 2).
- **Bear Put Spread (Long Put Spread / Debit Put Spread)** — A vertical spread formed by buying a higher strike put and selling a lower strike put of the same expiration. Initiated for a net debit (Ch 2).
- **Box Spread** — A four-legged arbitrage structure combining a bull spread and a bear spread of identical strikes and expiration: Bull Call + Bear Put = Long Box. Trades at the present value of the strike differential: $(K_2 - K_1) / (1 + r)^t$ (Ch 2).
- **Break-Even Point** — The underlying asset price at which an option structure incurs zero gain and zero loss at expiration.
- **Breakout** — An explosive price movement above technical resistance or below technical support, marking the resumption or onset of a trend (Ch 4, Ch 8).
- **Bull Call Spread (Long Call Spread / Debit Call Spread)** — A vertical spread formed by buying a lower strike call and selling a higher strike call of the same expiration. Initiated for a net debit (Ch 2).
- **Bull Put Spread (Short Put Spread / Credit Put Spread)** — A vertical spread formed by buying a lower strike put and selling a higher strike put of the same expiration. Initiated for a net credit (Ch 2).
- **Butterfly Spread** — A three-strike neutral strategy with a +1 / -2 / +1 structure (e.g., long 1 lower, short 2 middle, long 1 upper). Synthetically an embedded short straddle wrapped by a long strangle (Ch 5).
- **Buy-Write** — The simultaneous transaction of purchasing 100 shares of stock and selling 1 call option against it as a combined package order (Ch 1).

### C
- **Calendar Spread (Horizontal Time Spread)** — Simultaneously buying an option in a deferred month and selling an option of the same strike and class in a nearer month (Ch 6).
- **Called Away** — The event where long shares are surrendered because the short call option sold against them was exercised by the call holder (Ch 1).
- **Collar** — An option structure combining long stock (or unhedged) with an out-of-the-money long put and an out-of-the-money short call of the same expiration (Ch 3).
- **Condor Spread** — A four-strike neutral strategy with a +1 / -1 / -1 / +1 structure, distributing the short body across two middle strikes to create a wider profit plateau (Ch 5).
- **Congestion Zone** — An area on a chart bounded by support and resistance where heavy past trading volume causes price movement to stall or decelerate (Ch 7).
- **Contratrend Move** — A price movement against the prevailing primary trend (e.g., an oversold bounce or overbought correction) typically marked by declining volume and volatility (Ch 7).
- **Conversion** — A riskless arbitrage position consisting of Long Stock + Short Call + Long Put at the same strike and expiration. Synthetically locks in borrowing/lending rates (Ch 1).

### D
- **Delta ($\\\\Delta$)** — The rate of change in theoretical option value relative to a $1.00 move in the underlying asset. Equivalent to share exposure.
- **Diagonal Spread** — A spread combining options of the same class but with different strikes and different expirations (e.g. rolling a call up and out) (Ch 1, Ch 6).
- **Directionless Strategy** — A trade designed to profit from time decay or volatility contraction rather than price movement (e.g. short straddles, long butterflies) (Ch 4, Ch 5).
- **Double Whammy** — The compounding loss on a long option position when timing is delayed: paying daily theta decay while implied volatility simultaneously collapses (Ch 3, Ch 4).
- **Down and Out** — A diagonal adjustment covering a near-term short option and selling a lower-strike option in a deferred expiration month (Ch 1).

### E
- **Early Arrival** — A dilemma where the underlying price reaches the target strike far ahead of schedule before time decay has eroded the short option (Ch 6).
- **Extrinsic Value (Time Value)** — The portion of an option's premium that exceeds its intrinsic value, reflecting time to expiry, volatility, and interest rates. Decays to zero at expiration (Ch 1).

### G
- **Gamma ($\\\\Gamma$)** — The rate of change in an option's delta for a $1.00 move in the underlying asset. Highest for ATM options near expiration.
- **Gearing** — The ratio of long contracts to short contracts in ratio spreads and backspreads (e.g. 1:2 vs 1:4 leverage) (Ch 8).

### I
- **Implied Volatility (IV)** — The market's consensus forecast of future annualized volatility implied by current option market prices via pricing models.
- **Implied Volatility Crush** — The rapid collapse in implied volatility that occurs immediately after the resolution of a major anticipated event (e.g. earnings or trial verdict) (Ch 4).
- **Implied Volatility Skew (Smirk / Smile)** — The pricing disparity where OTM puts generally trade at higher implied volatilities than OTM calls for the same expiration (Ch 3, Ch 7).
- **Intrinsic Value** — The tangible in-the-money value of an option ($\max(0, S - K)$ for calls, $\max(0, K - S)$ for puts).
- **Iron Butterfly** — A neutral spread constructed with Long Put $K_1$, Short Put $K_2$, Short Call $K_2$, Long Call $K_3$. Synthetically identical to call and put butterflies (Ch 5).
- **Iron Condor** — A neutral spread constructed with Long Put $K_1$, Short Put $K_2$, Short Call $K_3$, Long Call $K_4$. Synthetically identical to call and put condors (Ch 5).

### J
- **Jelly Roll** — A four-legged neutral spread combining a long call time spread and a short put time spread at the same strike and expiration pair. Measures intermonth cost of carry: $K \\times (d_2 - d_1) \\times (r / 360)$ (Ch 6).

### M
- **Mean-Reversion** — The tendency of a security's price to return to an average level during trading ranges; optimal target for butterfly short strikes (Ch 5).
- **Moneyness** — The relative position of the underlying price to the strike price (In-the-Money, At-the-Money, Out-of-the-Money).

### P
- **Pin Risk** — The uncertainty and assignment hazard on expiration day when the underlying asset trades directly at a short option strike price.
- **Pivot Price (Trigger Price)** — The critical technical price level whose breach confirms a directional breakout (Ch 3).

### R
- **Ratio Spread** — An options spread that is net short options, buying a near-the-money option underwritten by selling multiple out-of-the-money options (e.g. 1:2 or 2:3). Has positive theta and short vega with open-ended tail risk (Ch 7).
- **Return to Call** — The percentage return on a covered-write if the stock is called away at the strike price at expiration: $[K / (S_1 - C) - 1] \\times 100\\%$ (Ch 1).
- **Return to Unchanged** — The percentage return on a covered-write if the stock finishes at expiration at the exact same price as entry: $[S_1 / (S_1 - C) - 1] \\times 100\\%$ (Ch 1).
- **Reverse-Collar** — Buy OTM Call + Sell OTM Put of the same expiration. Bullish directional spread with neutralized theta/vega, or short-stock hedge (Ch 3).
- **Rolling** — Closing an existing option leg or spread and simultaneously opening a new contract at a different strike (roll up/down) or expiration (roll out).

### S
- **Stop-Loss Order** — An order to buy or sell a security once it reaches a designated trigger price, turning into a market order to cap losses (Ch 3, Ch 4).
- **Straddle** — Simultaneously trading a call and a put of the same strike and expiration. Long straddle = buy both; Short straddle = sell both (Ch 4).
- **Strangle** — Simultaneously trading an out-of-the-money call and an out-of-the-money put of the same expiration. Long strangle = buy both; Short strangle = sell both (Ch 4).
- **Synthetic Option** — Combining two or more financial instruments to emulate the exact risk/reward profile of another instrument (e.g. Long Stock + Short Call $\\equiv$ Short Put) (Ch 1, Ch 3).

### T
- **Term Structure of Volatility** — The relationship between implied volatility levels across successive expiration months (Ch 6).
- **Theta ($\\\\theta$)** — Sensitivity of an option's theoretical value to the passage of time (decay per day).
- **Time Stop-Loss** — A predetermined calendar date to close a long volatility or time spread if the expected move fails to occur, preventing total theta destruction (Ch 4, Ch 8).

### U
- **Up and Out** — A diagonal adjustment covering a near-term short option and selling a higher-strike option in a deferred expiration month (Ch 1).

### V
- **Vega ($\\\\nu$)** — The sensitivity of theoretical option value to a 1% change in implied volatility.
- **Vertical Spread** — Simultaneously buying and selling options of the same class and expiration but differing strikes (Ch 2).
- **VIX** — Chicago Board Options Exchange Volatility Index; benchmark gauge of 30-day implied volatility derived from S&P 500 options (Ch 8).
