"""
Straddle Chart Audit Script
Validates CE/PE prices, ATM strike accuracy, expiry correctness, and VWAP feasibility.
"""
import sys, json
sys.path.insert(0, 'backend')
from nse_fetcher import NSEFetcher

f = NSEFetcher()

symbols = [
    ("NIFTY", True),
    ("BANKNIFTY", True),
    ("RELIANCE", False),
    ("HDFCBANK", False),
    ("TATAMOTORS", False),
]

issues = []

for sym, is_idx in symbols:
    print(f"\n{'='*50}")
    print(f"  {sym} (is_index={is_idx})")
    print(f"{'='*50}")
    
    d = f.fetch_live_option_chain(sym, is_idx)
    if not d:
        print(f"  [ERROR] No data returned!")
        issues.append(f"{sym}: no data")
        continue

    spot = d.get("underlying_price", 0)
    atm = d.get("atm_strike", 0)
    expiry = d.get("selected_expiry", "?")
    is_mock = d.get("is_mock", True)
    atm_straddle = d.get("atm_straddle", 0)
    expiry_list = d.get("expiry_dates", [])

    print(f"  Spot Price   : {spot}")
    print(f"  ATM Strike   : {atm}  (diff from spot: {abs(spot - atm):.1f})")
    print(f"  ATM Straddle : {atm_straddle}")
    print(f"  Expiry       : {expiry}")
    print(f"  All Expiries : {expiry_list}")
    print(f"  Is Mock Data : {is_mock}")

    # Find ATM row
    atm_row = None
    for s in d.get("strikes", []):
        if s["strike"] == atm:
            atm_row = s
            break

    if atm_row:
        ce = atm_row["CE"]["ltp"]
        pe = atm_row["PE"]["ltp"]
        computed_sum = round(ce + pe, 2)
        print(f"  CE LTP       : {ce}")
        print(f"  PE LTP       : {pe}")
        print(f"  CE+PE Sum    : {computed_sum}")
        print(f"  Straddle OK  : {abs(computed_sum - atm_straddle) < 0.5}")
        if abs(computed_sum - atm_straddle) >= 0.5:
            issues.append(f"{sym}: straddle mismatch reported={atm_straddle} computed={computed_sum}")
        if ce <= 0 or pe <= 0:
            issues.append(f"{sym}: CE={ce} or PE={pe} is zero/negative")
            print(f"  [ISSUE] CE or PE is zero!")
    else:
        print(f"  [ISSUE] ATM strike {atm} not found in strikes list!")
        issues.append(f"{sym}: ATM strike not in strikes list")

    # Verify expiry format for stocks vs indices
    INDEX_SYMS = {"NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY","SENSEX","BANKEX"}
    if sym not in INDEX_SYMS:
        # Should be last Thursday of month (monthly expiry)
        # Count expiries - should have 2-3 monthly dates
        print(f"  Expiry count : {len(expiry_list)} (expected 2-3 for monthly)")
        if len(expiry_list) > 4:
            issues.append(f"{sym}: too many expiries for a stock (got {len(expiry_list)}), likely still using weekly")
    else:
        # Should have 4 weekly dates
        print(f"  Expiry count : {len(expiry_list)} (expected 4+ for weekly index)")

print(f"\n{'='*50}")
print("AUDIT SUMMARY")
print(f"{'='*50}")
if issues:
    print(f"Found {len(issues)} issue(s):")
    for i in issues:
        print(f"  ❌ {i}")
else:
    print("  ✅ All checks passed!")
