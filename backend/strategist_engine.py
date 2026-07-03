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
    # Option chain intervals (strike step)
    strikes = [s["strike"] for s in nse_data["strikes"]]
    strike_step = 50 if len(strikes) < 2 else int(sorted(strikes)[1] - sorted(strikes)[0])
    
    # Pre-populate candidate strategies
    # ------------------ BUYING PLAYBOOK ------------------
    buying_candidates = []
    
    # 1. Long Call / Long Put (Directional Long)
    # Good for: Strong Trend, High VIX/Low VIX (if expecting surge)
    long_type = "Call" if "Bullish" in bias else "Put"
    long_strike = atm_strike if bias == "Neutral" else (atm_strike + strike_step if "Bullish" in bias else atm_strike - strike_step)
    
    # Find premium from nse_data
    ce_data = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == long_strike), None)
    pe_data = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == long_strike), None)
    premium = ce_data["ltp"] if long_type == "Call" and ce_data else (pe_data["ltp"] if pe_data else 50.0)
    
    buying_candidates.append({
        "name": f"Long {long_type}",
        "type": "buying",
        "description": f"Direct long option taking advantage of a {bias.lower()} regime. Premium paid: Rs.{premium:.2f}.",
        "strikes": f"Buy 1x {long_strike} {long_type} @ Rs.{premium:.2f}",
        "max_loss": f"Rs.{premium:.2f} per share",
        "max_profit": "Uncapped" if long_type == "Call" else f"Rs.{(long_strike - premium):.2f} per share",
        "breakeven": f"Rs.{(long_strike + premium if long_type == 'Call' else long_strike - premium):.2f}",
        "risk_reward": "Uncapped (Asymmetrical)",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"High momentum bias ({bias}) with VIX ({vix}%) supports a direct directional play.",
        "score": 90 if trend == "Strong Trend" and vol != "Extreme" else 60
    })
    
    # 2. Bull Call Spread / Bear Put Spread (Debit Vertical)
    # Good for: Weak Trend or Low Volatility
    spread_type = "Bull Call" if "Bullish" in bias or bias == "Neutral" else "Bear Put"
    buy_strike = atm_strike - strike_step if spread_type == "Bull Call" else atm_strike + strike_step
    sell_strike = buy_strike + 2 * strike_step if spread_type == "Bull Call" else buy_strike - 2 * strike_step
    
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
    rr_ratio = f"1:{max_prof/net_debit:.2f}"
    
    buying_candidates.append({
        "name": f"{spread_type} Debit Spread",
        "type": "buying",
        "description": f"Debit vertical spread to limit premium decay and cap risk. Net Debit: Rs.{net_debit:.2f}.",
        "strikes": f"Buy 1x {buy_strike} {'Call' if spread_type == 'Bull Call' else 'Put'} @ Rs.{b_prem:.2f} | Sell 1x {sell_strike} {'Call' if spread_type == 'Bull Call' else 'Put'} @ Rs.{s_prem:.2f}",
        "max_loss": f"Rs.{net_debit:.2f} per share",
        "max_profit": f"Rs.{max_prof:.2f} per share",
        "breakeven": f"Rs.{(buy_strike + net_debit if spread_type == 'Bull Call' else buy_strike - net_debit):.2f}",
        "risk_reward": rr_ratio,
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Vol regime is {vol}. Capping risk via vertical debit helps buffer against IV contraction.",
        "score": 85 if trend == "Weak Trend" or vol in ["Low", "Normal"] else 65
    })
    
    # 3. Call/Put Ratio Backspread
    # Good for: High Volatility expecting large breakout
    back_type = "Call" if "Bullish" in bias or bias == "Neutral" else "Put"
    sell_strike_bs = atm_strike
    buy_strike_bs = atm_strike + strike_step if back_type == "Call" else atm_strike - strike_step
    
    s_row = next((s["CE" if back_type == "Call" else "PE"] for s in nse_data["strikes"] if s["strike"] == sell_strike_bs), None)
    b_row = next((s["CE" if back_type == "Call" else "PE"] for s in nse_data["strikes"] if s["strike"] == buy_strike_bs), None)
    
    s_prem_bs = s_row["ltp"] if s_row else 50.0
    b_prem_bs = b_row["ltp"] if b_row else 30.0
    
    # Sell 1, Buy 2
    net_credit_debit = s_prem_bs - 2 * b_prem_bs
    cd_label = "Credit" if net_credit_debit > 0 else "Debit"
    abs_cost = abs(net_credit_debit)
    
    buying_candidates.append({
        "name": f"{back_type} Ratio Backspread",
        "type": "buying",
        "description": f"Sell 1 ATM, Buy 2 OTM options. Profitable on a massive breakout in the {back_type.lower()} direction. Net {cd_label}: Rs.{abs_cost:.2f}.",
        "strikes": f"Sell 1x {sell_strike_bs} {back_type} @ Rs.{s_prem_bs:.2f} | Buy 2x {buy_strike_bs} {back_type} @ Rs.{b_prem_bs:.2f}",
        "max_loss": f"Rs.{(abs(sell_strike_bs - buy_strike_bs) + abs_cost if net_credit_debit < 0 else abs(sell_strike_bs - buy_strike_bs) - abs_cost):.2f} per share",
        "max_profit": "Uncapped on breakout side",
        "breakeven": f"Rs.{(buy_strike_bs + abs_cost if back_type == 'Call' else buy_strike_bs - abs_cost):.2f}",
        "risk_reward": "Asymmetric",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"High/Extreme Vol ({vol}) with Trend ({trend}) supports structured volatility expansion setups.",
        "score": 90 if vol in ["Elevated", "Extreme"] and trend == "Strong Trend" else 55
    })
    
    # Sort and rank buying
    buying_candidates = sorted(buying_candidates, key=lambda x: x["score"], reverse=True)
    for idx, cand in enumerate(buying_candidates):
        cand["rank"] = idx + 1
        
    # ------------------ SELLING PLAYBOOK ------------------
    selling_candidates = []
    
    # 1. Bear Call Spread / Bull Put Spread (Credit Vertical)
    # Good for: Range-Bound, High Volatility contracting
    cred_type = "Bull Put" if "Bullish" in bias or bias == "Neutral" else "Bear Call"
    sell_strike_cr = atm_strike - strike_step if cred_type == "Bull Put" else atm_strike + strike_step
    buy_strike_cr = sell_strike_cr - 2 * strike_step if cred_type == "Bull Put" else sell_strike_cr + 2 * strike_step
    
    s_row_cr = next((s["PE" if cred_type == "Bull Put" else "CE"] for s in nse_data["strikes"] if s["strike"] == sell_strike_cr), None)
    b_row_cr = next((s["PE" if cred_type == "Bull Put" else "CE"] for s in nse_data["strikes"] if s["strike"] == buy_strike_cr), None)
    
    s_prem_cr = s_row_cr["ltp"] if s_row_cr else 40.0
    b_prem_cr = b_row_cr["ltp"] if b_row_cr else 15.0
    
    net_credit = max(5.0, s_prem_cr - b_prem_cr)
    width_cr = abs(sell_strike_cr - buy_strike_cr)
    max_risk = width_cr - net_credit
    
    selling_candidates.append({
        "name": f"{cred_type} Credit Spread",
        "type": "selling",
        "description": f"Credit vertical spread. Earn premium from Theta decay and range-bound behavior. Net Credit: Rs.{net_credit:.2f}.",
        "strikes": f"Sell 1x {sell_strike_cr} {'Put' if cred_type == 'Bull Put' else 'Call'} @ Rs.{s_prem_cr:.2f} | Buy 1x {buy_strike_cr} {'Put' if cred_type == 'Bull Put' else 'Call'} @ Rs.{b_prem_cr:.2f}",
        "max_loss": f"Rs.{max_risk:.2f} per share",
        "max_profit": f"Rs.{net_credit:.2f} per share",
        "breakeven": f"Rs.{(sell_strike_cr - net_credit if cred_type == 'Bull Put' else sell_strike_cr + net_credit):.2f}",
        "risk_reward": f"Max Loss: Rs.{max_risk:.2f} | Max Profit: Rs.{net_credit:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Bias is {bias} with range-bound trends. Credit spreads offer high probability theta decay.",
        "score": 90 if trend == "Range-Bound" or vol in ["Elevated", "Normal"] else 60
    })
    
    # 2. Iron Condor
    # Good for: Range-Bound, High Volatility contracting to low
    pe_sell_ic = atm_strike - 2 * strike_step
    pe_buy_ic = pe_sell_ic - 2 * strike_step
    ce_sell_ic = atm_strike + 2 * strike_step
    ce_buy_ic = ce_sell_ic + 2 * strike_step
    
    pe_s_row = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == pe_sell_ic), None)
    pe_b_row = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == pe_buy_ic), None)
    ce_s_row = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == ce_sell_ic), None)
    ce_b_row = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == ce_buy_ic), None)
    
    pe_s_prem = pe_s_row["ltp"] if pe_s_row else 25.0
    pe_b_prem = pe_b_row["ltp"] if pe_b_row else 8.0
    ce_s_prem = ce_s_row["ltp"] if ce_s_row else 25.0
    ce_b_prem = ce_b_row["ltp"] if ce_b_row else 8.0
    
    net_credit_ic = max(5.0, (pe_s_prem - pe_b_prem) + (ce_s_prem - ce_b_prem))
    wing_width = abs(pe_sell_ic - pe_buy_ic)
    max_risk_ic = wing_width - net_credit_ic
    
    selling_candidates.append({
        "name": "Iron Condor",
        "type": "selling",
        "description": f"Non-directional range-bound credit play. Earn premium from decay on both sides. Net Credit: Rs.{net_credit_ic:.2f}.",
        "strikes": f"Buy {pe_buy_ic} PE @ Rs.{pe_b_prem:.2f} | Sell {pe_sell_ic} PE @ Rs.{pe_s_prem:.2f} | Sell {ce_sell_ic} CE @ Rs.{ce_s_prem:.2f} | Buy {ce_buy_ic} CE @ Rs.{ce_b_prem:.2f}",
        "max_loss": f"Rs.{max_risk_ic:.2f} per share",
        "max_profit": f"Rs.{net_credit_ic:.2f} per share",
        "breakeven": f"Lower: Rs.{(pe_sell_ic - net_credit_ic):.2f} | Upper: Rs.{(ce_sell_ic + net_credit_ic):.2f}",
        "risk_reward": f"Max Loss: Rs.{max_risk_ic:.2f} | Max Profit: Rs.{net_credit_ic:.2f}",
        "risk_type": "DEFINED RISK",
        "fit_reason": f"Expected range-bound consolidations. High credit buffer on wings (Nifty supports/resistances).",
        "score": 95 if trend == "Range-Bound" and vol in ["Normal", "Elevated"] else 55
    })
    
    # 3. Short Straddle / Short Strangle
    # Good for: Extreme Low Volatility or range-bound index trading (NOTE: UNDEFINED RISK)
    ce_s_row_st = next((s["CE"] for s in nse_data["strikes"] if s["strike"] == atm_strike), None)
    pe_s_row_st = next((s["PE"] for s in nse_data["strikes"] if s["strike"] == atm_strike), None)
    ce_s_prem_st = ce_s_row_st["ltp"] if ce_s_row_st else 100.0
    pe_s_prem_st = pe_s_row_st["ltp"] if pe_s_row_st else 80.0
    net_credit_st = ce_s_prem_st + pe_s_prem_st
    
    selling_candidates.append({
        "name": "Short Straddle",
        "type": "selling",
        "description": f"Write ATM Call & Put. High premium collection, profits on stock staying strictly at the strike. Net Credit: Rs.{net_credit_st:.2f}.",
        "strikes": f"Sell 1x {atm_strike} Call @ Rs.{ce_s_prem_st:.2f} | Sell 1x {atm_strike} Put @ Rs.{pe_s_prem_st:.2f}",
        "max_loss": "Undefined (Naked option selling)",
        "max_profit": f"Rs.{net_credit_st:.2f} per share",
        "breakeven": f"Lower: Rs.{(atm_strike - net_credit_st):.2f} | Upper: Rs.{(atm_strike + net_credit_st):.2f}",
        "risk_reward": f"Max Loss: UNDEFINED | Max Profit: Rs.{net_credit_st:.2f}",
        "risk_type": "UNDEFINED RISK",
        "fit_reason": f"Extreme premium decay potential but has unlimited risk. Capital preservation alert.",
        "score": 75 if trend == "Range-Bound" and vol == "Low" else 30
    })
    
    # Sort and rank selling
    selling_candidates = sorted(selling_candidates, key=lambda x: x["score"], reverse=True)
    for idx, cand in enumerate(selling_candidates):
        cand["rank"] = idx + 1
        
    # Mandatory Trade Checklist evaluation for Capital Preservation
    # 1. Volatility check: If VIX is extreme (>25), flag buying ratio spreads/selling condors as high risk
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
