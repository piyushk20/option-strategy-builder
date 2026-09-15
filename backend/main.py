from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, Response
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
from services.high_momentum_service import high_momentum_service
from services.elder_impulse_service import elder_impulse_service
from services.straddle_service import straddle_service
from services.oi_crossover_service import oi_crossover_service
from services.vcp_service import vcp_scanner_service
from services.backtest_service import backtest_service
from services.analyzer_service import analyzer_service
from services.ohl_service import ohl_service, ohl_state


app = FastAPI(title="Option Strategy Builder API", version="1.0.0")

# Start straddle polling service on startup
straddle_service.start_polling()

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
    target_t: Optional[float] = Field(default=None, description="Target date time to expiration in years")

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

@app.get("/api/nse/straddle-chart")
def get_straddle_chart(symbol: str = "NIFTY", expiry: Optional[str] = None, strike: Optional[int] = None, timeframe: int = 5):
    try:
        data = straddle_service.get_straddle_chart_data(symbol, expiry, strike, timeframe)
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"])
        return data
    except Exception as e:
        logger.error(f"Error fetching straddle chart for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve straddle chart.")

@app.get("/api/nse/watchlist")
def get_watchlist():
    try:
        data = straddle_service.get_watchlist_summary()
        return data
    except Exception as e:
        logger.error(f"Error fetching watchlist summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve watchlist.")

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
        result = get_portfolio_payoff_and_greeks(legs_dicts, spot_range, req.t, req.r, req.v, req.target_t)
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
            "name": "Classic Equity Collar",
            "proficiency": "Intermediate",
            "direction": "Bullish / Capital Protection",
            "volatility": "High Volatility",
            "legs": ["Long Stock", "Buy OTM Put", "Sell OTM Call"],
            "description": "Own underlying stock and hedge it with an OTM protective put, financed by selling an OTM upside call (Synthesizes a Bull Call Spread).",
            "risk": "Capped (Defined Risk)",
            "reward": "Capped (Defined Reward)"
        },
        {
            "name": "Speculative Bearish Collar",
            "proficiency": "Intermediate",
            "direction": "Bearish Breakdown",
            "volatility": "Normal to High",
            "legs": ["Buy OTM Put", "Sell OTM Call"],
            "description": "Options-only zero-theta breakdown play buying support put funded by selling resistance call without stock ownership.",
            "risk": "Undefined Upside Risk (Stop-loss mandatory at short call)",
            "reward": "Capped Downside Profit"
        },
        {
            "name": "Bullish Reverse-Collar",
            "proficiency": "Intermediate / Advanced",
            "direction": "Bullish Breakout",
            "volatility": "Exploits Equity Skew",
            "legs": ["Buy OTM Call", "Sell OTM Put"],
            "description": "Breakout structure selling rich high-IV OTM put at support to fund an upside breakout call at resistance, often for a net credit.",
            "risk": "Substantial Downside Risk (Below short put)",
            "reward": "Uncapped Upside Profit"
        },
        {
            "name": "Reverse-Collar Hedge",
            "proficiency": "Advanced",
            "direction": "Bearish Short Stock Protection",
            "volatility": "High Volatility",
            "legs": ["Short Stock", "Buy OTM Call", "Sell OTM Put"],
            "description": "Protects short equity positions against upside squeezes using a long call financed by a short put (Synthesizes a Bear Put Spread).",
            "risk": "Capped (Defined Risk)",
            "reward": "Capped (Defined Reward)"
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


@app.get("/api/nse/futures-buildup")
def get_nse_futures_buildup_api():
    try:
        res = fetcher.fetch_live_futures_buildup()
        return res
    except Exception as e:
        logger.error(f"Error fetching Futures Buildup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class HighMomentumRequest(BaseModel):
    direction: str = "long"
    adx_min: float = 20.0
    mcap_floor: float = 20000.0


@app.post("/api/high-momentum/run")
def run_high_momentum_scan_api(req: HighMomentumRequest):
    started = high_momentum_service.start_scan_async(
        direction=req.direction,
        adx_min=req.adx_min,
        mcap_floor=req.mcap_floor
    )
    if not started:
        return {"status": "already_running", "message": "Scan is already in progress."}
    return {"status": "started", "message": "High momentum scan initiated."}


@app.get("/api/high-momentum/status")
def get_high_momentum_status_api():
    return high_momentum_service.get_status()


@app.get("/api/high-momentum/results")
def get_high_momentum_results_api():
    return high_momentum_service.get_results()


class ElderImpulseRequest(BaseModel):
    universe: str = "nifty_200"
    timeframe: str = "1d"
    adx_threshold: float = 25.0
    ema_length: int = 13
    st_factor: float = 3.0
    st_atr_len: int = 10


@app.post("/api/elder-impulse/run")
def run_elder_impulse_scan_api(req: ElderImpulseRequest):
    started = elder_impulse_service.start_scan_async(
        universe=req.universe,
        timeframe=req.timeframe,
        adx_threshold=req.adx_threshold,
        ema_length=req.ema_length,
        st_factor=req.st_factor,
        st_atr_len=req.st_atr_len
    )
    if not started:
        return {"status": "already_running", "message": "Scan is already in progress."}
    return {"status": "started", "message": f"Elder Impulse Pro scan initiated for {req.universe.upper()} ({req.timeframe.upper()})."}


@app.get("/api/elder-impulse/status")
def get_elder_impulse_status_api():
    return elder_impulse_service.get_status()


@app.get("/api/elder-impulse/results")
def get_elder_impulse_results_api():
    return elder_impulse_service.get_results()


# ---------------------------------------------------------------------------
# NSE OI Crossover Scanner Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/oi-crossover/run")
def run_oi_crossover_scan_api():
    started = oi_crossover_service.start_scan_async()
    if not started:
        return {"status": "already_running", "message": "Scan is already in progress."}
    return {"status": "started", "message": "OI crossover scan initiated."}


@app.get("/api/oi-crossover/status")
def get_oi_crossover_status_api():
    return oi_crossover_service.get_status()


@app.get("/api/oi-crossover/results")
def get_oi_crossover_results_api():
    return oi_crossover_service.get_results()


# ---------------------------------------------------------------------------
# Minervini VCP Strategy Scanner Endpoints
# ---------------------------------------------------------------------------

class VCPScanRequest(BaseModel):
    universe: str = "nifty_200"
    tickers: Optional[List[str]] = None
    rs_min_rating: float = 70.0
    min_contractions: int = 2
    contraction_tol: float = 0.90
    pivot_strength: int = 5
    breakout_vol_mult: float = 1.5
    stop_buffer_pct: float = 1.0
    r_multiple_target: float = 3.0
    late_base_warn_at: int = 4
    use_market_filter: bool = True
    enable_code3: bool = False


class VCPBacktestRequest(BaseModel):
    symbol: str
    initial_capital: float = 1000000.0
    pct_per_trade: float = 10.0
    r_target: float = 3.0
    use_market_filter: bool = True


@app.post("/api/vcp/run")
def run_vcp_scan_api(req: VCPScanRequest):
    started = vcp_scanner_service.start_scan_async(
        universe=req.universe,
        tickers=req.tickers,
        rs_min_rating=req.rs_min_rating,
        min_contractions=req.min_contractions,
        contraction_tol=req.contraction_tol,
        pivot_strength=req.pivot_strength,
        breakout_vol_mult=req.breakout_vol_mult,
        stop_buffer_pct=req.stop_buffer_pct,
        r_multiple_target=req.r_multiple_target,
        late_base_warn_at=req.late_base_warn_at,
        use_market_filter=req.use_market_filter,
        enable_code3=req.enable_code3
    )
    if not started:
        return {"status": "already_running", "message": "Scan is already in progress."}
    return {"status": "started", "message": f"Minervini VCP scan initiated for {req.universe.upper()}."}


@app.get("/api/vcp/status")
def get_vcp_status_api():
    return vcp_scanner_service.get_status()


@app.get("/api/vcp/results")
def get_vcp_results_api():
    return vcp_scanner_service.get_results()


@app.get("/api/vcp/chart-data")
def get_vcp_chart_data_api(symbol: str, period: str = "1y"):
    return vcp_scanner_service.get_chart_data(symbol, period)


@app.get("/api/vcp/export")
def export_vcp_data_api(format: str = "json"):
    content = vcp_scanner_service.export_data(format)
    media_type = "text/csv" if format.lower() == "csv" else "application/json"
    headers = {"Content-Disposition": f"attachment; filename=minervini_vcp_scan.{format.lower()}"}
    return Response(content=content, media_type=media_type, headers=headers)


@app.post("/api/vcp/backtest")
def run_vcp_backtest_api(req: VCPBacktestRequest):
    custom_cfg = {
        "initial_capital": req.initial_capital,
        "pct_per_trade": req.pct_per_trade,
        "r_target": req.r_target,
        "use_market_filter": req.use_market_filter
    }
    return vcp_scanner_service.run_single_backtest(req.symbol, custom_cfg)


# ---------------------------------------------------------------------------
# Backtest Lab Endpoints (VectorBT + QuantStats)
# ---------------------------------------------------------------------------

@app.get("/api/backtest/status")
def get_backtest_status_api():
    return backtest_service.get_status()


@app.get("/api/backtest/summary")
def get_backtest_summary_api():
    return backtest_service.get_summary()


@app.post("/api/backtest/run")
def run_backtest_api():
    started = backtest_service.start_backtest_async()
    if not started:
        return {"status": "already_running", "message": "Backtest simulation is already executing."}
    return {"status": "started", "message": "VectorBT backtest suite initiated."}


@app.get("/api/backtest/tearsheet")
def get_backtest_tearsheet_api(report: Optional[str] = None, asset: Optional[str] = None, strategy: Optional[str] = None):
    html = backtest_service.get_tearsheet_html(report_name=report, asset=asset, strategy=strategy)
# ---------------------------------------------------------------------------
# Option Chain Analyzer Endpoints (Sameer Dharaskar Methodology)
# ---------------------------------------------------------------------------

@app.get("/api/analyzer/data")
def get_analyzer_data_api(
    symbol: str = "NIFTY",
    expiry: Optional[str] = None,
    strike: Optional[float] = None,
    mode: Optional[str] = None
):
    return analyzer_service.get_analyzer_data(symbol=symbol, expiry=expiry, strike=strike, mode=mode)


@app.get("/api/analyzer/export-history")
def export_analyzer_history_api(
    symbol: str = "NIFTY",
    expiry: Optional[str] = None,
    strike: Optional[float] = None
):
    content = analyzer_service.export_history_csv(symbol=symbol, expiry=expiry, strike=strike)
    headers = {"Content-Disposition": f"attachment; filename={symbol.upper()}_analyzer_history.csv"}
    return Response(content=content, media_type="text/csv", headers=headers)


@app.get("/api/analyzer/dump-chain")
def dump_analyzer_chain_api(
    symbol: str = "NIFTY",
    expiry: Optional[str] = None
):
    content = analyzer_service.dump_full_chain_csv(symbol=symbol, expiry=expiry)
    headers = {"Content-Disposition": f"attachment; filename={symbol.upper()}_option_chain_dump.csv"}
    return Response(content=content, media_type="text/csv", headers=headers)


# ---------------------------------------------------------------------------
# Open = High / Open = Low (OHL) Scanner Endpoints
# ---------------------------------------------------------------------------

class OHLScanRequest(BaseModel):
    universe: str = Field(default="leaders", description="'indices' | 'leaders' | 'all'")
    tolerance_pct: float = Field(default=0.001, description="Tolerance percentage (e.g. 0.001 = 0.1%)")


@app.get("/api/ohl/results")
def get_ohl_results_api(
    universe: str = "all",
    signal: str = "all",
    option_type: str = "all",
    confluence_only: bool = False,
    search: str = ""
):
    return ohl_service.get_results(
        universe_filter=universe,
        signal_filter=signal,
        option_filter=option_type,
        confluence_only=confluence_only,
        search_query=search
    )


@app.get("/api/ohl/status")
def get_ohl_status_api():
    with ohl_state.lock:
        return {
            "status": ohl_state.status,
            "progress_pct": ohl_state.progress_pct,
            "last_scanned_at": ohl_state.last_scanned_at,
            "total_scanned": ohl_state.total_scanned,
            "open_low_count": ohl_state.open_low_count,
            "open_high_count": ohl_state.open_high_count,
            "confluence_count": ohl_state.confluence_count
        }


@app.post("/api/ohl/scan")
def run_ohl_scan_api(req: OHLScanRequest):
    started = ohl_service.run_scan_async(universe=req.universe, tolerance_pct=req.tolerance_pct)
    if not started:
        return {"status": "already_running", "message": "OHL scan is already running in background."}
    return {"status": "started", "message": f"OHL scan started for universe: {req.universe}"}


@app.get("/api/ohl/candles")
def get_ohl_strike_candles_api(
    symbol: str,
    strike: Optional[float] = None,
    option_type: Optional[str] = None,
    timeframe: str = "15"
):
    return ohl_service.get_strike_candles(
        symbol=symbol,
        strike=strike,
        option_type=option_type,
        timeframe=timeframe
    )



if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)



