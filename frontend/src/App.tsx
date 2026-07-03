import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Search, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Sliders, 
  ArrowRight,
  TrendingDown,
  RefreshCw
} from 'lucide-react';

interface OptionLeg {
  id: string;
  type: 'call' | 'put' | 'stock';
  action: 'buy' | 'sell';
  strike: number;
  premium: number;
  quantity: number;
}

interface StrikeData {
  strike: number;
  CE: { ltp: number; oi: number; oi_change: number; iv: number; bid: number; ask: number };
  PE: { ltp: number; oi: number; oi_change: number; iv: number; bid: number; ask: number };
}

interface OptionChainData {
  symbol: string;
  underlying_price: number;
  selected_expiry: string;
  expiry_dates: string[];
  pcr: number;
  max_pain: number;
  atm_strike: number;
  atm_straddle: number;
  max_call_oi_strike: number;
  max_put_oi_strike: number;
  strikes: StrikeData[];
  is_mock: boolean;
  timestamp: string;
}

interface StrategistRecommendation {
  name: string;
  type: 'buying' | 'selling';
  description: string;
  strikes: string;
  max_loss: string;
  max_profit: string;
  breakeven: string;
  risk_reward: string;
  risk_type: 'DEFINED RISK' | 'UNDEFINED RISK';
  fit_reason: string;
  rank: number;
}

interface RegimeData {
  trend: string;
  bias: string;
  volatility: string;
  confidence: number;
}

interface StrategistResponse {
  regime: RegimeData;
  buying_strategies: StrategistRecommendation[];
  selling_strategies: StrategistRecommendation[];
  warnings: string[];
  symbol: string;
}

interface PayoffPoint {
  spot: number;
  expiration_pnl: number;
  today_pnl: number;
}

interface PortfolioGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  net_cost: number;
}

interface PayoffResponse {
  payoff_curve: PayoffPoint[];
  greeks: PortfolioGreeks;
}

// Official NSE F&O lot sizes (as of July 2025)
const LOT_SIZES: Record<string, number> = {
  '360ONE': 500,
  'ABB': 125,
  'ABCAPITAL': 3100,
  'ADANIENSOL': 675,
  'ADANIENT': 309,
  'ADANIGREEN': 600,
  'ADANIPORTS': 475,
  'ADANIPOWER': 3550,
  'ALKEM': 125,
  'AMBER': 100,
  'AMBUJACEM': 1200,
  'ANGELONE': 2500,
  'APLAPOLLO': 350,
  'APOLLOHOSP': 125,
  'ASHOKLEY': 5000,
  'ASIANPAINT': 250,
  'ASTRAL': 425,
  'AUBANK': 1000,
  'AUROPHARMA': 550,
  'AXISBANK': 625,
  'BAJAJ-AUTO': 75,
  'BAJAJFINSV': 300,
  'BAJAJHLDNG': 75,
  'BAJFINANCE': 750,
  'BANDHANBNK': 3600,
  'BANKBARODA': 2925,
  'BANKINDIA': 5200,
  'BANKNIFTY': 30,
  'BDL': 425,
  'BEL': 1425,
  'BHARATFORG': 500,
  'BHARTIARTL': 475,
  'BHEL': 2625,
  'BIOCON': 2500,
  'BLUESTARCO': 325,
  'BOSCHLTD': 25,
  'BPCL': 1975,
  'BRITANNIA': 125,
  'BSE': 200,
  'CAMS': 825,
  'CANBK': 6750,
  'CDSL': 475,
  'CGPOWER': 850,
  'CHOLAFIN': 625,
  'CIPLA': 425,
  'COALINDIA': 1350,
  'COCHINSHIP': 400,
  'COFORGE': 475,
  'COLPAL': 275,
  'CONCOR': 1250,
  'CROMPTON': 2150,
  'CUMMINSIND': 200,
  'DABUR': 1250,
  'DALBHARAT': 325,
  'DELHIVERY': 2075,
  'DIVISLAB': 100,
  'DIXON': 50,
  'DLF': 950,
  'DMART': 150,
  'DRREDDY': 625,
  'EICHERMOT': 100,
  'ETERNAL': 2425,
  'EXIDEIND': 1800,
  'FEDERALBNK': 2500,
  'FINNIFTY': 60,
  'FORCEMOT': 25,
  'FORTIS': 775,
  'GAIL': 3550,
  'GLENMARK': 375,
  'GMRAIRPORT': 6975,
  'GODFRYPHLP': 275,
  'GODREJCP': 500,
  'GODREJPROP': 325,
  'GRASIM': 250,
  'GVT&D': 125,
  'HAL': 150,
  'HAVELLS': 500,
  'HCLTECH': 400,
  'HDFCAMC': 300,
  'HDFCBANK': 650,
  'HDFCLIFE': 1100,
  'HEROMOTOCO': 150,
  'HINDALCO': 700,
  'HINDPETRO': 2025,
  'HINDUNILVR': 300,
  'HINDZINC': 1225,
  'HYUNDAI': 275,
  'ICICIBANK': 700,
  'ICICIGI': 325,
  'ICICIPRULI': 925,
  'IDEA': 71475,
  'IDFCFIRSTB': 9275,
  'IEX': 4350,
  'INDHOTEL': 1000,
  'INDIANB': 1000,
  'INDIGO': 150,
  'INDUSINDBK': 700,
  'INDUSTOWER': 1700,
  'INFY': 400,
  'INOXWIND': 6400,
  'IOC': 4875,
  'IREDA': 4525,
  'IRFC': 5425,
  'ITC': 1725,
  'JINDALSTEL': 625,
  'JIOFIN': 2350,
  'JSWENERGY': 1075,
  'JSWSTEEL': 675,
  'JUBLFOOD': 1250,
  'KALYANKJIL': 1350,
  'KAYNES': 150,
  'KEI': 175,
  'KFINTECH': 575,
  'KOTAKBANK': 2000,
  'KPITTECH': 775,
  'LAURUSLABS': 850,
  'LICHSGFIN': 1000,
  'LICI': 1400,
  'LODHA': 625,
  'LT': 175,
  'LTF': 2250,
  'LTM': 150,
  'LUPIN': 425,
  'M&M': 200,
  'MANAPPURAM': 3000,
  'MANKIND': 250,
  'MARICO': 1200,
  'MARUTI': 50,
  'MAXHEALTH': 525,
  'MAZDOCK': 225,
  'MCX': 225,
  'MFSL': 400,
  'MIDCPNIFTY': 120,
  'MOTHERSON': 6150,
  'MOTILALOFS': 775,
  'MPHASIS': 275,
  'MUTHOOTFIN': 275,
  'NAM-INDIA': 625,
  'NATIONALUM': 1875,
  'NAUKRI': 550,
  'NBCC': 6500,
  'NESTLEIND': 500,
  'NHPC': 6950,
  'NIFTY': 65,
  'NIFTYNXT50': 25,
  'NMDC': 6750,
  'NTPC': 1500,
  'NUVAMA': 500,
  'NYKAA': 3125,
  'OBEROIRLTY': 350,
  'OFSS': 100,
  'OIL': 1400,
  'ONGC': 2250,
  'PAGEIND': 20,
  'PATANJALI': 1075,
  'PAYTM': 725,
  'PERSISTENT': 125,
  'PETRONET': 1900,
  'PFC': 1300,
  'PGEL': 950,
  'PHOENIXLTD': 350,
  'PIDILITIND': 500,
  'PIIND': 175,
  'PNB': 8000,
  'PNBHOUSING': 650,
  'POLICYBZR': 350,
  'POLYCAB': 125,
  'POWERGRID': 1900,
  'POWERINDIA': 25,
  'PREMIERENE': 650,
  'PRESTIGE': 450,
  'RADICO': 150,
  'RBLBANK': 3175,
  'RECLTD': 1575,
  'RELIANCE': 500,
  'RVNL': 1925,
  'SAIL': 4700,
  'SBICARD': 800,
  'SBILIFE': 375,
  'SBIN': 750,
  'SHREECEM': 25,
  'SHRIRAMFIN': 825,
  'SIEMENS': 175,
  'SOLARINDS': 50,
  'SONACOMS': 1225,
  'SRF': 200,
  'SUNPHARMA': 350,
  'SUPREMEIND': 175,
  'SUZLON': 12700,
  'SWIGGY': 1825,
  'TATACONSUM': 550,
  'TATAELXSI': 125,
  'TATAPOWER': 1450,
  'TATASTEEL': 2750,
  'TCS': 225,
  'TECHM': 600,
  'TIINDIA': 200,
  'TITAN': 175,
  'TMPV': 1600,
  'TORNTPHARM': 125,
  'TRENT': 225,
  'TVSMOTOR': 175,
  'ULTRACEMCO': 50,
  'UNIONBANK': 4425,
  'UNITDSPR': 400,
  'UNOMINDA': 550,
  'UPL': 1355,
  'VBL': 1275,
  'VEDL': 1150,
  'VMM': 4850,
  'VOLTAS': 375,
  'WAAREEENER': 175,
  'WIPRO': 3000,
  'YESBANK': 31100,
  'ZYDUSLIFE': 900
};

const INDEX_NAMES: Record<string, string> = {
  NIFTY: 'NIFTY (Index)',
  BANKNIFTY: 'BANK NIFTY (Index)',
  FINNIFTY: 'FIN NIFTY (Index)',
  MIDCPNIFTY: 'MIDCAP NIFTY (Index)',
  SENSEX: 'SENSEX (Index)',
  BANKEX: 'BANKEX (Index)'
};

const AVAILABLE_SYMBOLS = Object.keys(LOT_SIZES).map(sym => ({
  value: sym,
  label: INDEX_NAMES[sym] || sym,
  isIndex: !!INDEX_NAMES[sym]
})).sort((a, b) => {
  // Put indices first
  if (a.isIndex && !b.isIndex) return -1;
  if (!a.isIndex && b.isIndex) return 1;
  return a.label.localeCompare(b.label);
});



const getLotSize = (sym: string): number => LOT_SIZES[sym] ?? 1;

export default function App() {
  // App settings & state
  const [symbol, setSymbol] = useState<string>('NIFTY');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [chainLoading, setChainLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Scraped NSE Data & Expiries
  const [optionChain, setOptionChain] = useState<OptionChainData | null>(null);
  
  // Custom workbench legs
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  
  // Greeks & payoff curves
  const [payoffCurve, setPayoffCurve] = useState<PayoffPoint[]>([]);
  const [portfolioGreeks, setPortfolioGreeks] = useState<PortfolioGreeks | null>(null);
  
  // Strategist recommends
  const [strategistData, setStrategistData] = useState<StrategistResponse | null>(null);
  
  // Param overrides
  const [vix, setVix] = useState<number>(14.5);
  const [trendOverride, setTrendOverride] = useState<string>('');
  const [interestRate, setInterestRate] = useState<number>(0.07);
  const [volatility, setVolatility] = useState<number>(0.15);
  const [daysToExpiry, setDaysToExpiry] = useState<number>(15);
  
  // SVG Chart hovering tooltip
  const [hoveredPoint, setHoveredPoint] = useState<PayoffPoint | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [hoverY, setHoverY] = useState<number>(0);

  // Fetch Live NSE Option Chain
  const fetchOptionChain = async (sym: string, exp: string = '') => {
    setChainLoading(true);
    setError(null);
    try {
      const url = `/api/nse/chain?symbol=${sym}${exp ? `&expiry=${exp}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}: Failed to pull NSE data`);
      const data: OptionChainData = await res.json();
      setOptionChain(data);
      setSelectedExpiry(data.selected_expiry);
      
      // Update local Greeks IV model default if index vs stock
      if (data.symbol === 'NIFTY' || data.symbol === 'BANKNIFTY') {
        setVolatility(0.14);
      } else {
        setVolatility(0.22);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred connecting to option chain API.');
    } finally {
      setChainLoading(false);
    }
  };

  // Fetch Analyst Recommendations
  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nse/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol,
          expiry: selectedExpiry || null,
          vix: vix,
          trend: trendOverride || null
        })
      });
      if (!res.ok) throw new Error('Failed to generate analyst recommendations.');
      const data: StrategistResponse = await res.json();
      setStrategistData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Payoff and Greeks recalculation
  const recalculatePayoff = async () => {
    if (legs.length === 0) {
      setPayoffCurve([]);
      setPortfolioGreeks(null);
      return;
    }
    
    // Sort strikes to get ranges
    const strikes = legs.map(l => l.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const center = optionChain?.underlying_price || minStrike;
    
    const spotMin = Math.min(minStrike * 0.92, center * 0.92);
    const spotMax = Math.max(maxStrike * 1.08, center * 1.08);
    
    try {
      const res = await fetch('/api/payoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legs: legs.map(l => ({
            type: l.type,
            action: l.action,
            strike: l.strike,
            premium: l.premium,
            quantity: l.quantity * getLotSize(symbol)   // convert lots → contracts for backend
          })),
          t: daysToExpiry / 365.0,
          r: interestRate,
          v: volatility,
          spot_min: spotMin,
          spot_max: spotMax,
          spot_step: (spotMax - spotMin) / 80.0
        })
      });
      if (!res.ok) throw new Error('Calculation error');
      const data: PayoffResponse = await res.json();
      setPayoffCurve(data.payoff_curve);
      setPortfolioGreeks(data.greeks);
    } catch (err: any) {
      console.error("Payoff calculation error:", err);
    }
  };

  // Initial mount load
  useEffect(() => {
    fetchOptionChain(symbol, '');
  }, []);

  // Fetch strategist recommendation whenever parameters change
  useEffect(() => {
    if (optionChain) {
      fetchRecommendations();
    }
  }, [optionChain, vix, trendOverride, selectedExpiry]);

  // Recalculate portfolio payoff whenever legs or BS params change
  useEffect(() => {
    recalculatePayoff();
  }, [legs, daysToExpiry, interestRate, volatility, optionChain?.underlying_price]);

  // Helper to add leg to workbench
  const addLeg = (leg: Omit<OptionLeg, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setLegs(prev => [...prev, { ...leg, id }]);
  };

  const removeLeg = (id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
  };

  const updateLeg = (id: string, field: keyof OptionLeg, val: any) => {
    setLegs(prev => prev.map(l => {
      if (l.id === id) {
        return { ...l, [field]: val };
      }
      return l;
    }));
  };

  const clearAllLegs = () => setLegs([]);

  // Load a strategy into the workbench atomically — avoids React batching race conditions
  const loadStrategySetup = (strategy: StrategistRecommendation) => {
    const n = strategy.name.toLowerCase();
    const atm = optionChain?.atm_strike || 24250;
    const step = optionChain?.strikes.length
      ? Math.abs((optionChain.strikes[1]?.strike || atm + 50) - optionChain.strikes[0].strike)
      : 50;

    // Helper: find closest strike in chain
    const closest = (target: number) =>
      optionChain?.strikes.reduce((a, b) =>
        Math.abs(b.strike - target) < Math.abs(a.strike - target) ? b : a
      ) ?? null;

    // Helper: get CE/PE premium from row
    const ce  = (k: number) => closest(k)?.CE.ltp  || 0;
    const pe  = (k: number) => closest(k)?.PE.ltp  || 0;
    const ceBid = (k: number) => closest(k)?.CE.bid || ce(k);
    const ceAsk = (k: number) => closest(k)?.CE.ask || ce(k);
    const peBid = (k: number) => closest(k)?.PE.bid || pe(k);
    const peAsk = (k: number) => closest(k)?.PE.ask || pe(k);

    const id = () => Math.random().toString(36).substring(2, 9);

    let newLegs: OptionLeg[] = [];

    // ─── BUYING STRATEGIES ────────────────────────────────────────────────────
    if (n.includes('long call') || (n.includes('buy call') && !n.includes('spread'))) {
      newLegs = [
        { id: id(), type: 'call', action: 'buy', strike: atm, premium: ceAsk(atm), quantity: 1 }
      ];
    }
    else if (n.includes('long put') || (n.includes('buy put') && !n.includes('spread'))) {
      newLegs = [
        { id: id(), type: 'put', action: 'buy', strike: atm, premium: peAsk(atm), quantity: 1 }
      ];
    }
    else if (n.includes('long straddle') || (n.includes('straddle') && n.includes('long'))) {
      newLegs = [
        { id: id(), type: 'call', action: 'buy', strike: atm, premium: ceAsk(atm), quantity: 1 },
        { id: id(), type: 'put',  action: 'buy', strike: atm, premium: peAsk(atm), quantity: 1 }
      ];
    }
    else if (n.includes('long strangle') || (n.includes('strangle') && n.includes('long'))) {
      const cK = atm + step;
      const pK = atm - step;
      newLegs = [
        { id: id(), type: 'call', action: 'buy', strike: cK, premium: ceAsk(cK), quantity: 1 },
        { id: id(), type: 'put',  action: 'buy', strike: pK, premium: peAsk(pK), quantity: 1 }
      ];
    }
    else if (n.includes('bull call') || (n.includes('debit spread') && (n.includes('call') || n.includes('bull')))) {
      const buyK  = atm;
      const sellK = atm + 2 * step;
      newLegs = [
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 1 },
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 }
      ];
    }
    else if (n.includes('bear put') || (n.includes('debit spread') && (n.includes('put') || n.includes('bear')))) {
      const buyK  = atm;
      const sellK = atm - 2 * step;
      newLegs = [
        { id: id(), type: 'put', action: 'buy',  strike: buyK,  premium: peAsk(buyK),  quantity: 1 },
        { id: id(), type: 'put', action: 'sell', strike: sellK, premium: peBid(sellK), quantity: 1 }
      ];
    }
    else if (n.includes('call ratio backspread') || (n.includes('ratio backspread') && n.includes('call'))) {
      const sellK = atm;
      const buyK  = atm + step;
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 2 }
      ];
    }
    else if (n.includes('put ratio backspread') || (n.includes('ratio backspread') && n.includes('put'))) {
      const sellK = atm;
      const buyK  = atm - step;
      newLegs = [
        { id: id(), type: 'put', action: 'sell', strike: sellK, premium: peBid(sellK), quantity: 1 },
        { id: id(), type: 'put', action: 'buy',  strike: buyK,  premium: peAsk(buyK),  quantity: 2 }
      ];
    }
    else if (n.includes('ratio backspread')) {
      // generic fallback — assume call
      const sellK = atm;
      const buyK  = atm + step;
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 2 }
      ];
    }
    else if (n.includes('long zebra') || (n.includes('zebra') && !n.includes('short'))) {
      const buyK = atm - (2 * step); // ITM Call
      const sellK = atm; // ATM Call
      newLegs = [
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 2 },
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 }
      ];
    }
    else if (n.includes('short zebra')) {
      const buyK = atm + (2 * step); // ITM Put
      const sellK = atm; // ATM Put
      newLegs = [
        { id: id(), type: 'put', action: 'buy',  strike: buyK,  premium: peAsk(buyK),  quantity: 2 },
        { id: id(), type: 'put', action: 'sell', strike: sellK, premium: peBid(sellK), quantity: 1 }
      ];
    }
    else if (n.includes('long synthetic future') || (n.includes('synthetic future') && !n.includes('short'))) {
      newLegs = [
        { id: id(), type: 'call', action: 'buy',  strike: atm, premium: ceAsk(atm), quantity: 1 },
        { id: id(), type: 'put',  action: 'sell', strike: atm, premium: peBid(atm), quantity: 1 }
      ];
    }
    else if (n.includes('short synthetic future')) {
      newLegs = [
        { id: id(), type: 'put',  action: 'buy',  strike: atm, premium: peAsk(atm), quantity: 1 },
        { id: id(), type: 'call', action: 'sell', strike: atm, premium: ceBid(atm), quantity: 1 }
      ];
    }
    else if (n.includes('calendar spread') || n.includes('time spread')) {
      // Can only show current expiry; use far OTM as placeholder for far leg
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: atm, premium: ceBid(atm), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: atm, premium: ceAsk(atm) * 1.4, quantity: 1 }
      ];
    }

    // ─── SELLING / CREDIT STRATEGIES ─────────────────────────────────────────
    else if (n.includes('short straddle') || (n.includes('straddle') && (n.includes('short') || n.includes('sell')))) {
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: atm, premium: ceBid(atm), quantity: 1 },
        { id: id(), type: 'put',  action: 'sell', strike: atm, premium: peBid(atm), quantity: 1 }
      ];
    }
    else if (n.includes('short strangle') || (n.includes('strangle') && (n.includes('short') || n.includes('sell')))) {
      const cK = atm + step;
      const pK = atm - step;
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: cK, premium: ceBid(cK), quantity: 1 },
        { id: id(), type: 'put',  action: 'sell', strike: pK, premium: peBid(pK), quantity: 1 }
      ];
    }
    else if (n.includes('iron fly') || n.includes('iron butterfly')) {
      newLegs = [
        { id: id(), type: 'put',  action: 'buy',  strike: atm - 2 * step, premium: peAsk(atm - 2 * step), quantity: 1 },
        { id: id(), type: 'put',  action: 'sell', strike: atm,             premium: peBid(atm),             quantity: 1 },
        { id: id(), type: 'call', action: 'sell', strike: atm,             premium: ceBid(atm),             quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: atm + 2 * step, premium: ceAsk(atm + 2 * step), quantity: 1 }
      ];
    }
    else if (n.includes('iron condor')) {
      const peSell = atm - 2 * step;
      const peBuy  = atm - 4 * step;
      const ceSell = atm + 2 * step;
      const ceBuyK = atm + 4 * step;
      newLegs = [
        { id: id(), type: 'put',  action: 'buy',  strike: peBuy,  premium: peAsk(peBuy),  quantity: 1 },
        { id: id(), type: 'put',  action: 'sell', strike: peSell, premium: peBid(peSell), quantity: 1 },
        { id: id(), type: 'call', action: 'sell', strike: ceSell, premium: ceBid(ceSell), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: ceBuyK, premium: ceAsk(ceBuyK), quantity: 1 }
      ];
    }
    else if (n.includes('bull put') || (n.includes('credit spread') && (n.includes('put') || n.includes('bull')))) {
      const sellK = atm;
      const buyK  = atm - 2 * step;
      newLegs = [
        { id: id(), type: 'put', action: 'sell', strike: sellK, premium: peBid(sellK), quantity: 1 },
        { id: id(), type: 'put', action: 'buy',  strike: buyK,  premium: peAsk(buyK),  quantity: 1 }
      ];
    }
    else if (n.includes('bear call') || (n.includes('credit spread') && (n.includes('call') || n.includes('bear')))) {
      const sellK = atm;
      const buyK  = atm + 2 * step;
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 1 }
      ];
    }
    else if (n.includes('covered call') || n.includes('buy-write')) {
      const spot = optionChain?.underlying_price || atm;
      newLegs = [
        { id: id(), type: 'stock', action: 'buy',  strike: spot, premium: spot, quantity: 1 },
        { id: id(), type: 'call',  action: 'sell', strike: atm + step, premium: ceBid(atm + step), quantity: 1 }
      ];
    }
    else if (n.includes('protective put') || n.includes('married put')) {
      const spot = optionChain?.underlying_price || atm;
      newLegs = [
        { id: id(), type: 'stock', action: 'buy', strike: spot, premium: spot, quantity: 1 },
        { id: id(), type: 'put',   action: 'buy', strike: atm - step, premium: peAsk(atm - step), quantity: 1 }
      ];
    }
    else if (n.includes('short call') || n.includes('naked call')) {
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: atm + step, premium: ceBid(atm + step), quantity: 1 }
      ];
    }
    else if (n.includes('short put') || n.includes('naked put') || n.includes('cash-secured put')) {
      newLegs = [
        { id: id(), type: 'put', action: 'sell', strike: atm - step, premium: peBid(atm - step), quantity: 1 }
      ];
    }
    else {
      // ── Fallback: use strategy.type to load a sensible default ──
      if (strategy.type === 'buying') {
        newLegs = [
          { id: id(), type: 'call', action: 'buy', strike: atm, premium: ceAsk(atm), quantity: 1 }
        ];
      } else {
        newLegs = [
          { id: id(), type: 'call', action: 'sell', strike: atm + step, premium: ceBid(atm + step), quantity: 1 },
          { id: id(), type: 'put',  action: 'sell', strike: atm - step, premium: peBid(atm - step), quantity: 1 }
        ];
      }
    }

    // Atomically replace all legs in one state update
    setLegs(newLegs);
  };

  // SVG dimensions & limits for custom plot
  const chartWidth = 900;
  const chartHeight = 360;
  const padding = 50;

  const chartScale = useMemo(() => {
    if (payoffCurve.length === 0) return null;
    
    const spots = payoffCurve.map(p => p.spot);
    const expPnls = payoffCurve.map(p => p.expiration_pnl);
    const todayPnls = payoffCurve.map(p => p.today_pnl);
    const allPnls = [...expPnls, ...todayPnls];
    
    const minSpot = Math.min(...spots);
    const maxSpot = Math.max(...spots);
    const minPnl = Math.min(...allPnls);
    const maxPnl = Math.max(...allPnls);
    
    // Ensure 0 is visible on Y-axis
    const yMin = Math.min(minPnl * 1.15, -2000);
    const yMax = Math.max(maxPnl * 1.15, 2000);

    return { minSpot, maxSpot, yMin, yMax };
  }, [payoffCurve]);

  const { maxProfit, maxLoss, lotSize, lotCount, maxProfitPerLot, maxLossPerLot } = useMemo(() => {
    if (payoffCurve.length === 0 || legs.length === 0) {
      return { maxProfit: 0, maxLoss: 0, lotSize: 1, lotCount: 1, maxProfitPerLot: 0, maxLossPerLot: 0 };
    }
    const expPnls = payoffCurve.map(p => p.expiration_pnl);
    const minP = Math.min(...expPnls);
    const maxP = Math.max(...expPnls);

    // Boundary check for uncapped profits/losses
    const firstPoint = payoffCurve[0];
    const lastPoint  = payoffCurve[payoffCurve.length - 1];

    let isUncappedProfit = false;
    let isUncappedLoss   = false;

    if (lastPoint.expiration_pnl > maxP * 0.95 && legs.some(l => l.action === 'buy' && l.type === 'call')) isUncappedProfit = true;
    if (firstPoint.expiration_pnl > maxP * 0.95 && legs.some(l => l.action === 'buy' && l.type === 'put'))  isUncappedProfit = true;
    if (lastPoint.expiration_pnl < minP * 1.05 && legs.some(l => l.action === 'sell' && l.type === 'call')) isUncappedLoss = true;
    if (firstPoint.expiration_pnl < minP * 1.05 && legs.some(l => l.action === 'sell' && l.type === 'put')) isUncappedLoss = true;

    const currentLotSize = getLotSize(symbol);

    // leg.quantity now stores NUMBER OF LOTS (e.g. 1, 2).
    // Backend receives lots × lotSize contracts, so total payoff is already scaled.
    // The dominant leg's lot count = numLots for the full position.
    // Per-lot = total payoff / numLots  → gives P&L for exactly 1 lot.
    const numLots = Math.max(...legs.map(l => l.quantity), 1);

    const finalMaxProfit = isUncappedProfit ? Infinity : maxP;
    const finalMaxLoss   = isUncappedLoss   ? -Infinity : minP;

    return {
      maxProfit:       finalMaxProfit,
      maxLoss:         finalMaxLoss,
      lotSize:         currentLotSize,
      lotCount:        numLots,
      maxProfitPerLot: finalMaxProfit === Infinity  ? Infinity  : finalMaxProfit / numLots,
      maxLossPerLot:   finalMaxLoss   === -Infinity ? -Infinity : finalMaxLoss   / numLots
    };
  }, [payoffCurve, legs, symbol]);

  // Convert coordinate value to SVG pixel coordinate
  const getSvgX = (spot: number) => {
    if (!chartScale) return 0;
    return padding + ((spot - chartScale.minSpot) / (chartScale.maxSpot - chartScale.minSpot)) * (chartWidth - 2 * padding);
  };

  const getSvgY = (pnl: number) => {
    if (!chartScale) return 0;
    return chartHeight - padding - ((pnl - chartScale.yMin) / (chartScale.yMax - chartScale.yMin)) * (chartHeight - 2 * padding);
  };

  // Compile path strings for SVG
  const { expPath, todayPath, zeroY, spotLineX } = useMemo(() => {
    if (payoffCurve.length === 0 || !chartScale) return { expPath: '', todayPath: '', zeroY: 0, spotLineX: 0 };
    
    let expPoints = '';
    let todayPoints = '';
    
    payoffCurve.forEach((pt, i) => {
      const x = getSvgX(pt.spot);
      const yExp = getSvgY(pt.expiration_pnl);
      const yToday = getSvgY(pt.today_pnl);
      
      if (i === 0) {
        expPoints = `M ${x} ${yExp}`;
        todayPoints = `M ${x} ${yToday}`;
      } else {
        expPoints += ` L ${x} ${yExp}`;
        todayPoints += ` L ${x} ${yToday}`;
      }
    });

    const zeroY = getSvgY(0);
    const spotLineX = optionChain ? getSvgX(optionChain.underlying_price) : 0;
    
    return { expPath: expPoints, todayPath: todayPoints, zeroY, spotLineX };
  }, [payoffCurve, chartScale, optionChain?.underlying_price]);

  // SVG mouse movement tooltip tracker
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (payoffCurve.length === 0 || !chartScale) return;
    
    const svgRect = e.currentTarget.getBoundingClientRect();
    const xMouse = e.clientX - svgRect.left;
    
    // Find closest spot point by mapping xMouse back to spot
    const pct = (xMouse - padding) / (chartWidth - 2 * padding);
    const targetSpot = chartScale.minSpot + pct * (chartScale.maxSpot - chartScale.minSpot);
    
    const closest = payoffCurve.reduce((prev, curr) => {
      return abs(curr.spot - targetSpot) < abs(prev.spot - targetSpot) ? curr : prev;
    });
    
    setHoveredPoint(closest);
    setHoverX(getSvgX(closest.spot));
    setHoverY(getSvgY(closest.today_pnl));
  };

  const abs = (val: number) => Math.abs(val);

  const getConvictionLabel = (score: number) => {
    if (score >= 90) return { text: "HIGH CONVICTION 🔥", color: "#10b981" };
    if (score >= 75) return { text: "MEDIUM CONVICTION 📈", color: "#fbbf24" };
    return { text: "LOW CONVICTION ⚠️", color: "#f43f5e" };
  };

  const maxCallOIStrike = useMemo(() => {
    if (!optionChain?.strikes || optionChain.strikes.length === 0) return 0;
    return optionChain.strikes.reduce((max, current) => (current.CE.oi > max.CE.oi ? current : max), optionChain.strikes[0]).strike;
  }, [optionChain]);

  const maxPutOIStrike = useMemo(() => {
    if (!optionChain?.strikes || optionChain.strikes.length === 0) return 0;
    return optionChain.strikes.reduce((max, current) => (current.PE.oi > max.PE.oi ? current : max), optionChain.strikes[0]).strike;
  }, [optionChain]);

  return (
    <div style={{ paddingBottom: '3rem' }}>
      <header>
        <h1>
          <TrendingUp size={24} style={{ color: '#60a5fa' }} />
          Elite Option Strategy Builder
        </h1>
        
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Symbol Selector Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Underlying Asset</span>
            <select
              value={symbol}
              onChange={(e) => {
                const newSym = e.target.value;
                setSymbol(newSym);
                setSelectedExpiry('');
                fetchOptionChain(newSym, '');
              }}
              style={{ width: '220px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
            >
              {AVAILABLE_SYMBOLS.map(sym => (
                <option key={sym.value} value={sym.value}>{sym.label}</option>
              ))}
            </select>
          </div>

          {/* Expiry Selector Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Expiry Date</span>
            <select
              value={selectedExpiry}
              onChange={(e) => {
                const newExp = e.target.value;
                setSelectedExpiry(newExp);
                fetchOptionChain(symbol, newExp);
              }}
              disabled={!optionChain || optionChain.expiry_dates.length === 0}
              style={{ width: '250px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
            >
              {!optionChain ? (
                <option value="">No expiries loaded</option>
              ) : (
                optionChain.expiry_dates.slice(0, 3).map((date, index) => {
                  let label = '';
                  if (index === 0) label = `Current Expiry (${date})`;
                  else if (index === 1) label = `Next Expiry (${date})`;
                  else label = `Far Expiry (${date})`;
                  return (
                    <option key={date} value={date}>{label}</option>
                  );
                })
              )}
            </select>
          </div>

          {/* Refresh Button */}
          <button 
            className="outline" 
            onClick={() => fetchOptionChain(symbol, selectedExpiry)}
            disabled={chainLoading}
            style={{ height: '38px', padding: '0 1rem' }}
            title="Refresh F&O chain"
          >
            {chainLoading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '1rem', borderRadius: '12px', margin: '1.5rem auto', maxWidth: '1550px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertTriangle size={20} />
          <strong>Error: </strong> {error}
        </div>
      )}

      <div className="container">
        {/* SIDEBAR PARAMETERS */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="card-title">
              <Sliders size={18} /> Model Parameters
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>India VIX %</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={vix} 
                  onChange={(e) => setVix(parseFloat(e.target.value))} 
                  style={{ width: '100%' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Market Trend Bias</label>
                <select 
                  value={trendOverride} 
                  onChange={(e) => setTrendOverride(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Auto Detect</option>
                  <option value="Strong Trend">Strong Trend</option>
                  <option value="Weak Trend">Weak Trend</option>
                  <option value="Range-Bound">Range-Bound</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Risk-Free Rate (r)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={interestRate} 
                  onChange={(e) => setInterestRate(parseFloat(e.target.value))} 
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Pricing Volatility (v)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={volatility} 
                  onChange={(e) => setVolatility(parseFloat(e.target.value))} 
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Days to Expiration (t)</label>
                <input 
                  type="number" 
                  value={daysToExpiry} 
                  onChange={(e) => setDaysToExpiry(parseInt(e.target.value))} 
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Predefined Templates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Covered Call', rank: 1 } as any)}>Covered Call</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Bull Call Debit Spread', rank: 1 } as any)}>Bull Call Spread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Bull Put Credit Spread', rank: 1 } as any)}>Bull Put Spread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Iron Condor', rank: 1 } as any)}>Iron Condor</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Short Straddle', rank: 1 } as any)}>Short Straddle</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Call Ratio Backspread', rank: 1 } as any)}>Ratio Backspread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Long Zebra', rank: 1 } as any)}>Long Z.E.B.R.A</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Long Synthetic Future', rank: 1 } as any)}>Synthetic Future</button>
            </div>
          </div>
        </aside>

        {/* MAIN PANEL */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* ELITE STRATEGIST STATUS BAR */}
          {optionChain && (
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>SPOT UNDERLYING</span>
                  <strong style={{ fontSize: '1.2rem', color: '#60a5fa' }}>{optionChain.underlying_price.toFixed(2)}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> (as of {optionChain.selected_expiry})</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>PUT-CALL RATIO (PCR)</span>
                  <strong style={{ fontSize: '1.2rem' }}>{optionChain.pcr.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>MAX PAIN STRIKE</span>
                  <strong style={{ fontSize: '1.2rem', color: '#fbbf24' }}>{optionChain.max_pain}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>MAX CE OI STRIKE</span>
                  <strong style={{ fontSize: '1.2rem', color: '#f43f5e' }}>{maxCallOIStrike}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>MAX PE OI STRIKE</span>
                  <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{maxPutOIStrike}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>ATM STRADDLE PREMIUM</span>
                  <strong style={{ fontSize: '1.2rem' }}>{optionChain.atm_straddle.toFixed(2)}</strong>
                </div>
              </div>
              {optionChain.is_mock && (
                <div style={{ marginTop: '0.75rem', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', padding: '0.5rem', borderRadius: '8px', fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={14} />
                  <span><strong>Offline Mode:</strong> Displaying simulated mock Option Chain.</span>
                </div>
              )}
            </div>
          )}

          {/* ELITE OPTIONS STRATEGIST ADVICE */}
          {strategistData && (
            <div className="card" style={{ background: 'rgba(16, 24, 39, 0.4)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
              <div className="card-title">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={20} style={{ color: '#10b981' }} />
                  Elite NSE Strategist Insights (Confidence: {strategistData.regime.confidence}%)
                </span>
                <span className="strategist-regime-badge">
                  {strategistData.regime.trend} | {strategistData.regime.bias}
                </span>
              </div>
              
              {strategistData.warnings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                  {strategistData.warnings.map((w, idx) => (
                    <div key={idx} style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={14} />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Institutional High-Conviction Spotlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                {/* Buy Side Spotlight */}
                {strategistData.buying_strategies.length > 0 && (() => {
                  const topBuy = strategistData.buying_strategies[0];
                  const conviction = getConvictionLabel(topBuy.score || 80);
                  return (
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(20, 27, 41, 0.9))', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981', letterSpacing: '0.1em' }}>★ Top Buy Strategy</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: conviction.color, background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            {conviction.text}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: '0.5rem', color: '#f3f4f6' }}>{topBuy.name}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{topBuy.description}</p>
                        
                        <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '3px solid #10b981' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.1rem' }}>STRIKES TO EXECUTE</span>
                          <strong style={{ color: '#e5e7eb' }}>{topBuy.strikes}</strong>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>MAX RISK / LOSS</span>
                            <strong style={{ color: '#f43f5e' }}>{topBuy.max_loss}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>RISK-REWARD DETAILS</span>
                            <strong style={{ color: '#10b981' }}>{topBuy.risk_reward}</strong>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        className="primary" 
                        onClick={() => loadStrategySetup(topBuy)}
                        style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                      >
                        Load & Visualise Setup
                      </button>
                    </div>
                  );
                })()}

                {/* Sell Side Spotlight */}
                {strategistData.selling_strategies.length > 0 && (() => {
                  const topSell = strategistData.selling_strategies[0];
                  const conviction = getConvictionLabel(topSell.score || 80);
                  return (
                    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(20, 27, 41, 0.9))', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#a78bfa', letterSpacing: '0.1em' }}>★ Top Sell Strategy</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: conviction.color, background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            {conviction.text}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: '0.5rem', color: '#f3f4f6' }}>{topSell.name}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{topSell.description}</p>
                        
                        <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '3px solid #8b5cf6' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.1rem' }}>STRIKES TO EXECUTE</span>
                          <strong style={{ color: '#e5e7eb' }}>{topSell.strikes}</strong>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>MAX RISK / LOSS</span>
                            <strong style={{ color: '#f43f5e' }}>{topSell.max_loss}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>RISK-REWARD DETAILS</span>
                            <strong style={{ color: '#fbbf24' }}>{topSell.risk_reward}</strong>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        className="primary" 
                        onClick={() => loadStrategySetup(topSell)}
                        style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--color-purple), #7c3aed)' }}
                      >
                        Load & Visualise Setup
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                {/* BUYING SECTION */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: '#10b981', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                    Top Option Buying Setups
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {strategistData.buying_strategies.map((strat, i) => (
                      <div key={i} className="card strategist-card" style={{ padding: '1rem' }}>
                        <div className="strategist-header">
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {strat.rank}. {strat.name}
                          </strong>
                          <span className="risk-tag defined">{strat.risk_type}</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{strat.description}</p>
                        <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.5rem', color: '#60a5fa' }}>
                          <strong>Strikes: </strong> {strat.strikes}
                        </div>
                        <div className="strategy-metric-grid">
                          <div>Max Loss: <span style={{ color: '#f43f5e' }}>{strat.max_loss}</span></div>
                          <div>Max Profit: <span style={{ color: '#10b981' }}>{strat.max_profit}</span></div>
                          <div>Breakeven: <span>{strat.breakeven}</span></div>
                          <div>R-R Ratio: <span style={{ fontWeight: 600 }}>{strat.risk_reward}</span></div>
                        </div>
                        <button 
                          className="outline" 
                          onClick={() => loadStrategySetup(strat)}
                          style={{ width: '100%', marginTop: '0.75rem', padding: '0.4rem', fontSize: '0.8rem' }}
                        >
                          Load Positions in Workbench <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SELLING SECTION */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: '#8b5cf6', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                    Top Option Selling / Income Setups
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {strategistData.selling_strategies.map((strat, i) => (
                      <div key={i} className="card strategist-card selling" style={{ padding: '1rem' }}>
                        <div className="strategist-header">
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {strat.rank}. {strat.name}
                          </strong>
                          <span className={`risk-tag ${strat.risk_type === 'UNDEFINED RISK' ? 'undefined' : 'defined'}`}>{strat.risk_type}</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{strat.description}</p>
                        <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.5rem', color: '#c084fc' }}>
                          <strong>Strikes: </strong> {strat.strikes}
                        </div>
                        <div className="strategy-metric-grid">
                          <div>Max Loss: <span style={{ color: '#f43f5e' }}>{strat.max_loss}</span></div>
                          <div>Max Profit: <span style={{ color: '#10b981' }}>{strat.max_profit}</span></div>
                          <div>Breakeven: <span>{strat.breakeven}</span></div>
                          <div>R-R Ratio: <span style={{ fontWeight: 600 }}>{strat.risk_reward}</span></div>
                        </div>
                        <button 
                          className="outline" 
                          onClick={() => loadStrategySetup(strat)}
                          style={{ width: '100%', marginTop: '0.75rem', padding: '0.4rem', fontSize: '0.8rem' }}
                        >
                          Load Positions in Workbench <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE WORKBENCH */}
          <div className="card">
            <div className="card-title">
              <span>Workbench Selection ({legs.length} Active Leg{legs.length !== 1 ? 's' : ''} · {legs.reduce((s, l) => s + l.quantity, 0)} lot{legs.reduce((s, l) => s + l.quantity, 0) !== 1 ? 's' : ''} total)</span>
              {legs.length > 0 && (
                <button className="danger" onClick={clearAllLegs} style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}>
                  <RotateCcw size={12} /> Reset Workbench
                </button>
              )}
            </div>
            
            {legs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dark)', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
                No active positions. Select a strategist preset above or click options pricing in the table below to add legs.
              </div>
            ) : (
              <div className="legs-list">
                {legs.map((leg) => (
                  <div key={leg.id} className="leg-card">
                    <span className={`leg-badge ${leg.action}`}>
                      {leg.action}
                    </span>
                    <div className="leg-details">
                      <span className="title">{leg.strike} {leg.type.toUpperCase()}</span>
                      <span className="subtitle">LTP / Premium: Rs.{leg.premium.toFixed(2)}</span>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Type</label>
                      <select 
                        value={leg.type}
                        onChange={(e) => updateLeg(leg.id, 'type', e.target.value)}
                        style={{ padding: '0.2rem', fontSize: '0.8rem' }}
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                        <option value="stock">Underlying</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Action</label>
                      <select 
                        value={leg.action}
                        onChange={(e) => updateLeg(leg.id, 'action', e.target.value)}
                        style={{ padding: '0.2rem', fontSize: '0.8rem' }}
                      >
                        <option value="buy">Buy (Long)</option>
                        <option value="sell">Sell (Short)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Lots</label>
                      <input 
                        type="number" 
                        min={1}
                        value={leg.quantity}
                        onChange={(e) => updateLeg(leg.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ padding: '0.2rem', width: '55px', fontSize: '0.8rem' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        {leg.quantity * getLotSize(symbol)} contracts
                      </span>
                    </div>
                    <button className="danger" onClick={() => removeLeg(leg.id)} style={{ padding: '0.4rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button 
              className="outline" 
              onClick={() => addLeg({ type: 'call', action: 'buy', strike: optionChain?.atm_strike || 24000, premium: 50.0, quantity: 1 })}
              style={{ width: '100%', marginTop: '1rem' }}
            >
              <Plus size={16} /> Add Custom Position Leg
            </button>
          </div>

          {/* PAYOFF PLOT AND GREEKS */}
          {payoffCurve.length > 0 && chartScale && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              <div className="card">
                <h3 className="card-title">Interactive Option Payoff Profile</h3>
                
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '12px', height: '3px', background: '#3b82f6', display: 'inline-block' }}></span>
                    <span>Payoff Today (BS Greeks)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '12px', height: '3px', background: '#10b981', borderStyle: 'dashed', borderWidth: '1.5px', borderColor: '#10b981', display: 'inline-block' }}></span>
                    <span>Payoff at Expiration</span>
                  </div>
                </div>

                <div className="payoff-chart-wrapper">
                  <svg className="chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredPoint(null)}>
                    {/* Y=0 horizontal dashed axis */}
                    <line 
                      x1={padding} 
                      y1={zeroY} 
                      x2={chartWidth - padding} 
                      y2={zeroY} 
                      stroke="rgba(255, 255, 255, 0.2)" 
                      strokeDasharray="4,4" 
                      strokeWidth={1.5}
                    />

                    {/* Spot vertical line indicator */}
                    <line 
                      x1={spotLineX} 
                      y1={padding} 
                      x2={spotLineX} 
                      y2={chartHeight - padding} 
                      stroke="rgba(96, 165, 250, 0.4)" 
                      strokeWidth={1}
                      strokeDasharray="2,2"
                    />
                    
                    {/* Expiration Payoff line */}
                    <path 
                      d={expPath} 
                      fill="none" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      strokeDasharray="4,4"
                    />

                    {/* Today Payoff line */}
                    <path 
                      d={todayPath} 
                      fill="none" 
                      stroke="#3b82f6" 
                      strokeWidth={2.5}
                    />

                    {/* Tooltip vertical line tracking */}
                    {hoveredPoint && (
                      <>
                        <line 
                          x1={hoverX} 
                          y1={padding} 
                          x2={hoverX} 
                          y2={chartHeight - padding} 
                          stroke="rgba(255, 255, 255, 0.3)" 
                          strokeWidth={1}
                        />
                        <circle 
                          cx={hoverX} 
                          cy={hoverY} 
                          r={5} 
                          fill="#3b82f6" 
                          stroke="white" 
                          strokeWidth={1.5}
                        />
                      </>
                    )}
                  </svg>
                  
                  {/* Absolute positioning HTML values for axis */}
                  <span style={{ position: 'absolute', left: `${padding}px`, bottom: '15px', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                    Rs.{chartScale.minSpot.toFixed(0)}
                  </span>
                  <span style={{ position: 'absolute', right: `${padding}px`, bottom: '15px', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                    Rs.{chartScale.maxSpot.toFixed(0)}
                  </span>
                  <span style={{ position: 'absolute', left: `${spotLineX}px`, top: '15px', fontSize: '0.7rem', color: '#60a5fa', transform: 'translateX(-50%)', background: 'rgba(10, 13, 20, 0.8)', padding: '2px 6px', borderRadius: '4px' }}>
                    Spot: {optionChain?.underlying_price.toFixed(1)}
                  </span>

                  {/* Interactive Tooltip Card overlay */}
                  {hoveredPoint && (
                    <div style={{ position: 'absolute', left: `${hoverX + 15}px`, top: `${hoverY - 40}px`, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 0.8rem', borderRadius: '8px', zIndex: 10, fontSize: '0.8rem', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                      <div>Stock price: <strong>Rs.{hoveredPoint.spot.toFixed(2)}</strong></div>
                      <div style={{ color: '#3b82f6' }}>P&L Today: <strong>Rs.{hoveredPoint.today_pnl.toFixed(2)}</strong></div>
                      <div style={{ color: '#10b981' }}>P&L Expiry: <strong>Rs.{hoveredPoint.expiration_pnl.toFixed(2)}</strong></div>
                    </div>
                  )}
                </div>
              </div>

              {/* RISK PROFILE AND LOT QUANTITY ANALYSIS */}
              {portfolioGreeks && (
                <div className="card" style={{ background: 'rgba(16, 24, 39, 0.2)', borderColor: 'rgba(96, 165, 250, 0.1)' }}>
                  <h3 className="card-title">
                    Strategy Risk & Payoff Metrics
                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                      Lot Size: {lotSize} contracts · Position: {lotCount} lot{lotCount !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    <div className="metric-box">
                      <span className="metric-label">MAX PROFIT (FULL POSITION)</span>
                      <strong className={`metric-value ${maxProfit > 0 || maxProfit === Infinity ? 'positive' : 'neutral'}`}>
                        {maxProfit === Infinity ? 'Unlimited' : `Rs.${maxProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                      </strong>
                    </div>

                    <div className="metric-box">
                      <span className="metric-label">MAX LOSS (FULL POSITION)</span>
                      <strong className={`metric-value ${maxLoss < 0 || maxLoss === -Infinity ? 'negative' : 'neutral'}`}>
                        {maxLoss === -Infinity ? 'Unlimited' : `Rs.${Math.abs(maxLoss).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                      </strong>
                    </div>

                    <div className="metric-box" style={{ border: '2px solid rgba(16, 185, 129, 0.2)' }}>
                      <span className="metric-label">MAX PROFIT (PER LOT of {lotSize})</span>
                      <strong className={`metric-value ${maxProfitPerLot > 0 || maxProfitPerLot === Infinity ? 'positive' : 'neutral'}`}>
                        {maxProfitPerLot === Infinity ? 'Unlimited' : `Rs.${maxProfitPerLot.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                      </strong>
                    </div>

                    <div className="metric-box" style={{ border: '2px solid rgba(239, 68, 68, 0.2)' }}>
                      <span className="metric-label">MAX LOSS (PER LOT of {lotSize})</span>
                      <strong className={`metric-value ${maxLossPerLot < 0 || maxLossPerLot === -Infinity ? 'negative' : 'neutral'}`}>
                        {maxLossPerLot === -Infinity ? 'Unlimited' : `Rs.${Math.abs(maxLossPerLot).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* GREEKS CONSOLE */}
              {portfolioGreeks && (
                <div className="card">
                  <h3 className="card-title">Portfolio Greeks Sensitivity Analysis</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    <div className="metric-box">
                      <span className="metric-label">Delta (Δ)</span>
                      <strong className={`metric-value ${portfolioGreeks.delta > 0 ? 'positive' : portfolioGreeks.delta < 0 ? 'negative' : 'neutral'}`}>
                        {portfolioGreeks.delta}
                      </strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Gamma (γ)</span>
                      <strong className="metric-value" style={{ color: 'var(--color-purple)' }}>
                        {portfolioGreeks.gamma.toFixed(5)}
                      </strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Theta (θ / daily)</span>
                      <strong className={`metric-value ${portfolioGreeks.theta > 0 ? 'positive' : portfolioGreeks.theta < 0 ? 'negative' : 'neutral'}`}>
                        {portfolioGreeks.theta}
                      </strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Vega (v)</span>
                      <strong className="metric-value" style={{ color: 'var(--color-warning)' }}>
                        {portfolioGreeks.vega}
                      </strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Net Investment Cost</span>
                      <strong className="metric-value neutral">
                        Rs.{portfolioGreeks.net_cost}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OPTIONS CHAIN TABLE */}
          {optionChain && (
            <div className="card">
              <h3 className="card-title">NSE Option Chain (Expiry: {optionChain.selected_expiry})</h3>
              <div className="option-chain-container">
                <table className="option-chain-table">
                  <thead>
                    <tr>
                      <th colSpan={5} className="ce-header" style={{ color: '#10b981' }}>CALL OPTIONS (CE)</th>
                      <th style={{ background: 'rgba(255,255,255,0.05)' }}>STRIKE</th>
                      <th colSpan={5} className="pe-header" style={{ color: '#f43f5e' }}>PUT OPTIONS (PE)</th>
                    </tr>
                    <tr>
                      <th>OI</th>
                      <th>OI Chg</th>
                      <th>IV%</th>
                      <th>Bid</th>
                      <th>Ask</th>
                      <th style={{ background: 'rgba(255,255,255,0.05)' }}>Price</th>
                      <th>Bid</th>
                      <th>Ask</th>
                      <th>IV%</th>
                      <th>OI Chg</th>
                      <th>OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optionChain.strikes.map((row) => {
                      const isAtTheMoney = row.strike === optionChain.atm_strike;
                      
                      return (
                        <tr key={row.strike} style={isAtTheMoney ? { background: 'rgba(59, 130, 246, 0.05)' } : {}}>
                          <td style={{ color: 'var(--text-muted)' }}>{row.CE.oi.toLocaleString()}</td>
                          <td style={{ color: row.CE.oi_change >= 0 ? '#10b981' : '#f43f5e' }}>
                            {row.CE.oi_change.toLocaleString()}
                          </td>
                          <td>{(row.CE.iv).toFixed(1)}%</td>
                          <td>
                            <span className="clickable-price bid" onClick={() => addLeg({ type: 'call', action: 'sell', strike: row.strike, premium: row.CE.bid || row.CE.ltp, quantity: 1 })}>
                              {row.CE.bid || '-'}
                            </span>
                          </td>
                          <td>
                            <span className="clickable-price ask" onClick={() => addLeg({ type: 'call', action: 'buy', strike: row.strike, premium: row.CE.ask || row.CE.ltp, quantity: 1 })}>
                              {row.CE.ask || '-'}
                            </span>
                          </td>
                          
                          <td className="strike-cell">{row.strike}</td>
                          
                          <td>
                            <span className="clickable-price ask" onClick={() => addLeg({ type: 'put', action: 'buy', strike: row.strike, premium: row.PE.bid || row.PE.ltp, quantity: 1 })}>
                              {row.PE.bid || '-'}
                            </span>
                          </td>
                          <td>
                            <span className="clickable-price bid" onClick={() => addLeg({ type: 'put', action: 'sell', strike: row.strike, premium: row.PE.ask || row.PE.ltp, quantity: 1 })}>
                              {row.PE.ask || '-'}
                            </span>
                          </td>
                          <td>{(row.PE.iv).toFixed(1)}%</td>
                          <td style={{ color: row.PE.oi_change >= 0 ? '#10b981' : '#f43f5e' }}>
                            {row.PE.oi_change.toLocaleString()}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{row.PE.oi.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
