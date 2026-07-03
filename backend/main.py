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

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)
