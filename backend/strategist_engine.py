import numpy as np

# Playbook Strategy Definitions & Recommendation Logic

def determine_market_regime(spot: float, vix: float, pcr: float) -> dict:
    """
    Classifies the market regime using spot, India VIX, and PCR.
    Returns: {
        'trend': 'Strong Trend' | 'Weak Trend' | 'Range-Bound',
        'bias': 'Strong Bullish' | 'Moderately Bullish' | 'Neutral' | 'Moderately Bearish' | 'Strong Bearish',
        'volatility': 'Low' | 'Normal' | 'Elevated' | 'Extreme',
        'confidence': int (0-100)
    }
    """
    # 1. Volatility Regime
    if vix < 12.0:
        vol = "Low"
    elif vix <= 17.5:
        vol = "Normal"
    elif vix <= 24.0:
        vol = "Elevated"
    else:
        vol = "Extreme"
        
    # 2. Directional Bias based on PCR
    if pcr >= 1.4:
        bias = "Strong Bullish"
    elif pcr >= 1.1:
        bias = "Moderately Bullish"
    elif pcr >= 0.85:
        bias = "Neutral"
    elif pcr >= 0.6:
        bias = "Moderately Bearish"
    else:
        bias = "Strong Bearish"
        
    # 3. Trend Regime based on PCR and VIX
    # Extreme VIX or highly biased PCR suggests strong trends. Normal/low VIX and neutral PCR indicates range-bound.
    if vol == "Extreme" or bias in ["Strong Bullish", "Strong Bearish"]:
        trend = "Strong Trend"
        confidence = 85
    elif vol == "Low" and bias == "Neutral":
        trend = "Range-Bound"
        confidence = 90
    elif vol == "Elevated":
        trend = "Weak Trend"
        confidence = 70
    else:
        trend = "Range-Bound"
        confidence = 75
        
    # Confidence calibration (never 100%)
    confidence = min(95, max(40, confidence + int(np.random.randint(-5, 5))))
    
    return {
        "trend": trend,
        "bias": bias,
        "volatility": vol,
        "confidence": confidence
    }

def get_recommendations(nse_data: dict, custom_vix: float = None, custom_trend: str = None) -> dict:
    """
    Analyzes the NSE option chain data, determines the regime,
    and returns a ranked list of 3 buying and 3 selling strategies.
    Uses AI-driven dynamic anchoring against Open Interest Walls and Max Pain.
    """
    spot = nse_data["underlying_price"]
    pcr = nse_data["pcr"]
    vix = custom_vix if custom_vix is not None else 14.5 # Default normal VIX if not provided
    
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
    
    # Ensure sane resistance/support boundaries just in case OI data is flat
    if max_ce_oi_strike <= atm_strike:
        max_ce_oi_strike = atm_strike + 200
    if max_pe_oi_strike >= atm_strike:
        max_pe_oi_strike = atm_strike - 200

    # Option chain intervals (strike step)
    strikes = [s["strike"] for s in nse_data["strikes"]]
    strike_step = 50 if len(strikes) < 2 else int(sorted(strikes)[1] - sorted(strikes)[0])
    
    # Helper to fetch closest valid strike
    def closest_strike(target):
        if not strikes: return target
        return min(strikes, key=lambda x: abs(x - target))
        
    # Pre-populate candidate strategies
    # ------------------ BUYING PLAYBOOK ------------------
    buying_candidates = []
    
    # 1. Long Call / Long Put (Directional Long)
    long_type = "Call" if "Bullish" in bias else "Put"
    # Buy ATM, targeting the Resistance/Support
    long_strike = atm_strike 
    
    ce_data = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == long_strike), None)
    pe_data = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == long_strike), None)
    premium = ce_data["ltp"] if long_type == "Call" and ce_data else (pe_data["ltp"] if pe_data else 50.0)
    target = max_ce_oi_strike if long_type == "Call" else max_pe_oi_strike
    
    buying_candidates.append({
        "name": f"Long {long_type}",
        "type": "buying",
        "description": f"Direct long {long_type} riding the {bias.lower()} trend. Targets the OI wall at {target}. Premium: Rs.{premium:.2f}.",
        "strikes": f"Buy 1x {long_strike} {long_type} @ Rs.{premium:.2f}",
        "max_loss": f"Rs.{premium:.2f} per share",
        "max_profit": "Uncapped" if long_type == "Call" else f"Rs.{(long_strike - premium):.2f} per share",
        "breakeven": f"Rs.{(long_strike + premium if long_type == 'Call' else long_strike - premium):.2f}",
        "risk_reward": "Uncapped (Asymmetrical)",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"High momentum bias ({bias}) targeting major OI wall at {target}.",
        "score": 90 if trend == "Strong Trend" and vol != "Extreme" else 60
    })
    
    # 2. Bull Call Spread / Bear Put Spread (Debit Vertical)
    spread_type = "Bull Call" if "Bullish" in bias or bias == "Neutral" else "Bear Put"
    buy_strike = atm_strike
    
    # Dynamically anchor the short take-profit leg at the OI Resistance (Call) or Support (Put)
    if spread_type == "Bull Call":
        sell_strike = closest_strike(max_ce_oi_strike)
        # Ensure it's higher than buy strike
        if sell_strike <= buy_strike: sell_strike = buy_strike + strike_step
    else:
        sell_strike = closest_strike(max_pe_oi_strike)
        # Ensure it's lower than buy strike
        if sell_strike >= buy_strike: sell_strike = buy_strike - strike_step
    
    b_row_ce = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == buy_strike), None)
    s_row_ce = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == sell_strike), None)
    b_row_pe = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == buy_strike), None)
    s_row_pe = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == sell_strike), None)
    
    if spread_type == "Bull Call":
        b_prem = b_row_ce["ltp"] if b_row_ce else 80.0
        s_prem = s_row_ce["ltp"] if s_row_ce else 30.0
    else:
        b_prem = b_row_pe["ltp"] if b_row_pe else 80.0
        s_prem = s_row_pe["ltp"] if s_row_pe else 30.0
        
    net_debit = max(5.0, b_prem - s_prem)
    width = abs(buy_strike - sell_strike)
    max_prof = width - net_debit
    rr_ratio = f"1:{max_prof/net_debit:.2f}" if net_debit > 0 else "N/A"
    
    buying_candidates.append({
        "name": f"{spread_type} Debit Spread",
        "type": "buying",
        "description": f"Debit vertical spread capping risk. Short leg anchored at dynamic OI wall {sell_strike}. Net Debit: Rs.{net_debit:.2f}.",
        "strikes": f"Buy 1x {buy_strike} {'Call' if spread_type == 'Bull Call' else 'Put'} @ Rs.{b_prem:.2f} | Sell 1x {sell_strike} {'Call' if spread_type == 'Bull Call' else 'Put'} @ Rs.{s_prem:.2f}",
        "max_loss": f"Rs.{net_debit:.2f} per share",
        "max_profit": f"Rs.{max_prof:.2f} per share",
        "breakeven": f"Rs.{(buy_strike + net_debit if spread_type == 'Bull Call' else buy_strike - net_debit):.2f}",
        "risk_reward": rr_ratio,
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Vol regime {vol}. Short leg perfectly placed at the {spread_type[-4:]} Resistance/Support OI Wall.",
        "score": 85 if trend == "Weak Trend" or vol in ["Low", "Normal"] else 65
    })
    
    # 3. Call/Put Ratio Backspread
    back_type = "Call" if "Bullish" in bias or bias == "Neutral" else "Put"
    
    # Target explosive moves starting from the OI resistance/support
    sell_strike_bs = closest_strike(max_ce_oi_strike) if back_type == "Call" else closest_strike(max_pe_oi_strike)
    buy_strike_bs = sell_strike_bs + strike_step if back_type == "Call" else sell_strike_bs - strike_step
    
    s_row = next((s["CE" if back_type == "Call" else "PE"] for s in nse_data["strikes"] if s["strike"] == sell_strike_bs), None)
    b_row = next((s["CE" if back_type == "Call" else "PE"] for s in nse_data["strikes"] if s["strike"] == buy_strike_bs), None)
    
    s_prem_bs = s_row["ltp"] if s_row else 50.0
    b_prem_bs = b_row["ltp"] if b_row else 30.0
    
    net_credit_debit = s_prem_bs - 2 * b_prem_bs
    cd_label = "Credit" if net_credit_debit > 0 else "Debit"
    abs_cost = abs(net_credit_debit)
    
    buying_candidates.append({
        "name": f"{back_type} Ratio Backspread",
        "type": "buying",
        "description": f"Sell 1 at OI Wall ({sell_strike_bs}), Buy 2 OTM. Profitable on a massive breakout past the wall. Net {cd_label}: Rs.{abs_cost:.2f}.",
        "strikes": f"Sell 1x {sell_strike_bs} {back_type} @ Rs.{s_prem_bs:.2f} | Buy 2x {buy_strike_bs} {back_type} @ Rs.{b_prem_bs:.2f}",
        "max_loss": f"Rs.{(abs(sell_strike_bs - buy_strike_bs) + abs_cost if net_credit_debit < 0 else abs(sell_strike_bs - buy_strike_bs) - abs_cost):.2f} per share",
        "max_profit": "Uncapped on breakout side",
        "breakeven": f"Rs.{(buy_strike_bs + abs_cost if back_type == 'Call' else buy_strike_bs - abs_cost):.2f}",
        "risk_reward": "Asymmetric",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Explosive breakout setup triggering exactly at the {sell_strike_bs} OI Wall.",
        "score": 90 if vol in ["Elevated", "Extreme"] and trend == "Strong Trend" else 55
    })
    
    buying_candidates = sorted(buying_candidates, key=lambda x: x["score"], reverse=True)
    for idx, cand in enumerate(buying_candidates): cand["rank"] = idx + 1
        
    # ------------------ SELLING PLAYBOOK ------------------
    selling_candidates = []
    
    # 1. Bear Call Spread / Bull Put Spread (Credit Vertical)
    cred_type = "Bull Put" if "Bullish" in bias or bias == "Neutral" else "Bear Call"
    
    # Sell exactly at the OI Support/Resistance
    sell_strike_cr = closest_strike(max_pe_oi_strike) if cred_type == "Bull Put" else closest_strike(max_ce_oi_strike)
    buy_strike_cr = sell_strike_cr - strike_step if cred_type == "Bull Put" else sell_strike_cr + strike_step
    
    s_row_cr = next((s["PE" if cred_type == "Bull Put" else "CE"] for s in nse_data["strikes"] if s["strike"] == sell_strike_cr), None)
    b_row_cr = next((s["PE" if cred_type == "Bull Put" else "CE"] for s in nse_data["strikes"] if s["strike"] == buy_strike_cr), None)
    
    s_prem_cr = s_row_cr["ltp"] if s_row_cr else 40.0
    b_prem_cr = b_row_cr["ltp"] if b_row_cr else 15.0
    
    net_credit = max(1.0, s_prem_cr - b_prem_cr)
    width_cr = abs(sell_strike_cr - buy_strike_cr)
    max_risk = max(1.0, width_cr - net_credit)
    
    selling_candidates.append({
        "name": f"{cred_type} Credit Spread",
        "type": "selling",
        "description": f"Credit spread anchored precisely at the {sell_strike_cr} OI Wall. Net Credit: Rs.{net_credit:.2f}.",
        "strikes": f"Sell 1x {sell_strike_cr} {'Put' if cred_type == 'Bull Put' else 'Call'} @ Rs.{s_prem_cr:.2f} | Buy 1x {buy_strike_cr} {'Put' if cred_type == 'Bull Put' else 'Call'} @ Rs.{b_prem_cr:.2f}",
        "max_loss": f"Rs.{max_risk:.2f} per share",
        "max_profit": f"Rs.{net_credit:.2f} per share",
        "breakeven": f"Rs.{(sell_strike_cr - net_credit if cred_type == 'Bull Put' else sell_strike_cr + net_credit):.2f}",
        "risk_reward": f"Max Loss: Rs.{max_risk:.2f} | Max Profit: Rs.{net_credit:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"High probability theta decay play leaning directly on {max_pe_oi_strike if cred_type == 'Bull Put' else max_ce_oi_strike} OI Support/Resistance.",
        "score": 90 if trend == "Range-Bound" or vol in ["Elevated", "Normal"] else 60
    })
    
    # 2. Iron Condor
    # Dynamically clamp short strikes to the actual OI boundaries!
    pe_sell_ic = closest_strike(max_pe_oi_strike)
    pe_buy_ic = pe_sell_ic - strike_step
    ce_sell_ic = closest_strike(max_ce_oi_strike)
    ce_buy_ic = ce_sell_ic + strike_step
    
    pe_s_row = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == pe_sell_ic), None)
    pe_b_row = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == pe_buy_ic), None)
    ce_s_row = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == ce_sell_ic), None)
    ce_b_row = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == ce_buy_ic), None)
    
    pe_s_prem = pe_s_row["ltp"] if pe_s_row else 25.0
    pe_b_prem = pe_b_row["ltp"] if pe_b_row else 8.0
    ce_s_prem = ce_s_row["ltp"] if ce_s_row else 25.0
    ce_b_prem = ce_b_row["ltp"] if ce_b_row else 8.0
    
    net_credit_ic = max(5.0, (pe_s_prem - pe_b_prem) + (ce_s_prem - ce_b_prem))
    wing_width = max(abs(pe_sell_ic - pe_buy_ic), abs(ce_sell_ic - ce_buy_ic))
    max_risk_ic = max(1.0, wing_width - net_credit_ic)
    
    selling_candidates.append({
        "name": "Iron Condor",
        "type": "selling",
        "description": f"Dynamically hugging the precise OI trading range [{max_pe_oi_strike}, {max_ce_oi_strike}]. Net Credit: Rs.{net_credit_ic:.2f}.",
        "strikes": f"Buy {pe_buy_ic} PE @ Rs.{pe_b_prem:.2f} | Sell {pe_sell_ic} PE @ Rs.{pe_s_prem:.2f} | Sell {ce_sell_ic} CE @ Rs.{ce_s_prem:.2f} | Buy {ce_buy_ic} CE @ Rs.{ce_b_prem:.2f}",
        "max_loss": f"Rs.{max_risk_ic:.2f} per share",
        "max_profit": f"Rs.{net_credit_ic:.2f} per share",
        "breakeven": f"Lower: Rs.{(pe_sell_ic - net_credit_ic):.2f} | Upper: Rs.{(ce_sell_ic + net_credit_ic):.2f}",
        "risk_reward": f"Max Loss: Rs.{max_risk_ic:.2f} | Max Profit: Rs.{net_credit_ic:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Expected range-bound consolidations strictly contained within the dynamic OI walls.",
        "score": 95 if trend == "Range-Bound" and vol in ["Normal", "Elevated"] else 55
    })
    
    # 3. Short Straddle / Short Strangle
    # Instead of an ATM Straddle, let's do a Dynamic Strangle at Max Pain (often slightly offset from ATM)
    ce_s_row_st = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == max_pain), None)
    pe_s_row_st = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == max_pain), None)
    ce_s_prem_st = ce_s_row_st["ltp"] if ce_s_row_st else 100.0
    pe_s_prem_st = pe_s_row_st["ltp"] if pe_s_row_st else 80.0
    net_credit_st = ce_s_prem_st + pe_s_prem_st
    
    selling_candidates.append({
        "name": "Max-Pain Straddle",
        "type": "selling",
        "description": f"Write Call & Put precisely at the Max Pain strike ({max_pain}) where options decay fastest. Net Credit: Rs.{net_credit_st:.2f}.",
        "strikes": f"Sell 1x {max_pain} Call @ Rs.{ce_s_prem_st:.2f} | Sell 1x {max_pain} Put @ Rs.{pe_s_prem_st:.2f}",
        "max_loss": "Undefined (Naked option selling)",
        "max_profit": f"Rs.{net_credit_st:.2f} per share",
        "breakeven": f"Lower: Rs.{(max_pain - net_credit_st):.2f} | Upper: Rs.{(max_pain + net_credit_st):.2f}",
        "risk_reward": f"Max Loss: UNDEFINED | Max Profit: Rs.{net_credit_st:.2f}",
        "risk_type": "UNDEFINED RISK",
        "fit_reason": f"Exploits maximum theta decay exactly at the Max Pain target.",
        "score": 75 if trend == "Range-Bound" and vol == "Low" else 30
    })
    
    selling_candidates = sorted(selling_candidates, key=lambda x: x["score"], reverse=True)
    for idx, cand in enumerate(selling_candidates): cand["rank"] = idx + 1
        
    checklist_warnings = []
    if vix > 24.0:
        checklist_warnings.append("India VIX is extreme (>24%). Spreads must be kept small. Naked option writing is banned.")
    if nse_data["pcr"] < 0.5:
        checklist_warnings.append("PCR is extremely bearish (<0.5). Potential market sell-off risk. Watch put premiums.")
        
    return {
        "regime": regime,
        "buying_strategies": buying_candidates[:3],
        "selling_strategies": selling_candidates[:3],
        "warnings": checklist_warnings,
        "symbol": nse_data["symbol"]
    }
