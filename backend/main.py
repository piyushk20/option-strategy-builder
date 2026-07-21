from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import logging
from typing import List, Optional

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Import our custom modules
from nse_fetcher import fetcher
from greeks_engine import calculate_option_greeks, get_portfolio_payoff_and_greeks
from strategist_engine import get_recommendations
from services.scanner_service import start_scanner, global_state, StrategyConfig
from services.nday_high_service import start_nday_scanner, nday_state

app = FastAPI(title="Option Strategy Builder API", version="1.0.0")

# Narrow CORS policy for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# AppSec: Custom Middleware to inject secure HTTP headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response

# AppSec: Global Exception handler to prevent internal trace leaks
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Internal server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact the administrator."}
    )

class LegSchema(BaseModel):
    type: str = Field(..., description="Option type: 'call' or 'put' or 'stock'")
    action: str = Field(..., description="Trade action: 'buy' or 'sell'")
    strike: float = Field(..., description="Strike price of the leg (or purchase price for stock)")
    premium: float = Field(..., description="Premium paid/received (or current price of stock)")
    quantity: int = Field(default=1, description="Number of lots/shares")

class PayoffRequestSchema(BaseModel):
    legs: List[LegSchema]
    t: float = Field(default=30/365, description="Time to expiration in years")
    r: float = Field(default=0.07, description="Risk-free interest rate (decimal)")
    v: float = Field(default=0.15, description="Implied volatility (decimal)")
    spot_min: Optional[float] = None
    spot_max: Optional[float] = None
    spot_step: Optional[float] = None

class RecommendationRequestSchema(BaseModel):
    symbol: str = Field(default="NIFTY", description="NSE Stock/Index Symbol")
    expiry: Optional[str] = Field(default=None, description="Selected expiry date")
    vix: Optional[float] = Field(default=None, description="Custom VIX percentage override")
    trend: Optional[str] = Field(default=None, description="Custom Trend override: 'Strong Trend', 'Weak Trend', 'Range-Bound'")

@app.get("/health")
def health():
    return {"status": "healthy", "service": "Option Strategy Builder Backend"}

@app.get("/api/nse/chain")
def get_nse_chain(symbol: str = "NIFTY", expiry: Optional[str] = None):
    clean_symbol = symbol.upper()
    is_index = clean_symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX"]
    
    try:
        data = fetcher.fetch_live_option_chain(clean_symbol, is_index, expiry)
        if not data:
            raise HTTPException(status_code=404, detail=f"Failed to fetch option chain for {clean_symbol}")
        return data
    except Exception as e:
        logger.error(f"Error fetching option chain for {clean_symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve option chain.")

@app.post("/api/nse/recommend")
def recommend_strategies(req: RecommendationRequestSchema):
    clean_symbol = req.symbol.upper()
    is_index = clean_symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX"]
    
    try:
        data = fetcher.fetch_live_option_chain(clean_symbol, is_index, req.expiry)
        if not data:
            raise HTTPException(status_code=404, detail="Option chain not available for recommendation.")
            
        recommendations = get_recommendations(data, custom_vix=req.vix, custom_trend=req.trend)
        return recommendations
    except Exception as e:
        logger.error(f"Error compiling recommendations for {clean_symbol}: {e}")
        raise HTTPException(status_code=500, detail="Error generating recommendations.")

@app.post("/api/payoff")
def get_payoff(req: PayoffRequestSchema):
    if not req.legs:
        return {"payoff_curve": [], "greeks": {}}
        
    # Calculate auto spot range if not provided
    first_strike = req.legs[0].strike
    
    s_min = req.spot_min if req.spot_min is not None else first_strike * 0.90
    s_max = req.spot_max if req.spot_max is not None else first_strike * 1.10
    s_step = req.spot_step if req.spot_step is not None else (s_max - s_min) / 40.0
    
    if s_step <= 0:
        s_step = 5.0
        
    spot_range = []
    curr = s_min
    while curr <= s_max:
        spot_range.append(curr)
        curr += s_step
        
    # Map pydantic legs list to list of dicts for greeks engine
    legs_dicts = [leg.model_dump() for leg in req.legs]
    
    try:
        result = get_portfolio_payoff_and_greeks(legs_dicts, spot_range, req.t, req.r, req.v)
        return result
    except Exception as e:
        logger.error(f"Error calculating portfolio payoff: {e}")
        raise HTTPException(status_code=400, detail="Error during payoff and Greeks calculations.")

@app.get("/api/strategies")
def get_strategies_directory():
    """
    Returns static directory of strategies classified under Guy Cohen's book.
    """
    return [
        {
            "name": "Covered Call",
            "proficiency": "Novice",
            "direction": "Bullish / Neutral Income",
            "volatility": "Low Volatility",
            "legs": ["Long Stock", "Short OTM Call"],
            "description": "Write a call option against stock shares you already own to earn premium income.",
            "risk": "Capped (High if stock goes to zero)",
            "reward": "Capped"
        },
        {
            "name": "Bull Put Spread",
            "proficiency": "Intermediate",
            "direction": "Bullish Credit Spread",
            "volatility": "Low Volatility",
            "legs": ["Sell OTM Put", "Buy Lower OTM Put"],
            "description": "Sell a higher strike put and buy a lower strike put to collect net premium while protecting downside.",
            "risk": "Capped",
            "reward": "Capped"
        },
        {
            "name": "Iron Condor",
            "proficiency": "Intermediate",
            "direction": "Direction Neutral / Range-Bound",
            "volatility": "Low Volatility",
            "legs": ["Buy Lower OTM Put", "Sell OTM Put", "Sell OTM Call", "Buy Higher OTM Call"],
            "description": "Combine a bull put spread and a bear call spread to collect premium in range-bound markets.",
            "risk": "Capped",
            "reward": "Capped"
        },
        {
            "name": "Straddle",
            "proficiency": "Intermediate",
            "direction": "Direction Neutral",
            "volatility": "High Volatility",
            "legs": ["Buy ATM Call", "Buy ATM Put"],
            "description": "Buy a call and put at the same strike and expiry to profit from large price swings in either direction.",
            "risk": "Capped (Premium Paid)",
            "reward": "Uncapped"
        },
        {
            "name": "Collar",
            "proficiency": "Intermediate",
            "direction": "Bullish / Capital Protection",
            "volatility": "High Volatility",
            "legs": ["Long Stock", "Buy OTM Put", "Sell OTM Call"],
            "description": "Own stock and hedge it with a lower strike put, financed by selling an upside call.",
            "risk": "Capped",
            "reward": "Capped"
        }
    ]

class ScanRequestSchema(BaseModel):
    universe: str = Field(default="nifty_fo", description="Universe: 'nifty_fo' or 'nifty_500'")
    rsi_len: int = Field(default=14, description="Wilder RSI length")
    use_vwap_adjusted_rsi: bool = Field(default=True, description="Adjust price based on calendar year VWAP")
    vwap_smoothing: int = Field(default=20, description="VWAP smoothing length")
    vwap_anchor: str = Field(default="year", description="VWAP anchor: 'year', 'month', 'week'")
    ma_len: int = Field(default=50, description="MA filter length")
    vol_ma_len: int = Field(default=20, description="Volume MA length")
    min_vol_multiplier: float = Field(default=1.5, description="Min volume multiplier")
    atr_len: int = Field(default=14, description="ATR length")


class NdayHighScanRequestSchema(BaseModel):
    universe: str = Field(default="nifty_fo", description="Universe: 'nifty_fo' or 'nifty_500'")
    lookbacks: List[int] = Field(
        default=[520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600],
        description="Lookback windows in trading days (~2yr to ~10yr)"
    )

@app.post("/api/scanner/run")
def run_scanner_api(req: ScanRequestSchema):
    try:
        cfg = StrategyConfig(
            rsi_len=req.rsi_len,
            use_vwap_adjusted_rsi=req.use_vwap_adjusted_rsi,
            vwap_smoothing=req.vwap_smoothing,
            vwap_anchor=req.vwap_anchor,
            ma_len=req.ma_len,
            vol_ma_len=req.vol_ma_len,
            min_vol_multiplier=req.min_vol_multiplier,
            atr_len=req.atr_len
        )
        res = start_scanner(req.universe, cfg)
        return res
    except Exception as e:
        logger.error(f"Error starting scanner: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/scanner/status")
def get_scanner_status_api():
    return global_state.get_status()

@app.get("/api/scanner/results")
def get_scanner_results_api():
    return global_state.get_results()


# ---------------------------------------------------------------------------
# N-Day High (Multi-Year Breakout) Scanner Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/breakout/run")
def run_nday_scanner_api(req: NdayHighScanRequestSchema):
    try:
        res = start_nday_scanner(req.universe, req.lookbacks)
        return res
    except Exception as e:
        logger.error(f"Error starting N-Day High scanner: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/breakout/status")
def get_nday_scanner_status_api():
    return nday_state.get_status()


@app.get("/api/breakout/results")
def get_nday_scanner_results_api():
    return nday_state.get_results()


# ---------------------------------------------------------------------------
# NSE OI Spurts Leaderboard Endpoint
# ---------------------------------------------------------------------------

@app.get("/api/nse/oi-spurts")
def get_nse_oi_spurts_api():
    try:
        res = fetcher.fetch_live_oi_spurts()
        return res
    except Exception as e:
        logger.error(f"Error fetching OI spurts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/nse/change-in-oi")
def get_nse_change_in_oi_api():
    try:
        res = fetcher.fetch_live_change_in_oi()
        return res
    except Exception as e:
        logger.error(f"Error fetching Change in OI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)


