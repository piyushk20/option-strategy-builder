---
name: option-spread-strategies
description: "Comprehensive knowledge base from 'Option Spread Strategies: Trading Up, Down, and Sideways Markets' by Anthony J. Saliba, Joseph C. Corona, and Karen E. Johnson (Bloomberg Press). Use when analyzing, selecting, constructing, and dynamically managing option spreads: covered-writes, verticals, collars, reverse-collars, straddles, strangles, butterflies, condors, calendar time spreads, ratio spreads, and backspreads."
---

<!-- argument-hint: [strategy name, chapter (e.g. ch02), spread type, or pricing formula] -->

# Option Spread Strategies: Trading Up, Down, and Sideways Markets
**Authors**: Anthony J. Saliba with Joseph C. Corona and Karen E. Johnson  
**Publisher**: Bloomberg Press | **Chapters**: 8 + Final Exam | **Focus**: Professional Spread Construction, Greek Dynamics & Arbitrage Mechanics

---

## How to Use This Skill

- **Without arguments** — loads core spread frameworks, Greek management rules, and execution principles.
- **By Strategy** — query `verticals`, `collars`, `butterflies`, `condors`, `calendar spreads`, `ratio spreads`, or `backspreads` to retrieve specific construction blueprints and adjustment mechanics.
- **By Chapter** — query `ch01` through `ch08`, or `ch09` (Final Exam scenarios) to load deep-dive chapter analyses.
- **By Problem / Scenario** — request specific guidance on pricing arbitrage (`box spread`, `jelly roll`), rolling mechanics, or managing adverse market movements.

---

## Core Frameworks & Principles

### 1. The Asymmetric Reality of Option Structures
Every option position is a tradeoff between direction, volatility, and time:
- **No Free Lunch Law**: Positions with positive gamma (straddles, backspreads) will perpetually bleed theta. Positions with positive theta (covered calls, butterflies, short straddles, ratio spreads) carry negative gamma or tail risk.
- **Synthetic Equivalence**: Through put-call parity, every vertical call spread has an identical put spread equivalent, every collar has a synthetic vertical equivalent, and call and put calendar spreads are linked by the Jelly Roll.

### 2. Pricing Parity & Arbitrage Foundations
- **The Box Spread Equation**:
  $$\\text{Bull Call Spread} + \\text{Bear Put Spread} = \\text{Box Spread} = \\frac{K_2 - K_1}{(1 + r)^t}$$
  Use the Box pricing rule to evaluate whether a debit spread or credit spread offers superior market value.
- **The Jelly Roll Equation**:
  $$\\text{Call Time Spread (CTS)} - \\text{Put Time Spread (PTS)} = \\text{Jelly Roll Value (JR)} = K \\times (d_2 - d_1) \\times \\left(\\frac{r}{360}\\right)$$
  Identifies whether call or put time spreads are underpriced based on intermonth interest rate carry.

### 3. The Moneyness & Liquidity Asymmetry
- Deep in-the-money (ITM) options have wide bid-ask spreads because market makers assume large delta hedging risk.
- Out-of-the-money (OTM) options have narrow bid-ask spreads.
- **Saliba's Rule**: When liquidating or rolling a profitable deep ITM spread, never hit the wide bid of the ITM spread. Instead, execute the synthetically equivalent OTM spread to leg into a box, locking in profit without slippage.

### 4. Dynamic Position Management via Spreads
- **Rolling Verticals**: Sell an overlapping butterfly to roll a vertical up or down, taking cash off the table while extending directional reach.
- **Rolling Breakouts (Straddles & Backspreads)**: Sell vertical spreads on the winning leg to extract realized profits and reduce net capital at risk.
- **Capping Ratio Spreads**: When the short strike of a ratio spread is threatened, buy an outer wing to transform it into a capped, limited-risk butterfly.
- **Managing Failed Triggers**: Use calendar spreads to roll un-triggered collars or butterflies into deferred expiration cycles.

### 5. Saliba's Overarching Risk Protocol
> **"If you are wrong, get out!"**  
Never hope, pray, or rationalize. Option positions are built on specific assumptions (direction, magnitude, velocity, and volatility). If those assumptions break, liquidate immediately.

---

## Chapter Index

| Chapter | Title | Primary Strategies & Frameworks |
|---|---|---|
| [ch01](chapters/ch01-the-covered-write.md) | The Covered-Write | Buy-write, synthetic short put, return to call/unchanged, diagonal rolling |
| [ch02](chapters/ch02-verticals.md) | Verticals | Bull/Bear call & put spreads, Box Spread pricing formula, butterfly rolls |
| [ch03](chapters/ch03-collars-and-reverse-collars.md) | Collars and Reverse-Collars | Speculative breakout collars, equity hedging, volatility skew exploitation |
| [ch04](chapters/ch04-straddles-and-strangles.md) | Straddles and Strangles | Nondirectional volatility trading, M & W Greek curves, IV crush, dual stops |
| [ch05](chapters/ch05-butterflies-and-condors.md) | Butterflies and Condors | Directionless trading, mean-reversion, stretching flies to condors, synthetic exit |
| [ch06](chapters/ch06-calendar-spreads.md) | Calendar Spreads | Horizontal time spreads, term structure IV, Jelly Roll pricing, early arrival |
| [ch07](chapters/ch07-ratio-spreads.md) | Ratio Spreads | Contratrend trading, 1:2 / 2:3 ratios, delta growth, capping into butterflies |
| [ch08](chapters/ch08-backspreads.md) | Backspreads | High-velocity breakout volatility spreads, danger zone, back door puts |
| [ch09](chapters/ch09-final-exam-scenarios.md) | Final Exam & Scenarios | 50 master diagnostic questions + 5 real-world multi-step portfolio scenarios |

---

## Topic & Strategy Index

- **Backspreads** (Call & Put) $\\rightarrow$ [ch08](chapters/ch08-backspreads.md), [patterns.md](patterns.md)
- **Box Spreads & Parity** $\\rightarrow$ [ch02](chapters/ch02-verticals.md), [ch09](chapters/ch09-final-exam-scenarios.md), [cheatsheet.md](cheatsheet.md)
- **Butterflies & Condors** $\\rightarrow$ [ch05](chapters/ch05-butterflies-and-condors.md), [patterns.md](patterns.md)
- **Calendar Spreads (Time Spreads)** $\\rightarrow$ [ch06](chapters/ch06-calendar-spreads.md), [patterns.md](patterns.md)
- **Collars & Reverse-Collars** $\\rightarrow$ [ch03](chapters/ch03-collars-and-reverse-collars.md), [patterns.md](patterns.md)
- **Covered-Write / Buy-Write** $\\rightarrow$ [ch01](chapters/ch01-the-covered-write.md), [patterns.md](patterns.md)
- **Greeks & Dynamics (Delta, Gamma, Vega, Theta)** $\\rightarrow$ [cheatsheet.md](cheatsheet.md), all chapters
- **Implied Volatility Skew & Term Structure** $\\rightarrow$ [ch03](chapters/ch03-collars-and-reverse-collars.md), [ch06](chapters/ch06-calendar-spreads.md), [ch07](chapters/ch07-ratio-spreads.md)
- **Jelly Rolls & Parity** $\\rightarrow$ [ch06](chapters/ch06-calendar-spreads.md), [cheatsheet.md](cheatsheet.md)
- **Ratio Spreads** (Call & Put) $\\rightarrow$ [ch07](chapters/ch07-ratio-spreads.md), [patterns.md](patterns.md)
- **Rolling Mechanics via Butterflies & Verticals** $\\rightarrow$ [ch02](chapters/ch02-verticals.md), [ch05](chapters/ch05-butterflies-and-condors.md), [ch08](chapters/ch08-backspreads.md)
- **Straddles & Strangles** $\\rightarrow$ [ch04](chapters/ch04-straddles-and-strangles.md), [patterns.md](patterns.md)
- **Synthetic Equivalents & Conversion/Reversal** $\\rightarrow$ [ch01](chapters/ch01-the-covered-write.md), [ch02](chapters/ch02-verticals.md), [ch03](chapters/ch03-collars-and-reverse-collars.md)

---

## Supporting Files

- [cheatsheet.md](cheatsheet.md) — Fast-lookup decision matrix, Greeks table, arbitrage formulas, and golden execution heuristics.
- [patterns.md](patterns.md) — Technical blueprints, execution legs, payoff formulas, and adjustment procedures for every spread type.
- [glossary.md](glossary.md) — Comprehensive alphabetical glossary of all derivative concepts, market dynamics, and spread nomenclature.

---

## Scope & Limits

This skill encapsulates the formal option spread trading methodology developed by Anthony J. Saliba, Joseph C. Corona, and Karen E. Johnson. It covers equity and index options spread construction, risk management, and pricing arbitrage. Always verify local market margin requirements, transaction costs, and option contract specifications before executing live orders.
