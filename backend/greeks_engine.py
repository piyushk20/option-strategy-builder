import math

def norm_pdf(x: float) -> float:
    """Standard normal probability density function (PDF)."""
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)

def norm_cdf(x: float) -> float:
    """Standard normal cumulative distribution function (CDF) using math.erf."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def calculate_option_greeks(
    s: float,        # Stock Price
    k: float,        # Strike Price
    t: float,        # Time to Expiration (in years, e.g. 30/365)
    r: float,        # Risk-free interest rate (annualized decimal, e.g. 0.07)
    v: float,        # Implied Volatility (annualized decimal, e.g. 0.20)
    option_type: str # 'call' or 'put'
) -> dict:
    """
    Calculates option price and Greeks (Delta, Gamma, Theta, Vega, Rho) using the Black-Scholes model.
    Includes defensive boundary conditions to prevent NaN or division-by-zero errors.
    """
    option_type = option_type.lower()
    
    # Boundary / Safety checks
    if s <= 0 or k <= 0:
        return {"price": 0.0, "delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
    
    # Negative interest rates or volatility clamped to positive
    r = max(0.0, r)
    v = max(1e-4, v) # Volatility cannot be absolute zero to avoid division by zero
    
    # If time to expiry is zero or negative (expired option)
    if t <= 0:
        price = max(s - k, 0.0) if option_type == "call" else max(k - s, 0.0)
        # Delta at expiration
        if s > k:
            delta = 1.0 if option_type == "call" else 0.0
        elif s < k:
            delta = 0.0 if option_type == "call" else -1.0
        else:
            delta = 0.5 if option_type == "call" else -0.5
            
        return {
            "price": price,
            "delta": delta,
            "gamma": 0.0,
            "theta": 0.0,
            "vega": 0.0,
            "rho": 0.0
        }

    try:
        sqrt_t = math.sqrt(t)
        d1 = (math.log(s / k) + (r + 0.5 * v * v) * t) / (v * sqrt_t)
        d2 = d1 - v * sqrt_t
        
        pdf_d1 = norm_pdf(d1)
        cdf_d1 = norm_cdf(d1)
        cdf_d2 = norm_cdf(d2)
        
        # Calculate price
        if option_type == "call":
            price = s * cdf_d1 - k * math.exp(-r * t) * cdf_d2
            delta = cdf_d1
            
            # Theta call (daily rate, divided by 365)
            theta = -(s * pdf_d1 * v) / (2 * sqrt_t) - r * k * math.exp(-r * t) * cdf_d2
            
            # Rho call (divided by 100 for 1% rate change)
            rho = k * t * math.exp(-r * t) * cdf_d2 / 100.0
        else: # Put
            price = k * math.exp(-r * t) * norm_cdf(-d2) - s * norm_cdf(-d1)
            delta = cdf_d1 - 1.0
            
            # Theta put (daily rate, divided by 365)
            theta = -(s * pdf_d1 * v) / (2 * sqrt_t) + r * k * math.exp(-r * t) * norm_cdf(-d2)
            
            # Rho put (divided by 100 for 1% rate change)
            rho = -k * t * math.exp(-r * t) * norm_cdf(-d2) / 100.0
            
        # Gamma (same for Call and Put)
        gamma = pdf_d1 / (s * v * sqrt_t)
        
        # Vega (same for Call and Put, divided by 100 for 1% IV change)
        vega = s * sqrt_t * pdf_d1 / 100.0
        
        # Convert theta to daily (divided by 365)
        theta_daily = theta / 365.0
        
        # Guard against minor rounding issues
        price = max(0.0, price)
        
        return {
            "price": round(price, 4),
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta_daily, 4),
            "vega": round(vega, 4),
            "rho": round(rho, 4)
        }
        
    except Exception:
        # Fallback in case of math overflow
        return {"price": 0.0, "delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

def get_portfolio_payoff_and_greeks(
    legs: list,       # List of dicts: {'type': 'call'/'put'/'stock', 'action': 'buy'/'sell', 'strike': float, 'premium': float, 'quantity': int}
    spot_range: list, # List of potential stock prices
    t: float,         # Time to expiration in years
    r: float,         # Risk-free rate
    v: float          # Implied Volatility
) -> dict:
    """
    Computes portfolio payoff at expiration and today's payoff across a range of spot prices,
    as well as cumulative Greeks.
    """
    payoff_curve = []
    
    # Calculate portfolio Greeks at current spot (assumed middle of range or active spot)
    current_spot = spot_range[len(spot_range) // 2] if spot_range else 100.0
    portfolio_greeks = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0, "net_cost": 0.0}
    
    for spot in spot_range:
        exp_pnl = 0.0
        today_pnl = 0.0
        
        for leg in legs:
            ltype = leg.get("type", "").lower()
            laction = leg.get("action", "").lower()
            strike = float(leg.get("strike", 0.0))
            premium = float(leg.get("premium", 0.0))
            qty = int(leg.get("quantity", 1))
            
            mult = 1 if laction == "buy" else -1
            
            if ltype == "stock":
                # Stock Leg
                # Expiration PnL = (Current Spot - Purchase Price) * quantity
                leg_exp_pnl = (spot - premium) * qty * mult
                leg_today_pnl = (spot - premium) * qty * mult
            else:
                # Option Leg
                # Expiration Payoff = max(Spot - Strike, 0) for call, max(Strike - Spot, 0) for put
                if ltype == "call":
                    payoff = max(spot - strike, 0.0)
                else:
                    payoff = max(strike - spot, 0.0)
                
                # Expiration PnL = (Payoff - Premium Paid) * quantity * multiplier
                leg_exp_pnl = (payoff - premium) * qty * mult
                
                # Today PnL = (Option BS Price - Premium Paid) * quantity * multiplier
                greeks = calculate_option_greeks(spot, strike, t, r, v, ltype)
                leg_today_pnl = (greeks["price"] - premium) * qty * mult
                
            exp_pnl += leg_exp_pnl
            today_pnl += leg_today_pnl
            
        payoff_curve.append({
            "spot": round(spot, 2),
            "expiration_pnl": round(exp_pnl, 2),
            "today_pnl": round(today_pnl, 2)
        })
        
    # Calculate aggregate Greeks at the current spot price
    net_cost = 0.0
    for leg in legs:
        ltype = leg.get("type", "").lower()
        laction = leg.get("action", "").lower()
        strike = float(leg.get("strike", 0.0))
        premium = float(leg.get("premium", 0.0))
        qty = int(leg.get("quantity", 1))
        
        mult = 1 if laction == "buy" else -1
        net_cost += premium * qty * mult
        
        if ltype == "stock":
            portfolio_greeks["delta"] += 1.0 * qty * mult
        else:
            g = calculate_option_greeks(current_spot, strike, t, r, v, ltype)
            portfolio_greeks["delta"] += g["delta"] * qty * mult
            portfolio_greeks["gamma"] += g["gamma"] * qty * mult
            portfolio_greeks["theta"] += g["theta"] * qty * mult
            portfolio_greeks["vega"] += g["vega"] * qty * mult
            portfolio_greeks["rho"] += g["rho"] * qty * mult
            
    portfolio_greeks["delta"] = round(portfolio_greeks["delta"], 4)
    portfolio_greeks["gamma"] = round(portfolio_greeks["gamma"], 6)
    portfolio_greeks["theta"] = round(portfolio_greeks["theta"], 4)
    portfolio_greeks["vega"] = round(portfolio_greeks["vega"], 4)
    portfolio_greeks["rho"] = round(portfolio_greeks["rho"], 4)
    portfolio_greeks["net_cost"] = round(net_cost, 2)
    
    return {
        "payoff_curve": payoff_curve,
        "greeks": portfolio_greeks
    }

if __name__ == "__main__":
    # Small test
    print("Testing call greeks:")
    print(calculate_option_greeks(24000, 24000, 7/365, 0.07, 0.15, "call"))
    print("\nTesting portfolio payoff:")
    test_legs = [{"type": "call", "action": "buy", "strike": 24000, "premium": 150, "quantity": 50}]
    results = get_portfolio_payoff_and_greeks(test_legs, list(range(23800, 24200, 50)), 7/365, 0.07, 0.15)
    print("Greeks:", results["greeks"])
    print("Payoff curve first 2 entries:", results["payoff_curve"][:2])
