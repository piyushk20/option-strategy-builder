"""
Professional Options Strategist Engine
Implements Anthony J. Saliba's Spread Trading Framework:
"Option Spread Strategies: Trading Up, Down, and Sideways Markets" (Bloomberg Press)
Covers Chapters 01 through 08 with regime classification, tactical adjustment rules,
and Box Spread Parity evaluations for NSE Equities & Indices.
"""

def determine_market_regime(spot: float, vix: float, pcr: float) -> dict:
    """
    Classifies the market environment into Volatility, Bias, and Structure.
    """
    # 1. Volatility Regime (Saliba Ch 4 & Ch 6)
    if vix < 12.5:
        vol_regime = "Low"
        vol_desc = "Low IV environment favoring Debit Spreads, Butterflies, and Calendar Time Spreads."
    elif vix <= 17.5:
        vol_regime = "Normal"
        vol_desc = "Balanced volatility with standard spread pricing dynamics."
    elif vix <= 23.0:
        vol_regime = "Elevated"
        vol_desc = "High premium environment favoring Credit Spreads, Iron Condors, and Ratio Spreads."
    else:
        vol_regime = "Extreme"
        vol_desc = "Extreme IV crush risk. Backspreads and strictly defined-risk structures advised."

    # 2. Market Bias from PCR & Sentiment
    if pcr > 1.3:
        bias = "Strong Bullish"
        bias_desc = "High put writing indicates strong institutional support beneath spot."
    elif pcr > 1.05:
        bias = "Moderate Bullish"
        bias_desc = "Bullish tilt with healthy put cushion."
    elif pcr >= 0.85:
        bias = "Neutral / Range-Bound"
        bias_desc = "Balanced order flow. Range-bound pinning expected at Max Pain."
    elif pcr >= 0.65:
        bias = "Moderate Bearish"
        bias_desc = "Call accumulation capping upward trajectory."
    else:
        bias = "Strong Bearish"
        bias_desc = "Heavy call writing resistance overhead."

    # 3. Market Structure / Trend
    if "Strong" in bias:
        trend = "Strong Trend"
    elif "Moderate" in bias:
        trend = "Weak Trend"
    else:
        trend = "Range-Bound"

    return {
        "volatility": vol_regime,
        "volatility_desc": vol_desc,
        "bias": bias,
        "bias_desc": bias_desc,
        "trend": trend,
        "vix": vix,
        "pcr": pcr
    }


def evaluate_box_arbitrage(k_lower: float, k_upper: float, call_spread_debit: float, put_spread_credit: float, days: int = 7, r: float = 0.065) -> dict:
    """
    Saliba Chapter 2 Box Arbitrage Rule:
    Box Value = (K2 - K1) / (1 + r)^t
    Call Spread Value + Put Spread Value = Box Value
    """
    t = max(1, days) / 365.0
    box_val = (k_upper - k_lower) / ((1.0 + r) ** t)
    combined = call_spread_debit + put_spread_credit
    diff = combined - box_val
    
    if diff > 0.05:
        best = "Credit Put Spread"
        note = f"Selling Put Spread is more advantageous (Combined {combined:.2f} > Box Fair Value {box_val:.2f})"
    elif diff < -0.05:
        best = "Debit Call Spread"
        note = f"Buying Call Spread is more advantageous (Combined {combined:.2f} < Box Fair Value {box_val:.2f})"
    else:
        best = "Equally Priced"
        note = f"Call and Put spreads are priced within theoretical Box parity ({box_val:.2f})"
        
    return {
        "box_fair_value": round(box_val, 2),
        "recommended_vehicle": best,
        "edge_explanation": note
    }


def get_saliba_adjustment_playbook(strategy_name: str, strikes: dict = None) -> dict:
    """
    Returns Saliba's tactical trade management and adjustment rules for Chapters 01 to 08.
    """
    strikes = strikes or {}
    s_lower = strategy_name.lower()
    
    if "covered" in s_lower or "buy-write" in s_lower:
        return {
            "on_target_reached": "Return to Called achieved: Allow underlying to be assigned at short call strike, or roll out & up diagonally to capture incremental upside (Saliba Ch 1).",
            "on_adverse_drop": "Return to Unchanged defense: If stock drops below original breakeven, roll the short call down to lower strike to increase downside premium cushion, or convert to a Collar by purchasing a put.",
            "on_failure": "Liquidate underlying equity if fundamental thesis or structural support fails."
        }
    elif "reverse-collar" in s_lower or "reverse collar" in s_lower:
        return {
            "on_upside_breakout": "Gamma expands as underlying breaks out above long call strike. Roll winning long call up via vertical spreads to lock in cash while maintaining upside. Close trailing worthless short put to eliminate tail risk (Saliba Ch 3).",
            "on_support_threatened": "If underlying breaches support and tests short put, trigger stop-loss order immediately. Do not hold losing naked short puts without protection (Saliba Ch 3).",
            "on_stalled_consolidation": "If position fails to trigger before expiration, roll both legs into next expiration cycle using calendar spreads (Saliba Ch 3 & Ch 6)."
        }
    elif "speculative collar" in s_lower:
        return {
            "on_downside_breakout": "Put accelerates into profit on breakdown below support. Roll long put down via vertical spreads to bank cash. Close trailing short call once worthless to eliminate upside tail risk (Saliba Ch 3).",
            "on_resistance_threatened": "If underlying unexpectedly rallies and tests short call, enforce strict stop-loss at resistance. Never hold an uncovered short call through adverse breakouts (Saliba Ch 3).",
            "on_stalled_consolidation": "Zero-theta structure allows holding through consolidation without time decay penalty. Roll forward via calendar spreads if expiration nears without breakout (Saliba Ch 3)."
        }
    elif "collar" in s_lower:
        return {
            "on_target_reached": "If stock rallies through short call, decide whether to accept assignment at ceiling, or roll short call up and out diagonally to harvest more upside (Saliba Ch 3).",
            "on_adverse_drop": "Put floor activates: Downside loss is 100% capped at the put strike (Synthetic Bull Vertical). Exercise put or sell stock to close hedge with zero tail loss (Saliba Ch 3).",
            "on_stalled_consolidation": "Collar is 100% defined-risk. If price stalls near unchanged, collect short call premium and roll forward into next cycle."
        }
    elif "debit spread" in s_lower or ("vertical" in s_lower and "bull" in s_lower):
        k1 = strikes.get("buy", 0)
        k2 = strikes.get("sell", 0)
        k3 = k2 + abs(k2 - k1) if k1 and k2 else "outer wing"
        return {
            "on_target_reached": f"Roll Up: Sell the {k1}/{k2}/{k3} butterfly to bank cash, de-risk, and extend upside participation (Saliba Ch 2).",
            "on_deep_itm": "Leg into a Box: Buy the synthetically equivalent OTM put spread to lock in maximum spread value without paying wide ITM bid-ask slippage (Saliba Ch 2).",
            "on_failure": "If support/resistance is broken, exit immediately! Do not hold hoping for a rebound."
        }
    elif "credit spread" in s_lower:
        return {
            "on_profit": "Take partial profits when 60-80% of credit is captured; never hold into expiration day for the last nickels (Saliba Ch 2).",
            "on_threatened": "If price tests short strike, roll strike further out or convert to Iron Condor/Butterfly to cap risk.",
            "on_failure": "Enforce strict stop-loss at 2x net credit collected."
        }
    elif "backspread" in s_lower:
        return {
            "on_target_reached": "Explosive breakout: Gamma and Vega expand exponentially. Roll winning long options into vertical spreads to lock in gains and de-risk (Saliba Ch 8).",
            "on_danger_zone": "DANGER ZONE ALERT: If price stalls between the short and long strikes near expiry, maximum loss occurs. Close immediately if momentum stalls inside the valley (Saliba Ch 8).",
            "on_failure": "On opposite moves, if entered at even money or small credit, position expires with zero loss."
        }
    elif "ratio spread" in s_lower or "ratio" in s_lower:
        return {
            "on_target_reached": "Take partial profits as price approaches short strike and IV collapses (Saliba Ch 7).",
            "on_short_strike_tested": "CRITICAL CAPPING RULE: When the short strike is threatened, buy an outer wing option immediately to convert the ratio spread into a defined-risk butterfly (Saliba Ch 7).",
            "on_opposite_move": "If entered for credit or even money, there is zero risk on adverse moves; hold through expiry."
        }
    elif "butterfly" in s_lower or "fly" in s_lower:
        return {
            "on_profit": "Scale out 50% when price is hovering at body; or buy back inside short straddle to leave a free long strangle at the wings (Saliba Ch 5).",
            "on_range_widening": "Buy an adjacent butterfly to convert the structure into a wider long condor (Saliba Ch 5).",
            "on_failure": "Accept limited loss if underlying moves outside outer wings."
        }
    elif "condor" in s_lower:
        return {
            "on_profit": "Take profits when 60-70% max gain is reached. Do not hold through expiration week pin risk (Saliba Ch 5).",
            "on_wing_threatened": "Roll untested side closer to collect additional credit, or close the tested vertical.",
            "on_failure": "Hard stop if underlying breaches short strike."
        }
    elif "calendar" in s_lower or "time spread" in s_lower:
        return {
            "on_profit": "Capture front-month theta decay as front option approaches expiration. Close position before front expiry to capture peak term-structure expansion (Saliba Ch 6).",
            "on_early_arrival": "Avoid 'early arrival syndrome' — if underlying moves sharply away from strike early in cycle, roll the spread strike to re-center on spot (Saliba Ch 6).",
            "on_failure": "Exit if IV term structure inverts or front-month moves deep ITM."
        }
    elif "straddle" in s_lower or "strangle" in s_lower:
        return {
            "on_profit": "Roll winning long leg along with the trend by selling vertical spreads to extract cash (Saliba Ch 4).",
            "on_failure": "Enforce dual stops: both a price stop-loss and a strict calendar time stop-loss (Saliba Ch 4)."
        }
    else:
        return {
            "on_profit": "Take profits dynamically and trail stops according to Greek shifts.",
            "on_failure": "Enforce strict risk limit and never let defined-risk trades turn into undefined-risk gambles."
        }


def get_recommendations(nse_data: dict, custom_vix: float = None, custom_trend: str = None) -> dict:
    """
    Analyzes the NSE option chain data, determines the regime,
    and returns a ranked list of buying and selling strategies
    comprehensively covering Anthony Saliba's Chapters 01 to 08.
    """
    spot = nse_data["underlying_price"]
    pcr = nse_data["pcr"]
    vix = custom_vix if custom_vix is not None else 14.5
    
    regime = determine_market_regime(spot, vix, pcr)
    if custom_trend:
        regime["trend"] = custom_trend
        
    trend = regime["trend"]
    bias = regime["bias"]
    vol = regime["volatility"]
    
    atm_strike = nse_data["atm_strike"]
    max_pain = nse_data.get("max_pain", atm_strike)
    max_ce_oi_strike = nse_data.get("max_call_oi_strike", atm_strike + 200) # Resistance
    max_pe_oi_strike = nse_data.get("max_put_oi_strike", atm_strike - 200)  # Support
    
    if max_ce_oi_strike <= atm_strike:
        max_ce_oi_strike = atm_strike + 200
    if max_pe_oi_strike >= atm_strike:
        max_pe_oi_strike = atm_strike - 200

    strikes = [s["strike"] for s in nse_data["strikes"]]
    strike_step = 50 if len(strikes) < 2 else int(sorted(strikes)[1] - sorted(strikes)[0])
    
    def closest_strike(target):
        if not strikes: return target
        return min(strikes, key=lambda x: abs(x - target))
        
    # Helper to fetch leg quote
    def get_quote(strike, opt_type):
        row = next((s[opt_type] for s in nse_data["strikes"] if s["strike"] == strike), None)
        return row["ltp"] if row and "ltp" in row else 25.0

    # ------------------ BUYING PLAYBOOK (Chapters 2, 3, 4, 5, 6, 8) ------------------
    buying_candidates = []
    
    # 1. Chapter 4: Long Directional Option (Strong Trends)
    long_type = "Call" if "Bullish" in bias else "Put"
    long_strike = atm_strike 
    prem = get_quote(long_strike, "CE" if long_type == "Call" else "PE")
    target = max_ce_oi_strike if long_type == "Call" else max_pe_oi_strike
    
    buying_candidates.append({
        "name": f"Long {long_type}",
        "type": "buying",
        "saliba_framework": "Chapter 4: Volatility & Direction",
        "description": f"Direct long {long_type} riding the {bias.lower()} trend. Targets the OI wall at {target}. Premium: Rs.{prem:.2f}.",
        "strikes": f"Buy 1x {long_strike} {long_type} @ Rs.{prem:.2f}",
        "max_loss": f"Rs.{prem:.2f} per share",
        "max_profit": "Uncapped" if long_type == "Call" else f"Rs.{(long_strike - prem):.2f} per share",
        "breakeven": f"Rs.{(long_strike + prem if long_type == 'Call' else long_strike - prem):.2f}",
        "risk_reward": "Uncapped (Asymmetrical)",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"High momentum bias ({bias}) targeting major OI wall at {target}.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Long Option", {}),
        "score": 92 if trend == "Strong Trend" and vol != "Extreme" else 55
    })
    
    # 2. Chapter 2: Vertical Debit Spread (Saliba Ch 2)
    spread_type = "Bull Call" if "Bullish" in bias or bias == "Neutral" else "Bear Put"
    buy_k = atm_strike
    sell_k = closest_strike(max_ce_oi_strike) if spread_type == "Bull Call" else closest_strike(max_pe_oi_strike)
    
    b_prem = get_quote(buy_k, "CE" if spread_type == "Bull Call" else "PE")
    s_prem = get_quote(sell_k, "CE" if spread_type == "Bull Call" else "PE")
    
    net_debit = max(1.0, b_prem - s_prem)
    width = abs(sell_k - buy_k)
    max_prof = max(0.5, width - net_debit)
    
    buying_candidates.append({
        "name": f"{spread_type} Debit Spread",
        "type": "buying",
        "saliba_framework": "Chapter 2: Verticals & Box Parity",
        "description": f"Defined-risk vertical capturing directional flow while funding long option with short wing at {sell_k}. Net Debit: Rs.{net_debit:.2f}.",
        "strikes": f"Buy 1x {buy_k} {'CE' if 'Call' in spread_type else 'PE'} @ Rs.{b_prem:.2f} | Sell 1x {sell_k} {'CE' if 'Call' in spread_type else 'PE'} @ Rs.{s_prem:.2f}",
        "max_loss": f"Rs.{net_debit:.2f} per share",
        "max_profit": f"Rs.{max_prof:.2f} per share",
        "breakeven": f"Rs.{(buy_k + net_debit if 'Call' in spread_type else buy_k - net_debit):.2f}",
        "risk_reward": f"1:{max_prof/net_debit:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Moderate directional bias ({bias}) with defined risk and reduced theta drag.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Debit Spread", {"buy": buy_k, "sell": sell_k}),
        "score": 95 if trend in ["Strong Trend", "Weak Trend"] and vol in ["Normal", "Low"] else 65
    })
    
    # 3. Chapter 8: Ratio Backspread (Breakout Volatility)
    back_type = "Call" if "Bullish" in bias or bias == "Neutral" else "Put"
    k_short = atm_strike
    k_long = closest_strike(atm_strike + strike_step) if back_type == "Call" else closest_strike(atm_strike - strike_step)
    
    p_short = get_quote(k_short, "CE" if back_type == "Call" else "PE")
    p_long = get_quote(k_long, "CE" if back_type == "Call" else "PE")
    
    net_bs_cost = (2 * p_long) - p_short
    danger_zone_loss = abs(k_long - k_short) + net_bs_cost
    
    buying_candidates.append({
        "name": f"{back_type} Ratio Backspread",
        "type": "buying",
        "saliba_framework": "Chapter 8: Backspreads (Volatility)",
        "description": f"1x2 Volatility Breakout: Sell 1 ATM, Buy 2 OTM. Net Outlay: Rs.{net_bs_cost:.2f}. Explodes if price moves sharply.",
        "strikes": f"Sell 1x {k_short} {'CE' if back_type == 'Call' else 'PE'} @ Rs.{p_short:.2f} | Buy 2x {k_long} {'CE' if back_type == 'Call' else 'PE'} @ Rs.{p_long:.2f}",
        "max_loss": f"Rs.{danger_zone_loss:.2f} per share (at {k_long} Danger Zone)",
        "max_profit": "Uncapped (Positive Gamma & Vega)",
        "breakeven": f"Lower: Rs.{(k_short - net_bs_cost if back_type == 'Call' else k_long - danger_zone_loss):.2f} | Upper: Rs.{(k_long + danger_zone_loss if back_type == 'Call' else k_short + net_bs_cost):.2f}",
        "risk_reward": "Uncapped Upside / Low Cash Outlay",
        "risk_type": "DEFINED RISK (SURVIVE DANGER ZONE)",
        "fit_reason": f"Designed for explosive momentum breakouts with expanding volatility.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Backspread", {"short": k_short, "long": k_long}),
        "score": 90 if vol in ["Normal", "Elevated"] and trend == "Strong Trend" else 60
    })

    # 4. Chapter 5: Long Call Butterfly (Neutral Pinning)
    k_center = closest_strike(max_pain)
    k_lower = closest_strike(k_center - strike_step)
    k_upper = closest_strike(k_center + strike_step)
    
    p_lower = get_quote(k_lower, "CE")
    p_center = get_quote(k_center, "CE")
    p_upper = get_quote(k_upper, "CE")
    bf_cost = max(2.0, (p_lower + p_upper) - 2 * p_center)
    bf_max_profit = max(1.0, strike_step - bf_cost)
    
    buying_candidates.append({
        "name": "Long Call Butterfly",
        "type": "buying",
        "saliba_framework": "Chapter 5: Butterflies & Condors",
        "description": f"Defined-risk range trade centered directly on Max Pain ({k_center}). Net Debit: Rs.{bf_cost:.2f}.",
        "strikes": f"Buy 1x {k_lower} CE @ Rs.{p_lower:.2f} | Sell 2x {k_center} CE @ Rs.{p_center:.2f} | Buy 1x {k_upper} CE @ Rs.{p_upper:.2f}",
        "max_loss": f"Rs.{bf_cost:.2f} per share",
        "max_profit": f"Rs.{bf_max_profit:.2f} per share",
        "breakeven": f"Lower: Rs.{(k_lower + bf_cost):.2f} | Upper: Rs.{(k_upper - bf_cost):.2f}",
        "risk_reward": f"1:{bf_max_profit/bf_cost:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Exploits peak positive theta decay centered on Max Pain ({k_center}) with zero tail risk.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Butterfly", {"body": k_center}),
        "score": 94 if trend == "Range-Bound" and vol in ["Normal", "Low"] else 52
    })

    # 5. Chapter 3: Classic Equity Collar (Hedging & Protection)
    collar_put_k = closest_strike(atm_strike - strike_step)
    collar_call_k = closest_strike(max_ce_oi_strike)
    p_collar_put = get_quote(collar_put_k, "PE")
    p_collar_call = get_quote(collar_call_k, "CE")
    net_collar_drag = p_collar_put - p_collar_call
    
    buying_candidates.append({
        "name": "Classic Equity Collar",
        "type": "buying",
        "saliba_framework": "Chapter 3: Collars & Reverse-Collars",
        "description": f"Portfolio Crash Insurance: Long Spot, Long Protective Put ({collar_put_k}), funded by Short OTM Call ({collar_call_k}). Net Option Cost: Rs.{net_collar_drag:.2f}. Synthesizes a protected Bull Call Vertical.",
        "strikes": f"Buy 1x {spot:.0f} Spot @ Rs.{spot:.2f} | Buy 1x {collar_put_k} Put @ Rs.{p_collar_put:.2f} | Sell 1x {collar_call_k} Call @ Rs.{p_collar_call:.2f}",
        "max_loss": f"Rs.{abs(spot - collar_put_k + net_collar_drag):.2f} per share (Floor at {collar_put_k})",
        "max_profit": f"Rs.{(collar_call_k - spot - net_collar_drag):.2f} per share (Capped at {collar_call_k})",
        "breakeven": f"Rs.{(spot + net_collar_drag):.2f}",
        "risk_reward": "Fully Hedged Downside / Capped Upside",
        "risk_type": "DEFINED RISK",
        "fit_reason": "Guaranteed downside floor with near-zero net option outlay in volatile or uncertain markets.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Collar", {"put": collar_put_k, "call": collar_call_k}),
        "score": 88 if vol in ["Elevated", "Extreme"] or bias == "Moderate Bearish" else 52
    })

    # 5b. Chapter 3: Speculative Bearish Collar (Zero-Theta Breakdown Play)
    spec_put_k = closest_strike(atm_strike - strike_step)
    spec_call_k = closest_strike(atm_strike + 2 * strike_step)
    p_spec_put = get_quote(spec_put_k, "PE")
    p_spec_call = get_quote(spec_call_k, "CE")
    net_spec_collar = p_spec_put - p_spec_call

    buying_candidates.append({
        "name": "Speculative Bearish Collar",
        "type": "buying",
        "saliba_framework": "Chapter 3: Collars & Reverse-Collars",
        "description": f"Zero-Theta Breakdown Setup: Buy OTM Put ({spec_put_k}) funded by Short OTM Call ({spec_call_k}). Net Cost: {'Credit Rs.' + str(round(abs(net_spec_collar), 2)) if net_spec_collar < 0 else 'Debit Rs.' + str(round(net_spec_collar, 2))}. Flat theta lets you await technical breakdown without timing decay.",
        "strikes": f"Buy 1x {spec_put_k} Put @ Rs.{p_spec_put:.2f} | Sell 1x {spec_call_k} Call @ Rs.{p_spec_call:.2f}",
        "max_loss": f"Unlimited above {spec_call_k} (Naked Call Risk - Stop Loss at {spec_call_k})",
        "max_profit": f"Rs.{(spec_put_k - net_spec_collar):.2f} per share below {spec_put_k}",
        "breakeven": f"Downside: Rs.{(spec_put_k - net_spec_collar):.2f} | Upside Breach: Rs.{(spec_call_k + abs(net_spec_collar)):.2f}",
        "risk_reward": "Asymmetrical Downside Gain / Undefined Upside Risk",
        "risk_type": "UNDEFINED RISK (UPSIDE)",
        "fit_reason": "Captures high-velocity downside breaks with zero time decay penalty during consolidation.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Speculative Collar", {"put": spec_put_k, "call": spec_call_k}),
        "score": 90 if bias in ["Bearish", "Moderate Bearish"] and vol in ["Elevated", "Normal"] else 46
    })

    # 5c. Chapter 3: Speculative Bullish Reverse-Collar (Volatility Skew Exploitation)
    rev_call_k = closest_strike(atm_strike + strike_step)
    rev_put_k = closest_strike(atm_strike - 2 * strike_step)
    p_rev_call = get_quote(rev_call_k, "CE")
    p_rev_put = get_quote(rev_put_k, "PE")
    net_rev_collar = p_rev_call - p_rev_put

    buying_candidates.append({
        "name": "Bullish Reverse-Collar",
        "type": "buying",
        "saliba_framework": "Chapter 3: Collars & Reverse-Collars",
        "description": f"Equity Skew Exploitation: Sell rich high-IV Put ({rev_put_k}) at support to fund OTM Breakout Call ({rev_call_k}). Net: {'Credit Rs.' + str(round(abs(net_rev_collar), 2)) if net_rev_collar <= 0 else 'Debit Rs.' + str(round(net_rev_collar, 2))}. Uncapped upside participation.",
        "strikes": f"Buy 1x {rev_call_k} Call @ Rs.{p_rev_call:.2f} | Sell 1x {rev_put_k} Put @ Rs.{p_rev_put:.2f}",
        "max_loss": f"Rs.{(rev_put_k + net_rev_collar):.2f} per share (Substantial below {rev_put_k})",
        "max_profit": "Unlimited above breakout call strike",
        "breakeven": f"Rs.{(rev_call_k + net_rev_collar):.2f}",
        "risk_reward": "Unlimited Upside / High-Probability Skew Arbitrage",
        "risk_type": "SUBSTANTIAL RISK (DOWNSIDE)",
        "fit_reason": "Sells overpriced downside volatility to fund upside breakout participation at zero or negative cost.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Reverse-Collar", {"call": rev_call_k, "put": rev_put_k}),
        "score": 93 if bias in ["Bullish", "Moderate Bullish", "Strong Trend"] and vol != "Extreme" else 54
    })

    # 6. Chapter 4: Long Strangle (Non-Directional Breakout)
    strangle_ce_k = closest_strike(atm_strike + strike_step)
    strangle_pe_k = closest_strike(atm_strike - strike_step)
    p_st_ce = get_quote(strangle_ce_k, "CE")
    p_st_pe = get_quote(strangle_pe_k, "PE")
    strangle_cost = p_st_ce + p_st_pe

    buying_candidates.append({
        "name": "Long Strangle",
        "type": "buying",
        "saliba_framework": "Chapter 4: Straddles & Strangles",
        "description": f"Dual-winged volatility play buying OTM Call ({strangle_ce_k}) & OTM Put ({strangle_pe_k}). Net Outlay: Rs.{strangle_cost:.2f}.",
        "strikes": f"Buy 1x {strangle_ce_k} Call @ Rs.{p_st_ce:.2f} | Buy 1x {strangle_pe_k} Put @ Rs.{p_st_pe:.2f}",
        "max_loss": f"Rs.{strangle_cost:.2f} per share",
        "max_profit": "Uncapped on sharp bidirectional breakout",
        "breakeven": f"Lower: Rs.{(strangle_pe_k - strangle_cost):.2f} | Upper: Rs.{(strangle_ce_k + strangle_cost):.2f}",
        "risk_reward": "Asymmetrical Positive Vega / High Volatility Play",
        "risk_type": "DEFINED RISK",
        "fit_reason": "Positions for sharp multi-hundred point moves across impending binary catalysts.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Strangle", {}),
        "score": 86 if vol == "Low" and trend == "Range-Bound" else 45
    })

    # 7. Chapter 6: Long Calendar Spread (Time Spread)
    cal_k = atm_strike
    p_near_ce = get_quote(cal_k, "CE")
    est_far_ce = round(p_near_ce * 1.38, 2)
    cal_cost = max(5.0, est_far_ce - p_near_ce)

    buying_candidates.append({
        "name": "Long Calendar Spread",
        "type": "buying",
        "saliba_framework": "Chapter 6: Calendar Spreads (Time Spreads)",
        "description": f"Horizontal Time Spread: Sell near-expiry {cal_k} Call, Buy far-month {cal_k} Call. Exploits differential theta decay.",
        "strikes": f"Sell 1x {cal_k} Call @ Rs.{p_near_ce:.2f} | Buy 1x {cal_k} Call @ Rs.{est_far_ce:.2f}",
        "max_loss": f"Rs.{cal_cost:.2f} per share (Net Debit paid)",
        "max_profit": f"Rs.{(cal_cost * 1.6):.2f} per share (Peak at {cal_k} on near expiry)",
        "breakeven": f"Lower: Rs.{(cal_k - cal_cost):.2f} | Upper: Rs.{(cal_k + cal_cost):.2f}",
        "risk_reward": "Positive Vega / Term Structure Arbitrage",
        "risk_type": "DEFINED RISK",
        "fit_reason": "Low IV regime where back-month options gain value while front-month options rapidly decay.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Calendar", {"strike": cal_k}),
        "score": 87 if vol == "Low" and trend == "Range-Bound" else 46
    })

    buying_candidates = sorted(buying_candidates, key=lambda x: x["score"], reverse=True)
    for idx, cand in enumerate(buying_candidates): cand["rank"] = idx + 1
        
    # ------------------ SELLING PLAYBOOK (Chapters 1, 2, 4, 5, 7) ------------------
    selling_candidates = []
    
    # 1. Chapter 2: Credit Vertical Spread (Saliba Ch 2)
    cred_type = "Bull Put" if "Bullish" in bias or bias == "Neutral" else "Bear Call"
    sell_strike_cr = closest_strike(max_pe_oi_strike) if cred_type == "Bull Put" else closest_strike(max_ce_oi_strike)
    buy_strike_cr = sell_strike_cr - strike_step if cred_type == "Bull Put" else sell_strike_cr + strike_step
    
    s_prem_cr = get_quote(sell_strike_cr, "PE" if cred_type == "Bull Put" else "CE")
    b_prem_cr = get_quote(buy_strike_cr, "PE" if cred_type == "Bull Put" else "CE")
    
    net_credit_cr = max(0.5, s_prem_cr - b_prem_cr)
    max_loss_cr = max(1.0, abs(sell_strike_cr - buy_strike_cr) - net_credit_cr)
    
    selling_candidates.append({
        "name": f"{cred_type} Credit Spread",
        "type": "selling",
        "saliba_framework": "Chapter 2: Verticals & Income",
        "description": f"High-probability income vertical anchored outside the {sell_strike_cr} OI wall. Net Credit: Rs.{net_credit_cr:.2f}.",
        "strikes": f"Sell 1x {sell_strike_cr} {'PE' if 'Put' in cred_type else 'CE'} @ Rs.{s_prem_cr:.2f} | Buy 1x {buy_strike_cr} {'PE' if 'Put' in cred_type else 'CE'} @ Rs.{b_prem_cr:.2f}",
        "max_loss": f"Rs.{max_loss_cr:.2f} per share",
        "max_profit": f"Rs.{net_credit_cr:.2f} per share",
        "breakeven": f"Rs.{(sell_strike_cr - net_credit_cr if 'Put' in cred_type else sell_strike_cr + net_credit_cr):.2f}",
        "risk_reward": f"1:{net_credit_cr/max_loss_cr:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"High probability of expiring worthless anchored behind the strong OI wall at {sell_strike_cr}.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Credit Spread", {"sell": sell_strike_cr, "buy": buy_strike_cr}),
        "score": 95 if trend in ["Range-Bound", "Weak Trend"] and vol in ["Normal", "Elevated"] else 60
    })

    # 2. Chapter 5: Iron Condor (Range-Bound Theta Income)
    pe_sell_ic = closest_strike(max_pe_oi_strike)
    pe_buy_ic = closest_strike(pe_sell_ic - strike_step)
    ce_sell_ic = closest_strike(max_ce_oi_strike)
    ce_buy_ic = closest_strike(ce_sell_ic + strike_step)
    
    ic_pe_cred = max(0.5, get_quote(pe_sell_ic, "PE") - get_quote(pe_buy_ic, "PE"))
    ic_ce_cred = max(0.5, get_quote(ce_sell_ic, "CE") - get_quote(ce_buy_ic, "CE"))
    tot_ic_credit = ic_pe_cred + ic_ce_cred
    ic_max_loss = max(1.0, strike_step - tot_ic_credit)
    
    selling_candidates.append({
        "name": "Iron Condor",
        "type": "selling",
        "saliba_framework": "Chapter 5: Directionless Condors",
        "description": f"Delta-neutral four-legged strangle wing trade across {pe_sell_ic} - {ce_sell_ic}. Net Credit: Rs.{tot_ic_credit:.2f}.",
        "strikes": f"Buy 1x {pe_buy_ic} PE @ Rs.{get_quote(pe_buy_ic, 'PE'):.2f} | Sell 1x {pe_sell_ic} PE @ Rs.{get_quote(pe_sell_ic, 'PE'):.2f} | Sell 1x {ce_sell_ic} CE @ Rs.{get_quote(ce_sell_ic, 'CE'):.2f} | Buy 1x {ce_buy_ic} CE @ Rs.{get_quote(ce_buy_ic, 'CE'):.2f}",
        "max_loss": f"Rs.{ic_max_loss:.2f} per share",
        "max_profit": f"Rs.{tot_ic_credit:.2f} per share",
        "breakeven": f"Lower: Rs.{(pe_sell_ic - tot_ic_credit):.2f} | Upper: Rs.{(ce_sell_ic + tot_ic_credit):.2f}",
        "risk_reward": f"1:{tot_ic_credit/ic_max_loss:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Harvests twin theta decay between key support ({pe_sell_ic}) and resistance ({ce_sell_ic}) walls.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Iron Condor", {"pe_short": pe_sell_ic, "ce_short": ce_sell_ic}),
        "score": 93 if trend == "Range-Bound" and vol in ["Normal", "Elevated"] else 55
    })

    # 3. Chapter 7: 1:2 Ratio Spread (Contratrend Trading)
    ratio_type = "Call" if bias in ["Neutral", "Weak Trend", "Moderate Bullish"] else "Put"
    k_long_rat = atm_strike
    k_short_rat = closest_strike(max_ce_oi_strike if ratio_type == "Call" else max_pe_oi_strike)
    
    if k_short_rat == k_long_rat:
        k_short_rat = k_long_rat + strike_step if ratio_type == "Call" else k_long_rat - strike_step
        
    p_long_rat = get_quote(k_long_rat, "CE" if ratio_type == "Call" else "PE")
    p_short_rat = get_quote(k_short_rat, "CE" if ratio_type == "Call" else "PE")
    
    net_rat_credit = (2 * p_short_rat) - p_long_rat
    rat_max_profit = abs(k_short_rat - k_long_rat) + net_rat_credit
    
    selling_candidates.append({
        "name": f"1:2 {ratio_type} Ratio Spread",
        "type": "selling",
        "saliba_framework": "Chapter 7: Ratio Spreads (Contratrend)",
        "description": f"Buy 1 ATM, Sell 2 at OI Wall ({k_short_rat}). Net Cash Flow: {'Credit' if net_rat_credit >= 0 else 'Debit'} Rs.{abs(net_rat_credit):.2f}.",
        "strikes": f"Buy 1x {k_long_rat} {ratio_type} @ Rs.{p_long_rat:.2f} | Sell 2x {k_short_rat} {ratio_type} @ Rs.{p_short_rat:.2f}",
        "max_loss": "Substantial if price blows through short strike (Cap into Butterfly if tested!)",
        "max_profit": f"Rs.{rat_max_profit:.2f} per share (at {k_short_rat})",
        "breakeven": f"Tail risk begins beyond Rs.{(k_short_rat + rat_max_profit if ratio_type == 'Call' else k_short_rat - rat_max_profit):.2f}",
        "risk_reward": "Positive Theta / High Win-Rate",
        "risk_type": "UNDEFINED RISK (CAPPABLE)",
        "fit_reason": f"Contratrend bounce into {k_short_rat} OI Wall with falling IV and rapid theta growth.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Ratio", {"short": k_short_rat, "long": k_long_rat}),
        "score": 90 if trend in ["Weak Trend", "Range-Bound"] and vol in ["Elevated", "Normal"] else 52
    })

    # 4. Chapter 1: Covered-Write / Buy-Write (Saliba Ch 1)
    cw_call_k = closest_strike(max_ce_oi_strike)
    cw_prem = get_quote(cw_call_k, "CE")
    cw_max_prof = (cw_call_k - spot) + cw_prem
    cw_be = spot - cw_prem

    selling_candidates.append({
        "name": "Covered Call (Buy-Write)",
        "type": "selling",
        "saliba_framework": "Chapter 1: The Covered-Write & Buy-Write",
        "description": f"Long underlying spot @ Rs.{spot:.2f}, Sell OTM Call at Resistance Wall ({cw_call_k}) @ Rs.{cw_prem:.2f}. Yields income and lowers breakeven.",
        "strikes": f"Buy 1x {spot:.0f} Spot @ Rs.{spot:.2f} | Sell 1x {cw_call_k} Call @ Rs.{cw_prem:.2f}",
        "max_loss": f"Rs.{cw_be:.2f} per share (Underlying downside minus premium buffer)",
        "max_profit": f"Rs.{cw_max_prof:.2f} per share (Return to Called)",
        "breakeven": f"Rs.{cw_be:.2f} (Downside cushion of Rs.{cw_prem:.2f})",
        "risk_reward": "Cash Flow Income / Reduced Basis",
        "risk_type": "UNDEFINED RISK (EQUITY HOLDING)",
        "fit_reason": "Monetizes underlying holding in range-bound or mildly bullish conditions with immediate yield.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Covered Call", {"strike": cw_call_k}),
        "score": 89 if trend in ["Weak Trend", "Range-Bound"] and bias != "Strong Bearish" else 50
    })

    # 4b. Chapter 3: Reverse-Collar Hedge (Synthetic Bear Spread / Short Stock Protection)
    rev_hedge_call_k = closest_strike(atm_strike + strike_step)
    rev_hedge_put_k = closest_strike(atm_strike - 2 * strike_step)
    p_rh_call = get_quote(rev_hedge_call_k, "CE")
    p_rh_put = get_quote(rev_hedge_put_k, "PE")
    net_rh_option_drag = p_rh_call - p_rh_put

    selling_candidates.append({
        "name": "Reverse-Collar Hedge",
        "type": "selling",
        "saliba_framework": "Chapter 3: Collars & Reverse-Collars",
        "description": f"Short Position Protection: Short Spot, Long Protective Call ({rev_hedge_call_k}), funded by Short OTM Put ({rev_hedge_put_k}). Net Option Cost: Rs.{net_rh_option_drag:.2f}. Synthesizes a protected Bear Put Vertical.",
        "strikes": f"Sell 1x {spot:.0f} Spot @ Rs.{spot:.2f} | Buy 1x {rev_hedge_call_k} Call @ Rs.{p_rh_call:.2f} | Sell 1x {rev_hedge_put_k} Put @ Rs.{p_rh_put:.2f}",
        "max_loss": f"Rs.{abs(rev_hedge_call_k - spot + net_rh_option_drag):.2f} per share (Capped at {rev_hedge_call_k})",
        "max_profit": f"Rs.{(spot - rev_hedge_put_k - net_rh_option_drag):.2f} per share (Floor at {rev_hedge_put_k})",
        "breakeven": f"Rs.{(spot - net_rh_option_drag):.2f}",
        "risk_reward": "Capped Upside Loss / Synthetic Bear Put Spread",
        "risk_type": "DEFINED RISK",
        "fit_reason": "Protects short stock positions against upside short squeezes while funding insurance via high-IV put premium.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Reverse-Collar", {"call": rev_hedge_call_k, "put": rev_hedge_put_k}),
        "score": 88 if bias in ["Bearish", "Moderate Bearish"] else 46
    })

    # 5. Chapter 4: Max-Pain Straddle (Saliba Ch 4)
    ce_s_prem_st = get_quote(max_pain, "CE")
    pe_s_prem_st = get_quote(max_pain, "PE")
    net_credit_st = ce_s_prem_st + pe_s_prem_st
    
    selling_candidates.append({
        "name": "Max-Pain Straddle",
        "type": "selling",
        "saliba_framework": "Chapter 4: Straddles & Strangles",
        "description": f"Write Call & Put precisely at the Max Pain strike ({max_pain}) where options decay fastest. Net Credit: Rs.{net_credit_st:.2f}.",
        "strikes": f"Sell 1x {max_pain} CE @ Rs.{ce_s_prem_st:.2f} | Sell 1x {max_pain} PE @ Rs.{pe_s_prem_st:.2f}",
        "max_loss": "Undefined beyond breakevens (Delta hedge or enforce dual stop-loss)",
        "max_profit": f"Rs.{net_credit_st:.2f} per share (at {max_pain})",
        "breakeven": f"Lower: Rs.{(max_pain - net_credit_st):.2f} | Upper: Rs.{(max_pain + net_credit_st):.2f}",
        "risk_reward": "Peak Theta / High Risk",
        "risk_type": "UNDEFINED RISK",
        "fit_reason": f"Maximum option decay expected precisely at Max Pain ({max_pain}) in low volatility.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Straddle", {"strike": max_pain}),
        "score": 85 if trend == "Range-Bound" and vol in ["Low", "Normal"] else 40
    })

    # 6. Chapter 5: Iron Butterfly (Saliba Ch 5)
    ib_mid = closest_strike(max_pain)
    ib_pe_wing = closest_strike(ib_mid - 2 * strike_step)
    ib_ce_wing = closest_strike(ib_mid + 2 * strike_step)
    
    ib_mid_ce = get_quote(ib_mid, "CE")
    ib_mid_pe = get_quote(ib_mid, "PE")
    ib_wing_pe = get_quote(ib_pe_wing, "PE")
    ib_wing_ce = get_quote(ib_ce_wing, "CE")
    
    ib_credit = (ib_mid_ce + ib_mid_pe) - (ib_wing_pe + ib_wing_ce)
    ib_max_loss = (2 * strike_step) - ib_credit
    
    selling_candidates.append({
        "name": "Iron Butterfly",
        "type": "selling",
        "saliba_framework": "Chapter 5: Butterflies & Condors",
        "description": f"Defined-risk short straddle with wings at {ib_pe_wing} & {ib_ce_wing}. Net Credit: Rs.{ib_credit:.2f}.",
        "strikes": f"Buy 1x {ib_pe_wing} PE @ Rs.{ib_wing_pe:.2f} | Sell 1x {ib_mid} PE @ Rs.{ib_mid_pe:.2f} | Sell 1x {ib_mid} CE @ Rs.{ib_mid_ce:.2f} | Buy 1x {ib_ce_wing} CE @ Rs.{ib_wing_ce:.2f}",
        "max_loss": f"Rs.{ib_max_loss:.2f} per share",
        "max_profit": f"Rs.{ib_credit:.2f} per share (at {ib_mid})",
        "breakeven": f"Lower: Rs.{(ib_mid - ib_credit):.2f} | Upper: Rs.{(ib_mid + ib_credit):.2f}",
        "risk_reward": f"1:{ib_credit/max(0.1, ib_max_loss):.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Captures heavy straddle decay at {ib_mid} with complete tail protection against gap openings.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Butterfly", {"body": ib_mid}),
        "score": 91 if trend == "Range-Bound" and vol in ["Normal", "Elevated"] else 51
    })

    # 7. Chapter 4: Short Strangle (Saliba Ch 4)
    short_strangle_pe = closest_strike(max_pe_oi_strike)
    short_strangle_ce = closest_strike(max_ce_oi_strike)
    p_ss_pe = get_quote(short_strangle_pe, "PE")
    p_ss_ce = get_quote(short_strangle_ce, "CE")
    ss_credit = p_ss_pe + p_ss_ce

    selling_candidates.append({
        "name": "Short Strangle",
        "type": "selling",
        "saliba_framework": "Chapter 4: Straddles & Strangles",
        "description": f"Out-of-the-money premium collection selling Put at {short_strangle_pe} Support and Call at {short_strangle_ce} Resistance. Net Credit: Rs.{ss_credit:.2f}.",
        "strikes": f"Sell 1x {short_strangle_pe} PE @ Rs.{p_ss_pe:.2f} | Sell 1x {short_strangle_ce} CE @ Rs.{p_ss_ce:.2f}",
        "max_loss": "Undefined beyond outer breakevens (Enforce strict 2x credit stop)",
        "max_profit": f"Rs.{ss_credit:.2f} per share",
        "breakeven": f"Lower: Rs.{(short_strangle_pe - ss_credit):.2f} | Upper: Rs.{(short_strangle_ce + ss_credit):.2f}",
        "risk_reward": "Wide Profit Zone / Undefined Wings",
        "risk_type": "UNDEFINED RISK",
        "fit_reason": "High probability of complete decay across wide support-resistance channel in calm markets.",
        "adjustment_playbook": get_saliba_adjustment_playbook("Strangle", {"pe": short_strangle_pe, "ce": short_strangle_ce}),
        "score": 87 if trend == "Range-Bound" and vol == "Elevated" else 42
    })

    selling_candidates = sorted(selling_candidates, key=lambda x: x["score"], reverse=True)
    for idx, cand in enumerate(selling_candidates): cand["rank"] = idx + 1

    # Box Arbitrage Evaluation (Saliba Ch 2)
    k_box_low = max_pe_oi_strike
    k_box_high = max_ce_oi_strike
    call_debit = max(1.0, get_quote(k_box_low, "CE") - get_quote(k_box_high, "CE"))
    put_credit = max(1.0, get_quote(k_box_high, "PE") - get_quote(k_box_low, "PE"))
    box_arb = evaluate_box_arbitrage(k_box_low, k_box_high, call_debit, put_credit)

    return {
        "regime": regime,
        "warnings": [],
        "buying_strategies": buying_candidates[:4],
        "selling_strategies": selling_candidates[:4],
        "all_buying_strategies": buying_candidates,
        "all_selling_strategies": selling_candidates,
        "box_arbitrage": box_arb,
        "saliba_insights": {
            "saliba_rules_active": True,
            "book_source": "Option Spread Strategies (Bloomberg Press) - Anthony J. Saliba",
            "active_chapters": [
                "Chapter 01: The Covered-Write & Buy-Write",
                "Chapter 02: Verticals & Box Spread Parity",
                "Chapter 03: Collars and Reverse-Collars",
                "Chapter 04: Straddles and Strangles",
                "Chapter 05: Butterflies and Condors",
                "Chapter 06: Calendar Spreads (Time Spreads)",
                "Chapter 07: Ratio Spreads (Contratrend)",
                "Chapter 08: Backspreads (Volatility Breakouts)"
            ],
            "key_takeaway": f"Market structure ({trend}, {vol} Volatility) guides strategy selection: use defined-risk structures and adhere strictly to dynamic adjustment triggers."
        }
    }
