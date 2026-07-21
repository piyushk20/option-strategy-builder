import requests
import time
import json
import logging
import math
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import yfinance as yf


logger = logging.getLogger(__name__)

NSE_BASE_URL = "https://www.nseindia.com"
NSE_OPTIONS_CONTRACT_INFO_URL = "https://www.nseindia.com/api/option-chain-contract-info?symbol={}"
NSE_OPTIONS_V3_INDEX_URL = "https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol={}&expiry={}"
NSE_OPTIONS_V3_EQUITY_URL = "https://www.nseindia.com/api/option-chain-v3?type=Equity&symbol={}&expiry={}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive"
}

class NSEFetcher:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.cookies_dict = {}
        self.cookies_initialized = False

    def _init_cookies(self):
        """Initializes cookies by visiting the NSE option chain landing page."""
        try:
            self.session.cookies.clear()
            logger.info("Initializing session cookies from NSE lander page...")
            r = self.session.get("https://www.nseindia.com/option-chain", timeout=8)
            self.cookies_dict = dict(r.cookies)
            self.cookies_initialized = True
            logger.info(f"Cookies initialized successfully: {len(self.cookies_dict)} cookies found.")
        except Exception as e:
            logger.error(f"Failed to initialize NSE cookies: {e}")
            self.cookies_initialized = False

    def fetch_live_option_chain(self, symbol="NIFTY", is_index=True, expiry=None):
        """
        Fetches live option chain from NSE. Falls back to mock data if it fails.
        """
        clean_symbol = symbol.upper()
        if clean_symbol in ["^NSEI", "NIFTY 50", "NIFTY"]:
            clean_symbol = "NIFTY"
            is_index = True
        elif clean_symbol in ["^NSEBANK", "BANKNIFTY"]:
            clean_symbol = "BANKNIFTY"
            is_index = True
        elif clean_symbol.endswith(".NS"):
            clean_symbol = clean_symbol.replace(".NS", "")
            
        referer = f"https://www.nseindia.com/option-chain?symbol={clean_symbol}" if is_index else f"https://www.nseindia.com/get-quotes/derivatives?symbol={clean_symbol}"
        
        api_headers = HEADERS.copy()
        api_headers.update({
            "Accept": "application/json, text/plain, */*",
            "Referer": referer,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "X-Requested-With": "XMLHttpRequest"
        })

        info_url = NSE_OPTIONS_CONTRACT_INFO_URL.format(clean_symbol)
        expiry_dates = []
        
        # Attempt to fetch contract info/expiries
        for attempt in range(2):
            try:
                if not self.cookies_initialized:
                    self._init_cookies()
                
                logger.info(f"Fetching contract expiries for {clean_symbol} (Attempt {attempt+1})...")
                res = self.session.get(info_url, headers=api_headers, cookies=self.cookies_dict, timeout=7)
                if res.status_code == 200:
                    data = res.json()
                    expiry_dates = data.get("expiryDates", [])
                    if expiry_dates:
                        break
                elif res.status_code in [401, 403]:
                    logger.warning(f"Session blocked with code {res.status_code}. Retrying cookie initialization.")
                    self.cookies_initialized = False
            except Exception as e:
                logger.error(f"Error fetching contract info: {e}")
                self.cookies_initialized = False
                time.sleep(0.5)

        if not expiry_dates:
            logger.warning(f"Could not retrieve live expiry dates for {clean_symbol}. Triggering mock fallback.")
            return self.generate_mock_option_chain(clean_symbol, is_index, expiry)

        # Use the front expiry date or the selected expiry
        if expiry and expiry in expiry_dates:
            selected_expiry = expiry
        else:
            selected_expiry = expiry_dates[0]
            
        url_template = NSE_OPTIONS_V3_INDEX_URL if is_index else NSE_OPTIONS_V3_EQUITY_URL
        data_url = url_template.format(clean_symbol, selected_expiry)
        
        try:
            logger.info(f"Fetching option chain data for expiry {selected_expiry} from {data_url}...")
            res_data = self.session.get(data_url, headers=api_headers, cookies=self.cookies_dict, timeout=7)
            if res_data.status_code == 200:
                payload = res_data.json()
                records = payload.get("records", {})
                raw_data = records.get("data", [])
                underlying_price = float(records.get("underlyingValue", 0.0))
                
                if raw_data and underlying_price > 0:
                    return self.process_option_chain_with_pandas(raw_data, selected_expiry, underlying_price, expiry_dates, clean_symbol)
            
            logger.warning("Failed to fetch option chain content. Triggering mock fallback.")
            return self.generate_mock_option_chain(clean_symbol, is_index, expiry)
        except Exception as e:
            logger.error(f"Error fetching option chain: {e}. Triggering mock fallback.")
            return self.generate_mock_option_chain(clean_symbol, is_index, expiry)

    def process_option_chain_with_pandas(self, raw_data, selected_expiry, underlying_price, all_expiries, symbol):
        """
        Uses Pandas to clean raw option chain data, calculate Max Pain, PCR, and aggregate metrics.
        """
        df = pd.DataFrame(raw_data)
        
        # Expand CE and PE structures
        df_ce = pd.json_normalize(df['CE'].dropna())
        df_pe = pd.json_normalize(df['PE'].dropna())
        
        # Normalize and clean raw data inputs to prevent NaNs/Nulls from triggering calculation type errors
        for col in ['strikePrice', 'openInterest', 'lastPrice', 'impliedVolatility', 'changeinOpenInterest', 'buyPrice1', 'sellPrice1']:
            if not df_ce.empty and col in df_ce.columns:
                df_ce[col] = pd.to_numeric(df_ce[col], errors='coerce').fillna(0)
            if not df_pe.empty and col in df_pe.columns:
                df_pe[col] = pd.to_numeric(df_pe[col], errors='coerce').fillna(0)
                
        # Filter for the selected expiry (handling format differences e.g. 07-Jul-2026 vs 07-07-2026)
        try:
            selected_expiry_dt = pd.to_datetime(selected_expiry, format='%d-%b-%Y')
            
            if not df_ce.empty:
                df_ce['expiryDate'] = pd.to_datetime(df_ce['expiryDate'], format='%d-%m-%Y')
                df_ce = df_ce[df_ce['expiryDate'] == selected_expiry_dt]
            if not df_pe.empty:
                df_pe['expiryDate'] = pd.to_datetime(df_pe['expiryDate'], format='%d-%m-%Y')
                df_pe = df_pe[df_pe['expiryDate'] == selected_expiry_dt]
        except Exception as ex:
            logger.error(f"Error parsing date formats with pandas: {ex}")
            # Fallback to string matching if parsing fails
            if not df_ce.empty:
                df_ce = df_ce[df_ce['expiryDate'] == selected_expiry]
            if not df_pe.empty:
                df_pe = df_pe[df_pe['expiryDate'] == selected_expiry]

        # Calculate Open Interest Walls
        max_call_oi = 0
        max_call_strike = None
        if not df_ce.empty and 'openInterest' in df_ce.columns and 'strikePrice' in df_ce.columns:
            max_call_row = df_ce.loc[df_ce['openInterest'].idxmax()]
            max_call_oi = int(max_call_row['openInterest'])
            max_call_strike = float(max_call_row['strikePrice'])
            
        max_put_oi = 0
        max_put_strike = None
        if not df_pe.empty and 'openInterest' in df_pe.columns and 'strikePrice' in df_pe.columns:
            max_put_row = df_pe.loc[df_pe['openInterest'].idxmax()]
            max_put_oi = int(max_put_row['openInterest'])
            max_put_strike = float(max_put_row['strikePrice'])
            
        # Put Call Ratio (PCR)
        total_call_oi = df_ce['openInterest'].sum() if (not df_ce.empty and 'openInterest' in df_ce.columns) else 0
        total_put_oi = df_pe['openInterest'].sum() if (not df_pe.empty and 'openInterest' in df_pe.columns) else 0
        pcr = round(total_put_oi / total_call_oi, 4) if total_call_oi > 0 else 0.0
        
        # ATM Strike Selection (cleanly parse strikes as numeric)
        all_strikes = pd.to_numeric(df['strikePrice'], errors='coerce').dropna().unique().tolist()
        if not all_strikes:
            all_strikes = [underlying_price]
            
        atm_strike = min(all_strikes, key=lambda x: abs(x - underlying_price))
        
        # Helper to retrieve cell values defensively
        def safe_val(row, col, default_val):
            if row.empty or col not in row.columns:
                return default_val
            vals = row[col].values
            if len(vals) == 0 or pd.isna(vals[0]):
                return default_val
            try:
                if isinstance(default_val, int):
                    return int(vals[0])
                return float(vals[0])
            except:
                return default_val

        # Calculate ATM Straddle price
        atm_straddle = 0.0
        ce_atm = df_ce[df_ce['strikePrice'] == atm_strike] if 'strikePrice' in df_ce.columns else pd.DataFrame()
        pe_atm = df_pe[df_pe['strikePrice'] == atm_strike] if 'strikePrice' in df_pe.columns else pd.DataFrame()
        
        ce_premium = safe_val(ce_atm, 'lastPrice', 0.0)
        pe_premium = safe_val(pe_atm, 'lastPrice', 0.0)
        atm_straddle = round(ce_premium + pe_premium, 2)
        
        # Max Pain Calculation using Pandas
        max_pain_strike = self.calculate_max_pain(df_ce, df_pe, all_strikes)
        
        # Prepare strikes list for frontend option chain display
        strikes_list = []
        for strike in sorted(all_strikes):
            ce_row = df_ce[df_ce['strikePrice'] == strike] if 'strikePrice' in df_ce.columns else pd.DataFrame()
            pe_row = df_pe[df_pe['strikePrice'] == strike] if 'strikePrice' in df_pe.columns else pd.DataFrame()
            
            ce_data = {
                "ltp": safe_val(ce_row, 'lastPrice', 0.0),
                "oi": safe_val(ce_row, 'openInterest', 0),
                "oi_change": safe_val(ce_row, 'changeinOpenInterest', 0),
                "iv": safe_val(ce_row, 'impliedVolatility', 0.0),
                "bid": safe_val(ce_row, 'buyPrice1', 0.0),
                "ask": safe_val(ce_row, 'sellPrice1', 0.0)
            }
            
            pe_data = {
                "ltp": safe_val(pe_row, 'lastPrice', 0.0),
                "oi": safe_val(pe_row, 'openInterest', 0),
                "oi_change": safe_val(pe_row, 'changeinOpenInterest', 0),
                "iv": safe_val(pe_row, 'impliedVolatility', 0.0),
                "bid": safe_val(pe_row, 'buyPrice1', 0.0),
                "ask": safe_val(pe_row, 'sellPrice1', 0.0)
            }
            
            # Filter out extreme wings to keep response size optimal
            if abs(strike - underlying_price) / underlying_price < 0.12:
                strikes_list.append({
                    "strike": strike,
                    "CE": ce_data,
                    "PE": pe_data
                })

        return {
            "symbol": symbol,
            "underlying_price": underlying_price,
            "selected_expiry": selected_expiry,
            "expiry_dates": all_expiries,
            "pcr": pcr,
            "max_pain": max_pain_strike,
            "atm_strike": atm_strike,
            "atm_straddle": atm_straddle,
            "max_call_oi_strike": max_call_strike,
            "max_put_oi_strike": max_put_strike,
            "strikes": strikes_list,
            "is_mock": False,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def calculate_max_pain(self, df_ce, df_pe, strikes):
        """
        Uses mathematical sum-product to find the strike where option buyer pain is minimized.
        """
        if not strikes:
            return None
        
        # Pre-align open interest maps for faster performance (safely handling empty datasets)
        ce_oi_map = {}
        if not df_ce.empty and 'strikePrice' in df_ce.columns and 'openInterest' in df_ce.columns:
            ce_oi_map = df_ce.set_index('strikePrice')['openInterest'].to_dict()
            
        pe_oi_map = {}
        if not df_pe.empty and 'strikePrice' in df_pe.columns and 'openInterest' in df_pe.columns:
            pe_oi_map = df_pe.set_index('strikePrice')['openInterest'].to_dict()
        
        min_pain = float('inf')
        max_pain_strike = strikes[0]
        
        for spot in strikes:
            pain = 0.0
            # Call option buyers pain if underlying expires at spot
            for strike, oi in ce_oi_map.items():
                if oi > 0 and spot > strike:
                    pain += (spot - strike) * oi
            # Put option buyers pain if underlying expires at spot
            for strike, oi in pe_oi_map.items():
                if oi > 0 and strike > spot:
                    pain += (strike - spot) * oi
                    
            if pain < min_pain:
                min_pain = pain
                max_pain_strike = spot
                
        return max_pain_strike

    def _fetch_bse_spot_price(self, symbol):
        """
        Fetches live spot price of BSE symbols from Yahoo Finance.
        Returns None if it fails.
        """
        ticker_map = {
            "SENSEX": "^BSESN",
            "BANKEX": "BSE-BANK.BO"
        }
        yf_ticker = ticker_map.get(symbol.upper())
        if not yf_ticker:
            return None
        
        try:
            logger.info(f"Fetching live BSE spot price for {symbol} ({yf_ticker}) from yfinance...")
            ticker = yf.Ticker(yf_ticker)
            history = ticker.history(period="1d")
            if not history.empty:
                spot = float(history["Close"].iloc[-1])
                logger.info(f"Successfully fetched BSE spot price for {symbol}: {spot}")
                return spot
        except Exception as e:
            logger.error(f"Failed to fetch live BSE spot price for {symbol}: {e}")
        return None

    def generate_mock_option_chain(self, symbol="NIFTY", is_index=True, expiry=None):
        """
        Generates clean, realistic option chain mock data when live scraping is blocked or offline.
        """
        symbol = symbol.upper()
        
        # Exact reference configurations for all 23 F&O stocks and indices
        symbol_configs = {
            "NIFTY": {"spot": 24300.0, "step": 50},
            "BANKNIFTY": {"spot": 52500.0, "step": 100},
            "SENSEX": {"spot": 80000.0, "step": 100},
            "BANKEX": {"spot": 58000.0, "step": 100},
            "FINNIFTY": {"spot": 22200.0, "step": 50},
            "MIDCPNIFTY": {"spot": 12100.0, "step": 50},
            "RELIANCE": {"spot": 3100.0, "step": 20},
            "TCS": {"spot": 3950.0, "step": 50},
            "INFY": {"spot": 1580.0, "step": 20},
            "HDFCBANK": {"spot": 1720.0, "step": 10},
            "ICICIBANK": {"spot": 1220.0, "step": 10},
            "SBIN": {"spot": 840.0, "step": 10},
            "ITC": {"spot": 430.0, "step": 5},
            "BHARTIARTL": {"spot": 1420.0, "step": 10},
            "LT": {"spot": 3600.0, "step": 50},
            "AXISBANK": {"spot": 1260.0, "step": 10},
            "KOTAKBANK": {"spot": 1780.0, "step": 20},
            "TATAMOTORS": {"spot": 980.0, "step": 10},
            "TATASTEEL": {"spot": 175.0, "step": 2.5},
            "BAJFINANCE": {"spot": 7200.0, "step": 100},
            "MARUTI": {"spot": 12100.0, "step": 100},
            "SUNPHARMA": {"spot": 1560.0, "step": 20},
            "HCLTECH": {"spot": 1440.0, "step": 20},
            "M&M": {"spot": 2800.0, "step": 50},
            "WIPRO": {"spot": 480.0, "step": 10}
        }
        
        cfg = symbol_configs.get(symbol, {"spot": 1500.0, "step": 20})
        spot = cfg["spot"]
        strike_step = cfg["step"]
        
        # Dynamic live price fetching for BSE indices
        if symbol in ["SENSEX", "BANKEX"]:
            live_spot = self._fetch_bse_spot_price(symbol)
            if live_spot is not None:
                spot = live_spot
            
        expiry_dates = []
        today = datetime.now()
        
        # Weekly expiry days: Monday (0) for BANKEX, Friday (4) for SENSEX, Thursday (3) for others
        target_weekday = 3
        if symbol == "SENSEX":
            target_weekday = 4
        elif symbol == "BANKEX":
            target_weekday = 0
            
        days_ahead = 0
        while len(expiry_dates) < 4:
            expiry_day = today + timedelta(days=days_ahead)
            if expiry_day.weekday() == target_weekday:
                expiry_dates.append(expiry_day.strftime("%d-%b-%Y"))
            days_ahead += 1
            
        selected_expiry = expiry if expiry in expiry_dates else expiry_dates[0]

        
        # Center option chain around spot
        atm_strike = int(round(spot / strike_step) * strike_step)
        strikes_range = [atm_strike + i * strike_step for i in range(-15, 16)]
        
        # Implied Volatility parameters
        base_iv = 0.15 if symbol == "NIFTY" else 0.18 if symbol == "BANKNIFTY" else 0.22
        
        strikes_list = []
        for strike in strikes_range:
            # Distance from ATM
            dist = (strike - spot) / spot
            
            # Simple option pricing model mock (Black-Scholes-like decay)
            # Call prices decay as strike increases, Puts decay as strike decreases
            call_val = max(0.5, spot * 0.03 * (1.0 - dist * 8) + np.random.uniform(-2, 2)) if strike < spot * 1.05 else max(0.5, spot * 0.005 * math.exp(-dist * 15))
            put_val = max(0.5, spot * 0.03 * (1.0 + dist * 8) + np.random.uniform(-2, 2)) if strike > spot * 0.95 else max(0.5, spot * 0.005 * math.exp(dist * 15))
            
            # Distribute open interest as a bell curve around strike walls
            # Nifty Call resistance at +2% strike, Put support at -2% strike
            call_oi = int(1000000 * math.exp(-((strike - (atm_strike + 3 * strike_step)) / (5 * strike_step))**2))
            put_oi = int(1000000 * math.exp(-((strike - (atm_strike - 3 * strike_step)) / (5 * strike_step))**2))
            
            # Add random variation
            call_oi = max(1000, call_oi + int(np.random.randint(-5000, 5000)))
            put_oi = max(1000, put_oi + int(np.random.randint(-5000, 5000)))
            
            strikes_list.append({
                "strike": strike,
                "CE": {
                    "ltp": round(call_val, 2),
                    "oi": call_oi,
                    "oi_change": int(call_oi * 0.05),
                    "iv": round(base_iv + dist * 0.1, 4),
                    "bid": round(call_val * 0.98, 2),
                    "ask": round(call_val * 1.02, 2)
                },
                "PE": {
                    "ltp": round(put_val, 2),
                    "oi": put_oi,
                    "oi_change": int(put_oi * 0.08),
                    "iv": round(base_iv - dist * 0.1, 4),
                    "bid": round(put_val * 0.98, 2),
                    "ask": round(put_val * 1.02, 2)
                }
            })
            
        # Compile aggregate stats from mock
        total_call_oi = sum(s["CE"]["oi"] for s in strikes_list)
        total_put_oi = sum(s["PE"]["oi"] for s in strikes_list)
        pcr = round(total_put_oi / total_call_oi, 4)
        
        # Max Pain Calculation
        df_ce = pd.DataFrame([{"strikePrice": s["strike"], "openInterest": s["CE"]["oi"]} for s in strikes_list])
        df_pe = pd.DataFrame([{"strikePrice": s["strike"], "openInterest": s["PE"]["oi"]} for s in strikes_list])
        all_strikes = [s["strike"] for s in strikes_list]
        max_pain = self.calculate_max_pain(df_ce, df_pe, all_strikes)
        
        # Strike Walls
        max_call_oi_strike = strikes_list[np.argmax([s["CE"]["oi"] for s in strikes_list])]["strike"]
        max_put_oi_strike = strikes_list[np.argmax([s["PE"]["oi"] for s in strikes_list])]["strike"]
        
        atm_ce = next(s["CE"] for s in strikes_list if s["strike"] == atm_strike)
        atm_pe = next(s["PE"] for s in strikes_list if s["strike"] == atm_strike)
        atm_straddle = round(atm_ce["ltp"] + atm_pe["ltp"], 2)

        return {
            "symbol": symbol,
            "underlying_price": spot,
            "selected_expiry": selected_expiry,
            "expiry_dates": expiry_dates,
            "pcr": pcr,
            "max_pain": max_pain,
            "atm_strike": atm_strike,
            "atm_straddle": atm_straddle,
            "max_call_oi_strike": max_call_oi_strike,
            "max_put_oi_strike": max_put_oi_strike,
            "strikes": strikes_list,
            "is_mock": True,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def fetch_live_oi_spurts(self) -> dict:
        """
        Fetches live OI spurts from NSE. Falls back to mock data if it fails.
        """
        url = "https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings"
        headers = self.session.headers.copy()
        headers.update({
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.nseindia.com/market-data/oi-spurts",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "X-Requested-With": "XMLHttpRequest"
        })

        for attempt in range(2):
            try:
                if not self.cookies_initialized:
                    self._init_cookies()
                
                logger.info(f"Fetching live OI spurts from NSE (Attempt {attempt+1})...")
                res = self.session.get(url, headers=headers, cookies=self.cookies_dict, timeout=8)
                if res.status_code == 200:
                    payload = res.json()
                    data_list = payload.get("data", [])
                    if data_list:
                        return {
                            "data": data_list,
                            "is_mock": False,
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                elif res.status_code in [401, 403]:
                    logger.warning(f"Session blocked with code {res.status_code} during OI spurts fetch. Retrying cookie init.")
                    self.cookies_initialized = False
            except Exception as e:
                logger.error(f"Error fetching live OI spurts: {e}")
                self.cookies_initialized = False
                time.sleep(0.5)

        logger.warning("Failed to fetch live OI spurts. Triggering mock fallback.")
        return self.generate_mock_oi_spurts()

    def generate_mock_oi_spurts(self) -> dict:
        """
        Generates realistic mock OI spurts data for fallback.
        """
        mock_symbols = [
            ("RELIANCE", 2450.50), ("HDFCBANK", 1680.20), ("INFY", 1520.40),
            ("TCS", 3850.10), ("ICICIBANK", 1120.60), ("SBIN", 830.40),
            ("BHARTIARTL", 1390.80), ("TATAMOTORS", 975.30), ("ITC", 425.20),
            ("LT", 3550.00), ("AXISBANK", 1130.45), ("DIVISLAB", 7188.50),
            ("PATANJALI", 347.00), ("KOTAKBANK", 1790.20), ("WIPRO", 480.15)
        ]
        
        data_list = []
        for sym, price in mock_symbols:
            # Generate random but realistic open interest numbers
            prev_oi = int(np.random.randint(15000, 150000))
            # percentage change between 5% and 125%
            pct_change = round(float(np.random.uniform(5.0, 125.0)), 2)
            change_oi = int(prev_oi * (pct_change / 100.0))
            latest_oi = prev_oi + change_oi
            volume = int(latest_oi * np.random.uniform(2, 6))
            
            data_list.append({
                "symbol": sym,
                "latestOI": latest_oi,
                "prevOI": prev_oi,
                "changeInOI": change_oi,
                "avgInOI": pct_change, # average in OI represents percent change in NSE payload
                "volume": volume,
                "underlyingValue": price
            })
            
        # Sort by percent change descending
        data_list.sort(key=lambda x: x["avgInOI"], reverse=True)
        
        return {
            "data": data_list,
            "is_mock": True,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def fetch_live_change_in_oi(self) -> dict:
        """
        Fetches live contract-level OI spurts (Change in Open Interest) from NSE.
        Falls back to mock data if it fails.
        """
        url = "https://www.nseindia.com/api/live-analysis-oi-spurts-contracts"
        headers = self.session.headers.copy()
        headers.update({
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.nseindia.com/market-data/change-in-open-interest",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "X-Requested-With": "XMLHttpRequest"
        })

        for attempt in range(2):
            try:
                if not self.cookies_initialized:
                    self._init_cookies()
                
                logger.info(f"Fetching live Change in OI (contracts) from NSE (Attempt {attempt+1})...")
                res = self.session.get(url, headers=headers, cookies=self.cookies_dict, timeout=10)
                if res.status_code == 200:
                    payload = res.json()
                    data_list = payload.get("data", [])
                    if data_list:
                        return self._process_change_in_oi_payload(payload, is_mock=False)
                elif res.status_code in [401, 403]:
                    logger.warning(f"Session blocked with code {res.status_code} during Change in OI fetch. Retrying cookie init.")
                    self.cookies_initialized = False
            except Exception as e:
                logger.error(f"Error fetching live Change in OI: {e}")
                self.cookies_initialized = False
                time.sleep(0.5)

        logger.warning("Failed to fetch live Change in OI. Triggering mock fallback.")
        return self.generate_mock_change_in_oi()

    def _process_change_in_oi_payload(self, payload: dict, is_mock: bool = False) -> dict:
        """Processes the raw contract-level OI spurts response and structures it."""
        raw_data = payload.get("data", [])
        timestamp = payload.get("timestamp", datetime.now().strftime("%d-%b-%Y %H:%M:%S"))
        
        long_buildup_raw = []
        short_covering_raw = []
        short_buildup_raw = []
        long_unwinding_raw = []
        
        for item in raw_data:
            if "Rise-in-OI-Rise" in item:
                long_buildup_raw = item["Rise-in-OI-Rise"]
            elif "Slide-in-OI-Rise" in item:
                short_covering_raw = item["Slide-in-OI-Rise"]
            elif "Rise-in-OI-Slide" in item:
                short_buildup_raw = item["Rise-in-OI-Slide"]
            elif "Slide-in-OI-Slide" in item:
                long_unwinding_raw = item["Slide-in-OI-Slide"]
                
        def transform_records(raw_records):
            transformed = []
            for r in raw_records:
                instrument = r.get("instrument", "")
                is_index = "Index" in instrument or r.get("instrumentType") in ["FUTIDX", "OPTIDX"]
                
                transformed.append({
                    "symbol": r.get("symbol"),
                    "instrument_type": instrument,
                    "expiry_date": r.get("expiryDate"),
                    "strike_price": r.get("strikePrice"),
                    "option_type": r.get("optionType"),
                    "current_oi": r.get("latestOI"),
                    "prev_oi": r.get("prevOI"),
                    "change_in_oi": r.get("changeInOI"),
                    "pct_change_in_oi": r.get("pChangeInOI"),
                    "ltp": r.get("ltp"),
                    "prev_close": r.get("prevClose"),
                    "pct_change_in_ltp": r.get("pChange"),
                    "volume": r.get("volume"),
                    "turnover_value_lakhs": r.get("turnover"),
                    "is_index": is_index
                })
            
            # Sort: stocks first, then sorted by % change in OI descending
            transformed.sort(key=lambda x: (x["is_index"], -abs(x["pct_change_in_oi"] or 0)))
            return transformed

        return {
            "metadata": {
                "timestamp": timestamp,
                "total_long_buildup_records": len(long_buildup_raw),
                "total_short_covering_records": len(short_covering_raw),
                "total_short_buildup_records": len(short_buildup_raw),
                "total_long_unwinding_records": len(long_unwinding_raw),
                "extracted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            },
            "long_buildup": transform_records(long_buildup_raw),
            "short_covering": transform_records(short_covering_raw),
            "short_buildup": transform_records(short_buildup_raw),
            "long_unwinding": transform_records(long_unwinding_raw),
            "is_mock": is_mock,
            "notes": (
                "Data is fetched from NSE India for analytical purposes only. "
                "This is not investment advice or trading recommendations. "
                "Stocks are prioritized over index derivatives and sorted by highest % Change in OI descending."
            )
        }

    def generate_mock_change_in_oi(self) -> dict:
        """Generates realistic mock data for Change in Open Interest across all 4 categories."""
        mock_assets = [
            ("RELIANCE", 2450.0, False), ("HDFCBANK", 1680.0, False), ("INFY", 1520.0, False),
            ("TCS", 3850.0, False), ("ICICIBANK", 1120.0, False), ("SBIN", 830.0, False),
            ("BHARTIARTL", 1390.0, False), ("TATAMOTORS", 975.0, False), ("ITC", 425.0, False),
            ("LT", 3550.0, False), ("AXISBANK", 1130.0, False), ("KOTAKBANK", 1790.0, False),
            ("AUROPHARMA", 1100.0, False), ("AMBUJACEM", 550.0, False), ("JIOFIN", 320.0, False),
            ("NIFTY", 24187.7, True), ("BANKNIFTY", 57835.3, True)
        ]
        
        long_buildup_raw = []
        short_covering_raw = []
        short_buildup_raw = []
        long_unwinding_raw = []
        
        # Current expiry date (upcoming Thursday)
        expiry_curr = (datetime.now() + timedelta(days=(3 - datetime.now().weekday()) % 7)).strftime("%d-%b-%Y")
        
        for sym, spot, is_index in mock_assets:
            for i in range(1, 3):
                strike_step = 100 if is_index else 50
                strike = int(round(spot / strike_step) * strike_step) + (i - 1) * strike_step
                option_type = "Call" if i == 1 else "Put"
                instrument_type = "Index Options" if is_index else "Stock Options"
                instrument_code = "OPTIDX" if is_index else "OPTSTK"
                
                # We distribute simulated data among the 4 categories
                category_choice = np.random.choice(["long_buildup", "short_covering", "short_buildup", "long_unwinding"])
                
                if category_choice == "long_buildup":
                    # Long Buildup: OI rises, price rises
                    pct_oi = round(float(np.random.uniform(5.0, 150.0)), 2)
                    pct_price = round(float(np.random.uniform(2.0, 80.0)), 2)
                    prev_oi = int(np.random.randint(1000, 50000))
                    change_oi = int(prev_oi * (pct_oi / 100.0))
                    latest_oi = prev_oi + change_oi
                    prev_close = round(float(np.random.uniform(10.0, 500.0)), 2)
                    ltp = round(prev_close * (1 + pct_price / 100.0), 2)
                    
                    long_buildup_raw.append({
                        "symbol": sym, "expiryDate": expiry_curr, "instrument": instrument_type,
                        "latestOI": latest_oi, "prevOI": prev_oi, "changeInOI": change_oi, "pChangeInOI": pct_oi,
                        "ltp": ltp, "prevClose": prev_close, "pChange": pct_price, "strikePrice": strike,
                        "optionType": option_type, "volume": int(latest_oi * np.random.uniform(1.5, 4.0)),
                        "turnover": round(latest_oi * ltp * 0.0001, 2), "instrumentType": instrument_code
                    })
                elif category_choice == "short_covering":
                    # Short Covering: OI falls, price rises
                    pct_oi = -round(float(np.random.uniform(5.0, 60.0)), 2)
                    pct_price = round(float(np.random.uniform(5.0, 120.0)), 2)
                    prev_oi = int(np.random.randint(2000, 80000))
                    change_oi = int(prev_oi * (pct_oi / 100.0))
                    latest_oi = prev_oi + change_oi
                    prev_close = round(float(np.random.uniform(5.0, 200.0)), 2)
                    ltp = round(prev_close * (1 + pct_price / 100.0), 2)
                    
                    short_covering_raw.append({
                        "symbol": sym, "expiryDate": expiry_curr, "instrument": instrument_type,
                        "latestOI": latest_oi, "prevOI": prev_oi, "changeInOI": change_oi, "pChangeInOI": pct_oi,
                        "ltp": ltp, "prevClose": prev_close, "pChange": pct_price, "strikePrice": strike,
                        "optionType": option_type, "volume": int(latest_oi * np.random.uniform(2.0, 5.0)),
                        "turnover": round(latest_oi * ltp * 0.0001, 2), "instrumentType": instrument_code
                    })
                elif category_choice == "short_buildup":
                    # Short Buildup: OI rises, price falls
                    pct_oi = round(float(np.random.uniform(5.0, 120.0)), 2)
                    pct_price = -round(float(np.random.uniform(2.0, 50.0)), 2)
                    prev_oi = int(np.random.randint(1500, 60000))
                    change_oi = int(prev_oi * (pct_oi / 100.0))
                    latest_oi = prev_oi + change_oi
                    prev_close = round(float(np.random.uniform(15.0, 400.0)), 2)
                    ltp = round(prev_close * (1 + pct_price / 100.0), 2)
                    
                    short_buildup_raw.append({
                        "symbol": sym, "expiryDate": expiry_curr, "instrument": instrument_type,
                        "latestOI": latest_oi, "prevOI": prev_oi, "changeInOI": change_oi, "pChangeInOI": pct_oi,
                        "ltp": ltp, "prevClose": prev_close, "pChange": pct_price, "strikePrice": strike,
                        "optionType": option_type, "volume": int(latest_oi * np.random.uniform(1.2, 3.5)),
                        "turnover": round(latest_oi * ltp * 0.0001, 2), "instrumentType": instrument_code
                    })
                else:
                    # Long Unwinding: OI falls, price falls
                    pct_oi = -round(float(np.random.uniform(5.0, 55.0)), 2)
                    pct_price = -round(float(np.random.uniform(2.0, 60.0)), 2)
                    prev_oi = int(np.random.randint(1200, 70000))
                    change_oi = int(prev_oi * (pct_oi / 100.0))
                    latest_oi = prev_oi + change_oi
                    prev_close = round(float(np.random.uniform(8.0, 300.0)), 2)
                    ltp = round(prev_close * (1 + pct_price / 100.0), 2)
                    
                    long_unwinding_raw.append({
                        "symbol": sym, "expiryDate": expiry_curr, "instrument": instrument_type,
                        "latestOI": latest_oi, "prevOI": prev_oi, "changeInOI": change_oi, "pChangeInOI": pct_oi,
                        "ltp": ltp, "prevClose": prev_close, "pChange": pct_price, "strikePrice": strike,
                        "optionType": option_type, "volume": int(latest_oi * np.random.uniform(1.8, 4.2)),
                        "turnover": round(latest_oi * ltp * 0.0001, 2), "instrumentType": instrument_code
                    })
                    
        mock_payload = {
            "timestamp": datetime.now().strftime("%d-%b-%Y %H:%M:%S"),
            "data": [
                {"Rise-in-OI-Rise": long_buildup_raw},
                {"Slide-in-OI-Rise": short_covering_raw},
                {"Rise-in-OI-Slide": short_buildup_raw},
                {"Slide-in-OI-Slide": long_unwinding_raw}
            ]
        }
        return self._process_change_in_oi_payload(mock_payload, is_mock=True)




# Module level fetcher instance
fetcher = NSEFetcher()

if __name__ == "__main__":
    print("Testing pandas-driven NSE live options fetcher...")
    logging.basicConfig(level=logging.INFO)
    data = fetcher.fetch_live_option_chain("NIFTY", is_index=True)
    print("Symbol:", data["symbol"])
    print("Underlying Spot Price:", data["underlying_price"])
    print("Expiry Date:", data["selected_expiry"])
    print("PCR:", data["pcr"])
    print("Max Pain strike:", data["max_pain"])
    print("ATM Strike:", data["atm_strike"])
    print("ATM Straddle Premium:", data["atm_straddle"])
    print("Is using mock fallback:", data["is_mock"])
