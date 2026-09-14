"""
Option Chain Analyzer Engine (Sameer Dharaskar Methodology)
===========================================================

Deterministic calculation engine porting the exact analytical formulas and rules
from VarunS2002/Python-NSE-Option-Chain-Analyzer:
- Call Sum & Put Sum (at target strike k, k+1, k+2)
- Difference (Call Sum - Put Sum)
- Call Boundary (at k+2) & Put Boundary (at k)
- Call ITM ratio (at k+4) & Put ITM ratio (at k-2)
- Call Exits & Put Exits detection
- Upper Boundaries (Max Call OI strikes 1 & 2)
- Lower Boundaries (Max Put OI strikes 1 & 2)
- PCR (Put Call Ratio) & Market Sentiment Bias
"""

from typing import Dict, List, Optional, Any, Tuple
import math


def compute_dharaskar_metrics(
    raw_data: List[Dict[str, Any]],
    target_strike: Optional[float],
    underlying_value: float,
    is_index: bool = True
) -> Dict[str, Any]:
    """
    Computes Dharaskar Option Chain metrics from option chain data.
    Supports both raw NSE schema and cleaned option chain schema.
    """
    round_factor = 1000.0 if is_index else 10.0
    units_str = "Thousands (K)" if is_index else "Tens (10s)"

    # Extract and sort strikes
    strikes_map: Dict[float, Dict[str, Any]] = {}
    for item in raw_data:
        sp = float(item.get("strikePrice") or item.get("strike") or 0)
        if sp > 0:
            strikes_map[sp] = {
                "strikePrice": sp,
                "CE": item.get("CE", {}),
                "PE": item.get("PE", {})
            }

    sorted_strikes = sorted(strikes_map.keys())
    if not sorted_strikes:
        return {}

    # Helper getters for OI and Delta OI
    def get_oi(opt_dict: Dict[str, Any]) -> int:
        return int(opt_dict.get("openInterest") or opt_dict.get("oi") or 0)

    def get_doi(opt_dict: Dict[str, Any]) -> int:
        return int(opt_dict.get("changeinOpenInterest") or opt_dict.get("oi_change") or 0)

    # Determine default target strike if not provided or invalid
    if target_strike is None or target_strike not in strikes_map:
        target_strike = min(sorted_strikes, key=lambda s: abs(s - underlying_value))

    # Compute Total OI across whole chain
    call_oi_list = [get_oi(strikes_map[sp]["CE"]) for sp in sorted_strikes]
    put_oi_list = [get_oi(strikes_map[sp]["PE"]) for sp in sorted_strikes]

    total_call_oi = sum(call_oi_list)
    total_put_oi = sum(put_oi_list)
    pcr = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0.0

    # Max Call OI and Strike 1 (Upper Boundary 1 / Resistance 1)
    max_call_oi_raw = max(call_oi_list) if call_oi_list else 0
    call_oi_index = call_oi_list.index(max_call_oi_raw) if max_call_oi_raw > 0 else 0
    max_call_oi_sp = sorted_strikes[call_oi_index]
    max_call_oi = round(max_call_oi_raw / round_factor, 1)

    # Max Put OI and Strike 1 (Lower Boundary 1 / Support 1)
    max_put_oi_raw = max(put_oi_list) if put_oi_list else 0
    put_oi_index = put_oi_list.index(max_put_oi_raw) if max_put_oi_raw > 0 else 0
    max_put_oi_sp = sorted_strikes[put_oi_index]
    max_put_oi = round(max_put_oi_raw / round_factor, 1)

    # Secondary Boundaries (Strike 2)
    if max_call_oi_sp == max_put_oi_sp:
        max_call_oi_2 = max_call_oi
        max_call_oi_sp_2 = max_call_oi_sp
        max_put_oi_2 = max_put_oi
        max_put_oi_sp_2 = max_put_oi_sp
    elif abs(call_oi_index - put_oi_index) == 1:
        low_idx = min(put_oi_index, call_oi_index)
        high_idx = max(put_oi_index, call_oi_index)
        max_call_oi_2 = round(get_oi(strikes_map[sorted_strikes[low_idx]]["CE"]) / round_factor, 1)
        max_call_oi_sp_2 = sorted_strikes[low_idx]
        max_put_oi_2 = round(get_oi(strikes_map[sorted_strikes[high_idx]]["PE"]) / round_factor, 1)
        max_put_oi_sp_2 = sorted_strikes[high_idx]
    else:
        low_idx = min(put_oi_index, call_oi_index)
        high_idx = max(put_oi_index, call_oi_index)

        call_sub = call_oi_list[low_idx:high_idx]
        if call_sub:
            sub_max_call = max(call_sub)
            sub_call_idx = low_idx + call_sub.index(sub_max_call)
            max_call_oi_2 = round(sub_max_call / round_factor, 1)
            max_call_oi_sp_2 = sorted_strikes[sub_call_idx]
        else:
            max_call_oi_2 = max_call_oi
            max_call_oi_sp_2 = max_call_oi_sp

        put_sub = put_oi_list[low_idx + 1:high_idx + 1]
        if put_sub:
            sub_max_put = max(put_sub)
            sub_put_idx = low_idx + 1 + put_sub.index(sub_max_put)
            max_put_oi_2 = round(sub_max_put / round_factor, 1)
            max_put_oi_sp_2 = sorted_strikes[sub_put_idx]
        else:
            max_put_oi_2 = max_put_oi
            max_put_oi_sp_2 = max_put_oi_sp

    # Find index of target strike
    try:
        k = sorted_strikes.index(target_strike)
    except ValueError:
        k = 0

    n_strikes = len(sorted_strikes)

    def get_change_ce(idx: int) -> int:
        if 0 <= idx < n_strikes:
            sp = sorted_strikes[idx]
            return get_doi(strikes_map[sp]["CE"])
        return 0

    def get_change_pe(idx: int) -> int:
        if 0 <= idx < n_strikes:
            sp = sorted_strikes[idx]
            return get_doi(strikes_map[sp]["PE"])
        return 0

    # Dharaskar Strike calculations
    c1 = get_change_ce(k)
    c2 = get_change_ce(k + 1)
    c3 = get_change_ce(k + 2)
    call_sum = round((c1 + c2 + c3) / round_factor, 1)
    if call_sum == -0.0:
        call_sum = 0.0

    call_boundary = round(c3 / round_factor, 1)
    call_boundary_strike = sorted_strikes[min(k + 2, n_strikes - 1)]

    p1 = get_change_pe(k)
    p2 = get_change_pe(k + 1)
    p3 = get_change_pe(k + 2)
    put_sum = round((p1 + p2 + p3) / round_factor, 1)
    if put_sum == -0.0:
        put_sum = 0.0

    put_boundary = round(p1 / round_factor, 1)
    put_boundary_strike = sorted_strikes[k]
    difference = round(call_sum - put_sum, 1)

    # ITM Ratio calculations
    p4 = get_change_pe(k + 4)  # Put change at k+4
    p5 = get_change_ce(k + 4)  # Call change at k+4
    p6 = get_change_ce(k - 2)  # Call change at k-2
    p7 = get_change_pe(k - 2)  # Put change at k-2

    # Call ITM ratio
    call_itm_val = round(p4 / p5, 2) if p5 != 0 else 0.0
    if call_itm_val == -0.0:
        call_itm_val = 0.0

    # Put ITM ratio
    put_itm_val = round(p6 / p7, 2) if p7 != 0 else 0.0
    if put_itm_val == -0.0:
        put_itm_val = 0.0

    # ITM Signals (Yes / No)
    def is_itm_signal(call_change: int, put_change: int) -> bool:
        if call_change <= 0:
            return True
        if put_change > call_change:
            if put_change >= 0:
                if call_change <= 0 or (put_change / call_change > 1.5):
                    return True
            else:
                if (put_change / call_change) < 0.5:
                    return True
        return False

    call_itm_signal = is_itm_signal(call_change=p5, put_change=p4)
    put_itm_signal = is_itm_signal(call_change=p7, put_change=p6)

    # Upper Boundaries (Resistance 1 & 2)
    upper_boundary_1 = sorted_strikes[min(k + 2, n_strikes - 1)]
    upper_boundary_2 = sorted_strikes[min(k + 3, n_strikes - 1)]

    # Lower Boundaries (Support 1 & 2)
    lower_boundary_1 = sorted_strikes[k]
    lower_boundary_2 = sorted_strikes[max(0, k - 1)]

    # Exits
    call_exits = bool(call_boundary <= 0 or call_sum <= 0)
    put_exits = bool(put_boundary <= 0 or put_sum <= 0)

    # Overall Sentiment
    if difference > 0:
        sentiment = "BEARISH"
    elif difference < 0:
        sentiment = "BULLISH"
    else:
        sentiment = "NEUTRAL"

    return {
        "target_strike": target_strike,
        "underlying_value": underlying_value,
        "is_index": is_index,
        "units": units_str,
        "round_factor": round_factor,
        "call_sum": call_sum,
        "put_sum": put_sum,
        "difference": difference,
        "call_boundary": call_boundary,
        "call_boundary_strike": call_boundary_strike,
        "put_boundary": put_boundary,
        "put_boundary_strike": put_boundary_strike,
        "call_itm_val": call_itm_val,
        "put_itm_val": put_itm_val,
        "call_itm": call_itm_val,
        "call_itm_signal": call_itm_signal,
        "put_itm": put_itm_val,
        "put_itm_signal": put_itm_signal,
        "call_exits": call_exits,
        "put_exits": put_exits,
        "upper_boundary_1": upper_boundary_1,
        "upper_boundary_2": upper_boundary_2,
        "lower_boundary_1": lower_boundary_1,
        "lower_boundary_2": lower_boundary_2,
        "pcr": pcr,
        "sentiment": sentiment,
        "bias_direction": sentiment,
        "upper_boundary": {
            "strike_1": max_call_oi_sp,
            "oi_1": max_call_oi,
            "strike_2": max_call_oi_sp_2,
            "oi_2": max_call_oi_2
        },
        "lower_boundary": {
            "strike_1": max_put_oi_sp,
            "oi_1": max_put_oi,
            "strike_2": max_put_oi_sp_2,
            "oi_2": max_put_oi_2
        },
        "all_strikes": sorted_strikes
    }
