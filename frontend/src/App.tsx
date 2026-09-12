import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
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
  RefreshCw, 
  Zap,
  ExternalLink,
  Award,
  BarChart2,
  PieChart,
  Layers,
  Activity
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
  CE: { ltp: number; oi: number; oi_change: number; change: number; iv: number; bid: number; ask: number };
  PE: { ltp: number; oi: number; oi_change: number; change: number; iv: number; bid: number; ask: number };
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

interface NdayResult {
  symbol: string;
  name: string;
  industry: string;
  close: number;
  high: number;
  change_pct: number;
  matched_lookbacks: number[];
  max_lookback_hit: number;
  years_equivalent: number;
  is_fo: boolean;
}

interface OiSpurtItem {
  symbol: string;
  latestOI: number;
  prevOI: number;
  changeInOI: number;
  avgInOI: number; // % change in OI
  volume: number;
  underlyingValue: number; // close stock price
}

interface ChangeInOiRecord {
  symbol: string;
  instrument_type: string;
  expiry_date: string;
  strike_price: number;
  option_type: string;
  current_oi: number;
  prev_oi: number;
  change_in_oi: number;
  pct_change_in_oi: number;
  ltp: number;
  prev_close: number;
  pct_change_in_ltp: number;
  volume: number;
  turnover_value_lakhs: number;
  is_index: boolean;
}

interface ChangeInOiResponse {
  metadata: {
    timestamp: string;
    total_long_buildup_records: number;
    total_short_covering_records: number;
    total_short_buildup_records: number;
    total_long_unwinding_records: number;
    extracted_at: string;
  };
  long_buildup: ChangeInOiRecord[];
  short_covering: ChangeInOiRecord[];
  short_buildup: ChangeInOiRecord[];
  long_unwinding: ChangeInOiRecord[];
  is_mock: boolean;
}

interface FuturesBuildupRecord {
  symbol: string;
  instrument_name: string;
  instrument_type: string;
  expiry_date: string;
  ltp: number;
  prev_close: number;
  pct_change_in_ltp: number;
  current_oi: number;
  prev_oi: number;
  change_in_oi: number;
  pct_change_in_oi: number;
  volume: number;
  turnover_value_lakhs: number;
  is_index: boolean;
}

interface FuturesBuildupResponse {
  metadata: {
    timestamp: string;
    total_long_buildup_records: number;
    total_short_covering_records: number;
    total_short_buildup_records: number;
    total_long_unwinding_records: number;
    extracted_at: string;
  };
  long_buildup: FuturesBuildupRecord[];
  short_covering: FuturesBuildupRecord[];
  short_buildup: FuturesBuildupRecord[];
  long_unwinding: FuturesBuildupRecord[];
  is_mock: boolean;
  notes: string;
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
  'BANKEX': 15,
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
  'SENSEX': 20,
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

const formatOiNumber = (val: number): string => {
  const absVal = Math.abs(val);
  if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (absVal >= 100000) return `${(val / 100000).toFixed(2)} L`;
  if (absVal >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toLocaleString();
};

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

  // Navigation
  const [activeTab, setActiveTab] = useState<'workbench' | 'scanner' | 'breakout' | 'oi_spurts' | 'change_in_oi' | 'futures_buildup' | 'oi_graph' | 'high_momentum' | 'elder_impulse' | 'straddle_chart' | 'oi_crossover_scanner' | 'vcp' | 'backtest_lab'>('workbench');

  // Backtest Lab States
  const [backtestSummary, setBacktestSummary] = useState<{ strategies: any[]; portfolio: any; updated_at: string | null } | null>(null);
  const [backtestStatus, setBacktestStatus] = useState<string>('idle');
  const [backtestLoading, setBacktestLoading] = useState<boolean>(false);
  const [backtestAssetFilter, setBacktestAssetFilter] = useState<string>('ALL');
  const [backtestSortField, setBacktestSortField] = useState<string>('Sharpe_Ratio');
  const [backtestSortAsc, setBacktestSortAsc] = useState<boolean>(false);
  const [selectedTearsheet, setSelectedTearsheet] = useState<{ title: string; asset?: string; strategy?: string; report?: string } | null>(null);

  const fetchBacktestSummary = async () => {
    try {
      const res = await fetch('/api/backtest/summary');
      if (res.ok) {
        const data = await res.json();
        setBacktestSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch backtest summary:', err);
    }
  };

  const triggerBacktestRun = async () => {
    setBacktestLoading(true);
    setBacktestStatus('running');
    try {
      const res = await fetch('/api/backtest/run', { method: 'POST' });
      if (res.ok) {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/backtest/status');
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setBacktestStatus(statusData.status);
              if (statusData.status !== 'running') {
                clearInterval(pollInterval);
                setBacktestLoading(false);
                fetchBacktestSummary();
              }
            }
          } catch (e) {
            clearInterval(pollInterval);
            setBacktestLoading(false);
          }
        }, 2000);
      } else {
        setBacktestLoading(false);
      }
    } catch (err) {
      console.error('Failed to trigger backtest:', err);
      setBacktestLoading(false);
    }
  };

  // Minervini VCP Scanner States
  const [vcpUniverse, setVcpUniverse] = useState<'nifty_50' | 'nifty_200' | 'midcap' | 'smallcap' | 'custom'>('nifty_200');
  const [vcpCustomTickers, setVcpCustomTickers] = useState<string>('');
  const [vcpOnlySignals, setVcpOnlySignals] = useState<boolean>(false);
  const [vcpShowSettings, setVcpShowSettings] = useState<boolean>(false);
  const [vcpPivotStrength, setVcpPivotStrength] = useState<number>(5);
  const [vcpMinContractions, setVcpMinContractions] = useState<number>(2);
  const [vcpContractionTol, setVcpContractionTol] = useState<number>(0.90);
  const [vcpRsMinRating, setVcpRsMinRating] = useState<number>(70);
  const [vcpBreakoutVolMult, setVcpBreakoutVolMult] = useState<number>(1.5);
  const [vcpStopBufferPct, setVcpStopBufferPct] = useState<number>(1.0);
  const [vcpRMultipleTarget, setVcpRMultipleTarget] = useState<number>(3.0);
  const [vcpUseMarketFilter, setVcpUseMarketFilter] = useState<boolean>(true);
  const [vcpEnableCode3, setVcpEnableCode3] = useState<boolean>(false);
  const [vcpCandidates, setVcpCandidates] = useState<any[]>([]);
  const [vcpMetadata, setVcpMetadata] = useState<any | null>(null);
  const [vcpScanning, setVcpScanning] = useState<boolean>(false);
  const [vcpProgress, setVcpProgress] = useState<number>(0);
  const [vcpStatusMsg, setVcpStatusMsg] = useState<string>('Ready');
  const [vcpFilter, setVcpFilter] = useState<string>('');
  const [vcpSelectedCandidate, setVcpSelectedCandidate] = useState<string | null>(null);
  const [vcpBacktestLoading, setVcpBacktestLoading] = useState<boolean>(false);
  const [vcpBacktestData, setVcpBacktestData] = useState<any | null>(null);
  const [vcpModalTab, setVcpModalTab] = useState<'backtest' | 'chart'>('backtest');
  const [vcpChartPeriod, setVcpChartPeriod] = useState<string>('1y');
  const [vcpChartData, setVcpChartData] = useState<any | null>(null);
  const [vcpChartLoading, setVcpChartLoading] = useState<boolean>(false);
  const [vcpShowSma50, setVcpShowSma50] = useState<boolean>(true);
  const [vcpShowSma150, setVcpShowSma150] = useState<boolean>(true);
  const [vcpShowSma200, setVcpShowSma200] = useState<boolean>(true);
  const [vcpShowEma10, setVcpShowEma10] = useState<boolean>(true);
  const [vcpShowVolume, setVcpShowVolume] = useState<boolean>(true);

  const fetchVcpResults = async () => {
    try {
      const res = await fetch('/api/vcp/results');
      if (res.ok) {
        const data = await res.json();
        setVcpCandidates(data.candidates || []);
        setVcpMetadata(data.metadata || null);
      }
    } catch (err) {
      console.error('Failed to fetch VCP results:', err);
    }
  };

  const exportVcpData = (format: 'json' | 'csv') => {
    window.open(`/api/vcp/export?format=${format}`, '_blank');
  };

  const runVcpScan = async () => {
    setVcpScanning(true);
    setVcpProgress(0);
    setVcpStatusMsg('Initiating Minervini VCP scan...');
    try {
      const parsedTickers = vcpUniverse === 'custom' && vcpCustomTickers.trim()
        ? vcpCustomTickers.split(',').map(t => t.trim()).filter(Boolean)
        : undefined;

      const res = await fetch('/api/vcp/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe: vcpUniverse,
          tickers: parsedTickers,
          rs_min_rating: vcpRsMinRating,
          min_contractions: vcpMinContractions,
          contraction_tol: vcpContractionTol,
          pivot_strength: vcpPivotStrength,
          breakout_vol_mult: vcpBreakoutVolMult,
          stop_buffer_pct: vcpStopBufferPct,
          r_multiple_target: vcpRMultipleTarget,
          use_market_filter: vcpUseMarketFilter,
          enable_code3: vcpEnableCode3
        })
      });
      if (!res.ok) throw new Error('Failed to start VCP scan');

      const pollId = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/vcp/status');
          if (statusRes.ok) {
            const status = await statusRes.json();
            setVcpProgress(status.progress_pct);
            setVcpStatusMsg(status.status_message);
            if (!status.is_scanning) {
              clearInterval(pollId);
              setVcpScanning(false);
              fetchVcpResults();
            }
          }
        } catch (err) {
          console.error('Error polling VCP status:', err);
          clearInterval(pollId);
          setVcpScanning(false);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to execute VCP scan');
      setVcpScanning(false);
    }
  };

  const runVcpBacktest = async (sym: string) => {
    setVcpSelectedCandidate(sym);
    setVcpBacktestLoading(true);
    setVcpBacktestData(null);
    try {
      const res = await fetch('/api/vcp/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          initial_capital: 1000000,
          pct_per_trade: 10,
          r_target: 3.0,
          use_market_filter: vcpUseMarketFilter
        })
      });
      if (res.ok) {
        const data = await res.json();
        setVcpBacktestData(data);
      }
    } catch (err) {
      console.error('Failed to run VCP backtest:', err);
    } finally {
      setVcpBacktestLoading(false);
    }
  };

  const openVcpChecklistModal = (sym: string) => {
    setVcpSelectedCandidate(sym);
    setVcpModalTab('backtest');
    setVcpBacktestData(null);
    runVcpBacktest(sym);
  };

  const runVcpChartData = async (symbol: string, period: string = '1y') => {
    setVcpChartLoading(true);
    setVcpChartPeriod(period);
    try {
      const res = await fetch(`/api/vcp/chart-data?symbol=${encodeURIComponent(symbol)}&period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setVcpChartData(data);
      }
    } catch (err) {
      console.error('Failed to fetch VCP chart data:', err);
    } finally {
      setVcpChartLoading(false);
    }
  };

  const openVcpChartModal = (sym: string) => {
    setVcpSelectedCandidate(sym);
    setVcpModalTab('chart');
    setVcpChartData(null);
    runVcpChartData(sym, '1y');
  };

  const renderVcpCandlestickChart = (data: any[]) => {
    if (!data || data.length === 0) return null;
    const width = 840;
    const height = 420;
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 75;
    const volumeHeight = 75;
    const mainHeight = height - paddingTop - paddingBottom - volumeHeight;

    const highs = data.map(c => c.high);
    const lows = data.map(c => c.low);
    const minPrice = Math.min(...lows) * 0.98;
    const maxPrice = Math.max(...highs) * 1.02;
    const priceRange = maxPrice - minPrice || 1;

    const maxVol = Math.max(...data.map(c => c.volume)) || 1;

    const chartWidth = width - paddingLeft - paddingRight;
    const barStep = chartWidth / data.length;
    const barWidth = Math.max(1, barStep * 0.65);

    const getY = (price: number) => paddingTop + mainHeight * (1 - (price - minPrice) / priceRange);
    const getVolY = (vol: number) => height - paddingBottom - (vol / maxVol) * volumeHeight;

    const createMaPath = (key: string) => {
      let pathStr = '';
      data.forEach((c, i) => {
        if (c[key] != null && !isNaN(c[key])) {
          const x = paddingLeft + i * barStep + barStep / 2;
          const y = getY(c[key]);
          pathStr += `${pathStr === '' ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
        }
      });
      return pathStr;
    };

    const pathSma50 = createMaPath('sma50');
    const pathSma150 = createMaPath('sma150');
    const pathSma200 = createMaPath('sma200');
    const pathEma10 = createMaPath('ema10');

    const dateTicks: { x: number; label: string }[] = [];
    const stepIdx = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += stepIdx) {
      const x = paddingLeft + i * barStep + barStep / 2;
      dateTicks.push({ x, label: data[i].date });
    }

    return (
      <div style={{ position: 'relative', width: '100%', background: '#0b1329', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.8rem', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#14b8a6', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={vcpShowEma10} onChange={e => setVcpShowEma10(e.target.checked)} />
              10 EMA
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f97316', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={vcpShowSma50} onChange={e => setVcpShowSma50(e.target.checked)} />
              50 SMA
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={vcpShowSma150} onChange={e => setVcpShowSma150(e.target.checked)} />
              150 SMA
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={vcpShowSma200} onChange={e => setVcpShowSma200(e.target.checked)} />
              200 SMA
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#a855f7', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={vcpShowVolume} onChange={e => setVcpShowVolume(e.target.checked)} />
              Volume
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Period:</span>
            {['6m', '1y', '2y'].map(p => (
              <button
                key={p}
                onClick={() => runVcpChartData(vcpSelectedCandidate!, p)}
                className={vcpChartPeriod === p ? 'primary' : 'outline'}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', textTransform: 'uppercase' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const price = minPrice + priceRange * (1 - pct);
            const y = paddingTop + mainHeight * pct;
            return (
              <g key={i}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 4} fill="var(--text-muted)" fontSize={10} textAnchor="end" fontFamily="JetBrains Mono">
                  ₹{price.toFixed(0)}
                </text>
              </g>
            );
          })}

          {dateTicks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={paddingTop + mainHeight} x2={t.x} y2={paddingTop + mainHeight + 4} stroke="rgba(255,255,255,0.2)" />
              <text x={t.x} y={height - paddingBottom + 18} fill="var(--text-muted)" fontSize={9} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}

          {vcpShowVolume && (
            <line x1={paddingLeft} y1={height - paddingBottom - volumeHeight} x2={width - paddingRight} y2={height - paddingBottom - volumeHeight} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
          )}

          {data.map((c, i) => {
            const xCenter = paddingLeft + i * barStep + barStep / 2;
            const isBull = c.close >= c.open;
            const color = isBull ? '#22c55e' : '#ef4444';
            const candleTop = getY(Math.max(c.open, c.close));
            const candleBot = getY(Math.min(c.open, c.close));
            const candleH = Math.max(1.5, candleBot - candleTop);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const volY = getVolY(c.volume);
            const volH = height - paddingBottom - volY;

            return (
              <g key={i}>
                {vcpShowVolume && (
                  <rect
                    x={xCenter - barWidth / 2}
                    y={volY}
                    width={barWidth}
                    height={volH}
                    fill={color}
                    opacity={0.35}
                  />
                )}
                <line x1={xCenter} y1={highY} x2={xCenter} y2={lowY} stroke={color} strokeWidth={1.2} />
                <rect
                  x={xCenter - barWidth / 2}
                  y={candleTop}
                  width={barWidth}
                  height={candleH}
                  fill={color}
                  stroke={color}
                  strokeWidth={1}
                />

                {c.trigger_bar && (
                  <circle cx={xCenter} cy={lowY + 6} r={3} fill="#fbbf24" />
                )}
                {c.entry_signal && (
                  <polygon points={`${xCenter},${highY - 10} ${xCenter - 4},${highY - 3} ${xCenter + 4},${highY - 3}`} fill="#22c55e" />
                )}
              </g>
            );
          })}

          {vcpShowEma10 && pathEma10 && <path d={pathEma10} fill="none" stroke="#14b8a6" strokeWidth={1.5} />}
          {vcpShowSma50 && pathSma50 && <path d={pathSma50} fill="none" stroke="#f97316" strokeWidth={1.5} />}
          {vcpShowSma150 && pathSma150 && <path d={pathSma150} fill="none" stroke="#3b82f6" strokeWidth={1.5} />}
          {vcpShowSma200 && pathSma200 && <path d={pathSma200} fill="none" stroke="#ef4444" strokeWidth={1.8} />}
        </svg>
      </div>
    );
  };

  // Elder Impulse Pro Scanner States
  const [elderImpulseUniverse, setElderImpulseUniverse] = useState<'nifty_50' | 'nifty_200' | 'midcap' | 'smallcap'>('nifty_200');
  const [elderImpulseTimeframe, setElderImpulseTimeframe] = useState<'1h' | '4h' | '1d' | '1wk'>('1d');
  const [elderImpulseFilter, setElderImpulseFilter] = useState<'all' | 'bull' | 'bear'>('all');
  const [elderImpulseAdxThreshold, setElderImpulseAdxThreshold] = useState<number>(25.0);
  const [elderImpulseEmaLength, setElderImpulseEmaLength] = useState<number>(13);
  const [elderImpulseStFactor, setElderImpulseStFactor] = useState<number>(3.0);
  const [elderImpulseStAtrLen, setElderImpulseStAtrLen] = useState<number>(10);
  const [elderImpulseResults, setElderImpulseResults] = useState<any[]>([]);
  const [elderImpulseScanning, setElderImpulseScanning] = useState<boolean>(false);
  const [elderImpulseProgress, setElderImpulseProgress] = useState<number>(0);
  const [elderImpulseStatus, setElderImpulseStatus] = useState<string>('Ready');

  // OI Crossover Scanner States
  const [oiCrossoverResults, setOiCrossoverResults] = useState<any[]>([]);
  const [oiCrossoverScanning, setOiCrossoverScanning] = useState<boolean>(false);
  const [oiCrossoverStatusState, setOiCrossoverStatusState] = useState<string>('idle');
  const [oiCrossoverTimestamp, setOiCrossoverTimestamp] = useState<string>('');

  // High Momentum Scanner States
  const [highMomentumDirection, setHighMomentumDirection] = useState<'long' | 'short'>('long');
  const [highMomentumAdxMin, setHighMomentumAdxMin] = useState<number>(20.0);
  const [highMomentumMcapFloor, setHighMomentumMcapFloor] = useState<number>(20000.0);
  const [highMomentumCandidates, setHighMomentumCandidates] = useState<any[]>([]);
  const [highMomentumScanning, setHighMomentumScanning] = useState<boolean>(false);
  const [highMomentumProgress, setHighMomentumProgress] = useState<number>(0);
  const [highMomentumStatus, setHighMomentumStatus] = useState<string>('Ready');

  // Scanner States
  const [scannerUniverse, setScannerUniverse] = useState<'nifty_fo' | 'nifty_500'>('nifty_fo');
  const [scanRsiLen, setScanRsiLen] = useState<number>(14);
  const [scanUseVwap, setScanUseVwap] = useState<boolean>(true);
  const [scanVwapSmoothing, setScanVwapSmoothing] = useState<number>(20);
  const [scanVwapAnchor, setScanVwapAnchor] = useState<string>('year');
  const [scanMaLen, setScanMaLen] = useState<number>(50);
  const [scanVolMaLen, setScanVolMaLen] = useState<number>(20);
  const [scanMinVolMultiplier, setScanMinVolMultiplier] = useState<number>(1.5);
  const [scanAtrLen, setScanAtrLen] = useState<number>(14);

  const [scanStatus, setScanStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanTotal, setScanTotal] = useState<number>(0);
  const [scanCurrentSymbol, setScanCurrentSymbol] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanFilter, setScanFilter] = useState<string>('');
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  // N-Day High Scanner States
  const [ndayUniverse, setNdayUniverse] = useState<'nifty_fo' | 'nifty_500'>('nifty_fo');
  const [ndayLookbacks, setNdayLookbacks] = useState<number[]>([520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600]);
  const [ndayStatus, setNdayStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [ndayProgress, setNdayProgress] = useState<number>(0);
  const [ndayTotal, setNdayTotal] = useState<number>(0);
  const [ndayCurrentBatch, setNdayCurrentBatch] = useState<string>('');
  const [ndayError, setNdayError] = useState<string | null>(null);
  const [ndayResults, setNdayResults] = useState<NdayResult[]>([]);
  const [ndayFilter, setNdayFilter] = useState<string>('');
  const [ndayMinYears, setNdayMinYears] = useState<number>(2);
  const [ndayPollingInterval, setNdayPollingInterval] = useState<number | null>(null);

  // Top 10 OI Change States
  const [oiSpurts, setOiSpurts] = useState<OiSpurtItem[]>([]);
  const [oiLoading, setOiLoading] = useState<boolean>(false);
  const [oiError, setOiError] = useState<string | null>(null);
  const [oiSortBy, setOiSortBy] = useState<'percent' | 'absolute'>('percent');
  const [oiTimestamp, setOiTimestamp] = useState<string>('');
  const [oiIsMock, setOiIsMock] = useState<boolean>(false);

  // Change in Open Interest (Contracts) States
  const [changeInOiData, setChangeInOiData] = useState<ChangeInOiResponse | null>(null);
  const [changeInOiLoading, setChangeInOiLoading] = useState<boolean>(false);
  const [changeInOiError, setChangeInOiError] = useState<string | null>(null);
  const [changeInOiFilter, setChangeInOiFilter] = useState<string>('');
  const [changeInOiSegment, setChangeInOiSegment] = useState<'all' | 'stocks' | 'indices'>('all');

  // Futures Buildup States
  const [futuresData, setFuturesData] = useState<FuturesBuildupResponse | null>(null);
  const [futuresLoading, setFuturesLoading] = useState<boolean>(false);
  const [futuresError, setFuturesError] = useState<string | null>(null);
  const [futuresFilter, setFuturesFilter] = useState<string>('');
  const [futuresSegment, setFuturesSegment] = useState<'all' | 'stocks' | 'indices'>('all');

  // OI Bar Graph Dashboard States
  const [oiGraphMode, setOiGraphMode] = useState<'total' | 'change'>('total');
  const [oiGraphRange, setOiGraphRange] = useState<number>(10);
  const [oiGraphHoveredStrike, setOiGraphHoveredStrike] = useState<number | null>(null);

  // Straddle Chart States
  const [straddleSymbol, setStraddleSymbol] = useState<string>('NIFTY');
  const [straddleExpiry, setStraddleExpiry] = useState<string>('');
  const [straddleStrike, setStraddleStrike] = useState<number | null>(null);
  const [straddleAutoAtm, setStraddleAutoAtm] = useState<boolean>(true);
  const [straddleTimeframe, setStraddleTimeframe] = useState<number>(5);
  const [straddleData, setStraddleData] = useState<any | null>(null);
  const [straddleLoading, setStraddleLoading] = useState<boolean>(false);
  const [straddleError, setStraddleError] = useState<string | null>(null);
  const [straddlePollingId, setStraddlePollingId] = useState<any>(null);
  
  // New visual toggles for the straddle dashboard
  const [showSpotPrice, setShowSpotPrice] = useState<boolean>(true);
  const [showStraddlePrice, setShowStraddlePrice] = useState<boolean>(true);
  const [showCePrice, setShowCePrice] = useState<boolean>(false);
  const [showPePrice, setShowPePrice] = useState<boolean>(false);
  
  // Dashboard specific states
  const [watchlistData, setWatchlistData] = useState<any[]>([]);


  const startScan = async () => {
    setScanStatus('running');
    setScanProgress(0);
    setScanTotal(0);
    setScanCurrentSymbol('Initializing...');
    setScanError(null);
    setScanResults([]);

    try {
      const res = await fetch('/api/scanner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe: scannerUniverse,
          rsi_len: scanRsiLen,
          use_vwap_adjusted_rsi: scanUseVwap,
          vwap_smoothing: scanVwapSmoothing,
          vwap_anchor: scanVwapAnchor,
          ma_len: scanMaLen,
          vol_ma_len: scanVolMaLen,
          min_vol_multiplier: scanMinVolMultiplier,
          atr_len: scanAtrLen
        })
      });

      const data = await res.json();
      if (data.status === 'completed') {
        setScanStatus('completed');
        setScanProgress(100);
        setScanTotal(100);
        setScanCurrentSymbol('');
        fetchScanResults();
      } else {
        const intervalId = window.setInterval(pollScanStatus, 800);
        setPollingInterval(intervalId);
      }
    } catch (err: any) {
      setScanStatus('failed');
      setScanError(err.message || 'Failed to start scan.');
    }
  };

  const pollScanStatus = async () => {
    try {
      const res = await fetch('/api/scanner/status');
      const data = await res.json();
      
      setScanStatus(data.status);
      setScanProgress(data.progress);
      setScanTotal(data.total);
      setScanCurrentSymbol(data.current_symbol || '');
      setScanError(data.error);

      if (data.status === 'completed') {
        clearPolling();
        fetchScanResults();
      } else if (data.status === 'failed') {
        clearPolling();
      }
    } catch (err: any) {
      clearPolling();
      setScanStatus('failed');
      setScanError(err.message || 'Error checking scan status.');
    }
  };

  const fetchScanResults = async () => {
    try {
      const res = await fetch('/api/scanner/results');
      const data = await res.json();
      setScanResults(data);
    } catch (err: any) {
      setScanError(err.message || 'Failed to load results.');
    }
  };

  const clearPolling = () => {
    if (pollingInterval) {
      window.clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  // Clear polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) window.clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  // ── N-Day High Scanner API functions ────────────────────────────────────
  const toggleNdayLookback = (n: number) => {
    setNdayLookbacks(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b)
    );
  };

  const fetchNdayResults = async () => {
    try {
      const res = await fetch('/api/breakout/results');
      const data = await res.json();
      setNdayResults(data);
    } catch (err: any) {
      setNdayError(err.message || 'Failed to load breakout results.');
    }
  };

  const clearNdayPolling = () => {
    if (ndayPollingInterval) {
      window.clearInterval(ndayPollingInterval);
      setNdayPollingInterval(null);
    }
  };

  const pollNdayStatus = async () => {
    try {
      const res = await fetch('/api/breakout/status');
      const data = await res.json();
      setNdayStatus(data.status);
      setNdayProgress(data.progress);
      setNdayTotal(data.total);
      setNdayCurrentBatch(data.current_batch || '');
      setNdayError(data.error);
      if (data.status === 'completed') {
        clearNdayPolling();
        fetchNdayResults();
      } else if (data.status === 'failed') {
        clearNdayPolling();
      }
    } catch (err: any) {
      clearNdayPolling();
      setNdayStatus('failed');
      setNdayError(err.message || 'Error checking breakout scan status.');
    }
  };

  const startNdayScan = async () => {
    setNdayStatus('running');
    setNdayProgress(0);
    setNdayTotal(0);
    setNdayCurrentBatch('Initializing...');
    setNdayError(null);
    setNdayResults([]);
    try {
      const res = await fetch('/api/breakout/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe: ndayUniverse, lookbacks: ndayLookbacks })
      });
      const data = await res.json();
      if (data.status === 'completed') {
        setNdayStatus('completed');
        setNdayProgress(100);
        setNdayTotal(100);
        setNdayCurrentBatch('');
        fetchNdayResults();
      } else {
        const intervalId = window.setInterval(pollNdayStatus, 1200);
        setNdayPollingInterval(intervalId);
      }
    } catch (err: any) {
      setNdayStatus('failed');
      setNdayError(err.message || 'Failed to start breakout scan.');
    }
  };

  useEffect(() => {
    return () => { if (ndayPollingInterval) window.clearInterval(ndayPollingInterval); };
  }, [ndayPollingInterval]);

  // ── Top 10 OI Change API functions ──────────────────────────────────────
  const fetchOiSpurts = async () => {
    setOiLoading(true);
    setOiError(null);
    try {
      const res = await fetch('/api/nse/oi-spurts');
      if (!res.ok) throw new Error(`Status ${res.status}: Failed to pull OI spurts`);
      const payload = await res.json();
      setOiSpurts(payload.data || []);
      setOiTimestamp(payload.timestamp || '');
      setOiIsMock(payload.is_mock || false);
    } catch (err: any) {
      setOiError(err.message || 'Failed to fetch OI spurts from backend.');
    } finally {
      setOiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'oi_spurts') {
      fetchOiSpurts();
    }
  }, [activeTab]);

  // ── Change in OI API functions ──────────────────────────────────────────
  const fetchChangeInOi = async () => {
    setChangeInOiLoading(true);
    setChangeInOiError(null);
    try {
      const res = await fetch('/api/nse/change-in-oi');
      if (!res.ok) throw new Error(`Status ${res.status}: Failed to pull Change in OI data`);
      const payload = await res.json();
      setChangeInOiData(payload);
    } catch (err: any) {
      setChangeInOiError(err.message || 'Failed to fetch Change in OI from backend.');
    } finally {
      setChangeInOiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'change_in_oi') {
      fetchChangeInOi();
    }
  }, [activeTab]);

  // ── Futures Buildup API functions ──────────────────────────────────────────
  const fetchFuturesBuildup = async () => {
    setFuturesLoading(true);
    setFuturesError(null);
    try {
      const res = await fetch('/api/nse/futures-buildup');
      if (!res.ok) throw new Error(`Status ${res.status}: Failed to pull Futures Buildup data`);
      const payload = await res.json();
      setFuturesData(payload);
    } catch (err: any) {
      setFuturesError(err.message || 'Failed to fetch Futures Buildup from backend.');
    } finally {
      setFuturesLoading(false);
    }
  };

  // ── Straddle Chart API functions ──────────────────────────────────────────
  const fetchWatchlistData = async () => {
    try {
      const res = await fetch('/api/nse/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlistData(data);
      }
    } catch (err) {
      console.error("Failed to fetch watchlist", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'straddle_chart') {
      fetchWatchlistData();
      const interval = setInterval(fetchWatchlistData, 60000); // 1 minute
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchStraddleData = async (sym = straddleSymbol, exp = straddleExpiry, strike = straddleStrike, tf = straddleTimeframe, showLoading = true) => {
    if (showLoading) setStraddleLoading(true);
    setStraddleError(null);
    try {
      let url = `/api/nse/straddle-chart?symbol=${sym}&timeframe=${tf}`;
      if (exp) url += `&expiry=${exp}`;
      if (strike !== null && !straddleAutoAtm) url += `&strike=${strike}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to pull Straddle Chart data');
      }
      const data = await res.json();
      setStraddleData(data);
      if (!straddleExpiry && data.expiry) {
        setStraddleExpiry(data.expiry);
      }
      if (straddleAutoAtm && data.strike) {
        setStraddleStrike(data.strike);
      }
    } catch (err: any) {
      setStraddleError(err.message || 'Failed to fetch Straddle data from backend.');
    } finally {
      if (showLoading) setStraddleLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'straddle_chart') {
      fetchStraddleData(straddleSymbol, straddleExpiry, straddleStrike, straddleTimeframe, true);
      
      const intervalId = window.setInterval(() => {
        fetchStraddleData(straddleSymbol, straddleExpiry, straddleStrike, straddleTimeframe, false);
      }, 30000); // 30s auto-refresh
      
      setStraddlePollingId(intervalId);
      
      return () => {
        window.clearInterval(intervalId);
        setStraddlePollingId(null);
      };
    }
  }, [activeTab, straddleSymbol, straddleExpiry, straddleStrike, straddleAutoAtm, straddleTimeframe]);

  const fetchHighMomentumResults = async () => {
    try {
      const res = await fetch('/api/high-momentum/results');
      if (res.ok) {
        const data = await res.json();
        setHighMomentumCandidates(data);
      }
    } catch (err) {
      console.error('Failed to fetch high momentum results:', err);
    }
  };

  const pollOiCrossoverScan = () => {
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch('/api/oi-crossover/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setOiCrossoverStatusState(statusData.status);
          setOiCrossoverTimestamp(statusData.timestamp);
          
          if (statusData.status === 'completed') {
            clearInterval(interval);
            setOiCrossoverScanning(false);
            const resultsRes = await fetch('/api/oi-crossover/results');
            if (resultsRes.ok) {
              const resultsData = await resultsRes.json();
              setOiCrossoverResults(resultsData);
            }
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setOiCrossoverScanning(false);
          }
        }
      } catch (e) {
        clearInterval(interval);
        setOiCrossoverScanning(false);
        setOiCrossoverStatusState('failed');
      }
    }, 1500);
  };

  const runOiCrossoverScan = async () => {
    if (oiCrossoverScanning) return;
    setOiCrossoverScanning(true);
    setOiCrossoverStatusState('scanning');
    try {
      const res = await fetch('/api/oi-crossover/run', { method: 'POST' });
      if (res.ok) {
        pollOiCrossoverScan();
      } else {
        setOiCrossoverScanning(false);
        setOiCrossoverStatusState('failed');
      }
    } catch (err) {
      console.error(err);
      setOiCrossoverScanning(false);
      setOiCrossoverStatusState('failed');
    }
  };

  useEffect(() => {
    if (activeTab === 'oi_crossover_scanner') {
      const checkStatus = async () => {
        try {
          const statusRes = await fetch('/api/oi-crossover/status');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setOiCrossoverStatusState(statusData.status);
            setOiCrossoverTimestamp(statusData.timestamp);
            if (statusData.status === 'completed') {
              const resultsRes = await fetch('/api/oi-crossover/results');
              if (resultsRes.ok) {
                const resultsData = await resultsRes.json();
                setOiCrossoverResults(resultsData);
              }
            } else if (statusData.status === 'scanning') {
              setOiCrossoverScanning(true);
              pollOiCrossoverScan();
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      checkStatus();
    }
  }, [activeTab]);

  const runHighMomentumScan = async () => {
    setHighMomentumScanning(true);
    setHighMomentumProgress(0);
    setHighMomentumStatus('Initiating scanner...');
    try {
      const res = await fetch('/api/high-momentum/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: highMomentumDirection,
          adx_min: highMomentumAdxMin,
          mcap_floor: highMomentumMcapFloor
        })
      });
      if (res.ok) {
        // Poll status
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/high-momentum/status');
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setHighMomentumProgress(statusData.progress_pct);
              setHighMomentumStatus(statusData.status_message);

              if (!statusData.is_scanning) {
                clearInterval(interval);
                setHighMomentumScanning(false);
                fetchHighMomentumResults();
              }
            }
          } catch (e) {
            clearInterval(interval);
            setHighMomentumScanning(false);
          }
        }, 1000);
      } else {
        setHighMomentumScanning(false);
      }
    } catch (err) {
      console.error('Failed to start high momentum scan:', err);
      setHighMomentumScanning(false);
    }
  };

  const fetchElderImpulseResults = async () => {
    try {
      const res = await fetch('/api/elder-impulse/results');
      if (res.ok) {
        const data = await res.json();
        setElderImpulseResults(data);
      }
    } catch (err) {
      console.error('Failed to fetch Elder Impulse results:', err);
    }
  };

  const runElderImpulseScan = async () => {
    setElderImpulseScanning(true);
    setElderImpulseProgress(0);
    setElderImpulseStatus('Initiating Elder Impulse Pro scan...');
    try {
      const res = await fetch('/api/elder-impulse/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe: elderImpulseUniverse,
          timeframe: elderImpulseTimeframe,
          adx_threshold: elderImpulseAdxThreshold,
          ema_length: elderImpulseEmaLength,
          st_factor: elderImpulseStFactor,
          st_atr_len: elderImpulseStAtrLen
        })
      });
      if (res.ok) {
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/elder-impulse/status');
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setElderImpulseProgress(statusData.progress_pct);
              setElderImpulseStatus(statusData.status_message);

              if (!statusData.is_scanning) {
                clearInterval(interval);
                setElderImpulseScanning(false);
                fetchElderImpulseResults();
              }
            }
          } catch (e) {
            clearInterval(interval);
            setElderImpulseScanning(false);
          }
        }, 1000);
      } else {
        setElderImpulseScanning(false);
      }
    } catch (err) {
      console.error('Failed to start Elder Impulse scan:', err);
      setElderImpulseScanning(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'elder_impulse') {
      fetchElderImpulseResults();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'high_momentum') {
      fetchHighMomentumResults();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'futures_buildup') {
      fetchFuturesBuildup();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'vcp') {
      fetchVcpResults();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'backtest_lab') {
      fetchBacktestSummary();
    }
  }, [activeTab]);




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
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem', padding: '0.6rem 2rem 0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={24} style={{ color: '#60a5fa' }} />
            Elite Option Strategy Builder
          </h1>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Symbol Selector Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem', fontWeight: 600 }}>Underlying Asset</span>
              <select
                value={symbol}
                onChange={(e) => {
                  const newSym = e.target.value;
                  setSymbol(newSym);
                  setSelectedExpiry('');
                  fetchOptionChain(newSym, '');
                }}
                style={{ width: '180px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
              >
                {AVAILABLE_SYMBOLS.map(sym => (
                  <option key={sym.value} value={sym.value}>{sym.label}</option>
                ))}
              </select>
            </div>

            {/* Expiry Selector Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem', fontWeight: 600 }}>Expiry Date</span>
              <select
                value={selectedExpiry}
                onChange={(e) => {
                  const newExp = e.target.value;
                  setSelectedExpiry(newExp);
                  fetchOptionChain(symbol, newExp);
                }}
                disabled={!optionChain || optionChain.expiry_dates.length === 0}
                style={{ width: '210px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
              >
                {!optionChain ? (
                  <option value="">No expiries loaded</option>
                ) : (
                  optionChain.expiry_dates.slice(0, 3).map((date, index) => {
                    let label = '';
                    if (index === 0) label = `Current (${date})`;
                    else if (index === 1) label = `Next (${date})`;
                    else label = `Far (${date})`;
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
              style={{ height: '31px', padding: '0 0.75rem', marginTop: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              title="Refresh F&O chain"
            >
              {chainLoading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Sub-header Tab Strip - 2 Rows for 100% Visibility */}
      <div 
        className="tab-strip"
        style={{
          position: 'sticky',
          top: '57px',
          zIndex: 99,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        {/* Row 1: Options & OI Analytics */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={() => setActiveTab('workbench')}
            className={`tab-btn ${activeTab === 'workbench' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'workbench' ? 'var(--color-primary-500)' : undefined
            }}
          >
            💼 Option Workbench
          </button>
          <button 
            onClick={() => setActiveTab('change_in_oi')}
            className={`tab-btn ${activeTab === 'change_in_oi' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'change_in_oi' ? 'linear-gradient(90deg, #2563eb, #3b82f6)' : undefined
            }}
          >
            📊 Change in OI
          </button>
          <button 
            onClick={() => setActiveTab('oi_spurts')}
            className={`tab-btn ${activeTab === 'oi_spurts' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'oi_spurts' ? 'linear-gradient(90deg, #059669, #10b981)' : undefined
            }}
          >
            📊 Top 10 OI Spurts
          </button>
          <button 
            onClick={() => setActiveTab('oi_graph')}
            className={`tab-btn ${activeTab === 'oi_graph' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'oi_graph' ? 'linear-gradient(90deg, #8b5cf6, #ec4899)' : undefined
            }}
          >
            📊 OI Bar Graph
          </button>
          <button 
            onClick={() => setActiveTab('straddle_chart')}
            className={`tab-btn ${activeTab === 'straddle_chart' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'straddle_chart' ? 'linear-gradient(90deg, #14b8a6, #0d9488)' : undefined
            }}
          >
            📈 Straddle Chart
          </button>
          <button 
            onClick={() => setActiveTab('futures_buildup')}
            className={`tab-btn ${activeTab === 'futures_buildup' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'futures_buildup' ? 'linear-gradient(90deg, #f59e0b, #d97706)' : undefined
            }}
          >
            ⚡ Futures Buildup
          </button>
        </div>

        {/* Row 2: Technical & Strategy Scanners */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={() => { setActiveTab('vcp'); fetchVcpResults(); }}
            className={`tab-btn ${activeTab === 'vcp' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'vcp' ? 'linear-gradient(90deg, #10b981, #059669)' : undefined
            }}
          >
            🏆 Minervini VCP
          </button>
          <button 
            onClick={() => setActiveTab('elder_impulse')}
            className={`tab-btn ${activeTab === 'elder_impulse' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'elder_impulse' ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' : undefined
            }}
          >
            ⚡ Elder Impulse
          </button>
          <button 
            onClick={() => setActiveTab('high_momentum')}
            className={`tab-btn ${activeTab === 'high_momentum' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'high_momentum' ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : undefined
            }}
          >
            🔥 High Momentum
          </button>
          <button 
            onClick={() => setActiveTab('breakout')}
            className={`tab-btn ${activeTab === 'breakout' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'breakout' ? 'linear-gradient(90deg, #7c3aed, #6366f1)' : undefined
            }}
          >
            📈 Breakout Scanner
          </button>
          <button 
            onClick={() => setActiveTab('scanner')}
            className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'scanner' ? 'var(--color-primary-500)' : undefined
            }}
          >
            🔍 RSI Scanner
          </button>
          <button 
            onClick={() => setActiveTab('oi_crossover_scanner')}
            className={`tab-btn ${activeTab === 'oi_crossover_scanner' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: activeTab === 'oi_crossover_scanner' ? 'linear-gradient(90deg, #0284c7, #0369a1)' : undefined
            }}
          >
            📊 OI Crossover
          </button>
          <button 
            onClick={() => { setActiveTab('backtest_lab'); fetchBacktestSummary(); }}
            className={`tab-btn ${activeTab === 'backtest_lab' ? 'active' : ''}`}
            style={{
              flex: '1 1 auto',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: activeTab === 'backtest_lab' ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: activeTab === 'backtest_lab' ? '#ffffff' : '#a5b4fc',
              boxShadow: activeTab === 'backtest_lab' ? '0 0 12px rgba(99, 102, 241, 0.5)' : undefined
            }}
          >
            🧪 Backtest Lab
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '1rem', borderRadius: '12px', margin: '1.5rem auto', maxWidth: '1550px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AlertTriangle size={20} />
          <strong>Error: </strong> {error}
        </div>
      )}

      <div className="container">
        {/* SIDEBAR PARAMETERS */}
        {activeTab === 'workbench' && (
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
        )}

        {activeTab === 'scanner' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> Scanner Settings
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>RSI Length</label>
                  <input 
                    type="number" 
                    value={scanRsiLen} 
                    onChange={(e) => setScanRsiLen(parseInt(e.target.value) || 14)} 
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div style={{ margin: '0.3rem 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={scanUseVwap} 
                      onChange={(e) => setScanUseVwap(e.target.checked)} 
                    />
                    Use VWAP Adjusted RSI
                  </label>
                </div>

                {scanUseVwap && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>VWAP Smoothing</label>
                      <input 
                        type="number" 
                        value={scanVwapSmoothing} 
                        onChange={(e) => setScanVwapSmoothing(parseInt(e.target.value) || 20)} 
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>VWAP Anchor</label>
                      <select 
                        value={scanVwapAnchor} 
                        onChange={(e) => setScanVwapAnchor(e.target.value)} 
                        style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
                      >
                        <option value="year">Calendar Year</option>
                        <option value="month">Calendar Month</option>
                        <option value="week">Calendar Week</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>MA Length (SMA)</label>
                  <input 
                    type="number" 
                    value={scanMaLen} 
                    onChange={(e) => setScanMaLen(parseInt(e.target.value) || 50)} 
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Volume MA Length</label>
                  <input 
                    type="number" 
                    value={scanVolMaLen} 
                    onChange={(e) => setScanVolMaLen(parseInt(e.target.value) || 20)} 
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Min Volume Multiplier</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={scanMinVolMultiplier} 
                    onChange={(e) => setScanMinVolMultiplier(parseFloat(e.target.value) || 1.5)} 
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>ATR Length</label>
                  <input 
                    type="number" 
                    value={scanAtrLen} 
                    onChange={(e) => setScanAtrLen(parseInt(e.target.value) || 14)} 
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'breakout' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> Breakout Settings
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                {/* Universe Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Universe</label>
                  <select
                    value={ndayUniverse}
                    onChange={(e) => setNdayUniverse(e.target.value as any)}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
                  >
                    <option value="nifty_fo">NIFTY F&O Universe</option>
                    <option value="nifty_500">NIFTY 500 Universe</option>
                  </select>
                </div>

                {/* Lookback Windows */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem', fontWeight: 600 }}>Breakout Windows</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600].map(n => (
                      <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: ndayLookbacks.includes(n) ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={ndayLookbacks.includes(n)}
                          onChange={() => toggleNdayLookback(n)}
                        />
                        <span style={{ fontFamily: 'monospace', minWidth: '35px' }}>{Math.round(n / 260)}yr</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({n} days)</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Min Strength Filter */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Min Strength Filter: <span style={{ color: 'white' }}>{ndayMinYears}yr+</span>
                  </label>
                  <input
                    type="range"
                    min={2} max={10} step={1}
                    value={ndayMinYears}
                    onChange={(e) => setNdayMinYears(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#7c3aed' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>2yr</span><span>5yr</span><span>10yr</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Legend */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.7rem', fontWeight: 600 }}>STRENGTH LEGEND</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[{ label: '2yr', cls: 'yr2', desc: '~520 days' }, { label: '3yr', cls: 'yr3', desc: '~780 days' }, { label: '5yr', cls: 'yr5', desc: '~1300 days' }, { label: '7yr+', cls: 'yr7plus', desc: '1820+ days' }].map(({ label, cls, desc }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`strength-badge ${cls}`}>{label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'oi_spurts' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> OI Spurts Info
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Open Interest (OI) represents the total number of outstanding derivative contracts. High changes in OI signal institutional positioning.
              </p>
            </div>

            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid #10b981' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>OI INTERPRETATION</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#10b981', display: 'block' }}>📈 Long Buildup (Bullish)</strong>
                  <span style={{ color: 'var(--text-muted)' }}>OI Increases + Price Increases. Fresh buyers entering.</span>
                </div>
                <div>
                  <strong style={{ color: '#ef4444', display: 'block' }}>📉 Short Buildup (Bearish)</strong>
                  <span style={{ color: 'var(--text-muted)' }}>OI Increases + Price Decreases. Aggressive sellers entering.</span>
                </div>
                <div>
                  <strong style={{ color: '#60a5fa', display: 'block' }}>🚀 Short Covering (Bullish)</strong>
                  <span style={{ color: 'var(--text-muted)' }}>OI Decreases + Price Increases. Sellers rushing to exit.</span>
                </div>
                <div>
                  <strong style={{ color: '#fbbf24', display: 'block' }}>⚠️ Long Unwinding (Bearish)</strong>
                  <span style={{ color: 'var(--text-muted)' }}>OI Decreases + Price Decreases. Buyers liquidating.</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'change_in_oi' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> OI Change Filters
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Segment Filter */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Asset Segment</label>
                  <select
                    value={changeInOiSegment}
                    onChange={(e) => setChangeInOiSegment(e.target.value as any)}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
                  >
                    <option value="all">All Derivatives</option>
                    <option value="stocks">Stock Derivatives Only</option>
                    <option value="indices">Index Options/Futures Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid var(--color-primary-500)' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>MOMENTUM CONTEXT</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#10b981', display: 'block' }}>📈 Long Build-up</strong>
                  <span style={{ color: 'var(--text-muted)' }}>OI rises & price rises. Bullish momentum driven by new buyers entering long positions.</span>
                </div>
                <div>
                  <strong style={{ color: '#60a5fa', display: 'block' }}>🚀 Short Covering</strong>
                  <span style={{ color: 'var(--text-muted)' }}>OI falls & price rises. Bullish momentum driven by short sellers closing out their positions.</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'futures_buildup' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> Futures Filters
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Segment Filter */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Futures Segment</label>
                  <select
                    value={futuresSegment}
                    onChange={(e) => setFuturesSegment(e.target.value as any)}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
                  >
                    <option value="all">All Futures (Stocks & Indices)</option>
                    <option value="stocks">Stock Futures Only (FUTSTK)</option>
                    <option value="indices">Index Futures Only (FUTIDX)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid #f59e0b' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>FUTURES BUILDUP DYNAMICS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#10b981', display: 'block' }}>📈 Long Build-up</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Price Rises + OI Rises. Fresh buyers taking long positions in futures contracts.</span>
                </div>
                <div>
                  <strong style={{ color: '#ef4444', display: 'block' }}>📉 Short Build-up</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Price Falls + OI Rises. Short sellers building bearish futures positions.</span>
                </div>
                <div>
                  <strong style={{ color: '#f59e0b', display: 'block' }}>⚠️ Long Unwinding</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Price Falls + OI Falls. Existing longs closing out futures positions.</span>
                </div>
                <div>
                  <strong style={{ color: '#60a5fa', display: 'block' }}>🚀 Short Covering</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Price Rises + OI Falls. Short sellers liquidating futures positions.</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'oi_graph' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Insights Sub-Navigation */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <Sliders size={16} /> Insights Navigation
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={() => setOiGraphMode('total')}
                  style={{
                    background: oiGraphMode === 'total' ? 'linear-gradient(90deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.04)',
                    color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem',
                    textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <span>📊 OI Bar Graph</span>
                  {oiGraphMode === 'total' && <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Active</span>}
                </button>
                <button
                  onClick={() => setOiGraphMode('change')}
                  style={{
                    background: oiGraphMode === 'change' ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'rgba(255,255,255,0.04)',
                    color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem',
                    textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <span>🔄 Change in OI Graph</span>
                  {oiGraphMode === 'change' && <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Active</span>}
                </button>
                <button
                  onClick={() => setActiveTab('change_in_oi')}
                  style={{
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '0.6rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
                  }}
                >
                  ⚡ Options Buildup
                </button>
                <button
                  onClick={() => setActiveTab('futures_buildup')}
                  style={{
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '0.6rem 0.8rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
                  }}
                >
                  📈 Futures Buildup
                </button>
              </div>
            </div>

            {/* Display Controls */}
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> Display Settings
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Strike Range (Around ATM)</label>
                  <select
                    value={oiGraphRange}
                    onChange={(e) => setOiGraphRange(Number(e.target.value))}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
                  >
                    <option value={10}>ATM ± 10 Strikes (Default)</option>
                    <option value={15}>ATM ± 15 Strikes</option>
                    <option value={20}>ATM ± 20 Strikes</option>
                    <option value={999}>All Strikes</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Chart Type</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className={oiGraphMode === 'total' ? 'primary' : 'outline'}
                      onClick={() => setOiGraphMode('total')}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}
                    >
                      Total OI
                    </button>
                    <button
                      className={oiGraphMode === 'change' ? 'primary' : 'outline'}
                      onClick={() => setOiGraphMode('change')}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}
                    >
                      Change in OI
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid #8b5cf6' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>POSITIONING LEGEND</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div>
                  <div>
                    <strong style={{ color: '#10b981' }}>📈 Long Build-up</strong>
                    <div style={{ color: 'var(--text-muted)' }}>OI ↑ Price ↑ (Fresh Buyers)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }}></div>
                  <div>
                    <strong style={{ color: '#ef4444' }}>📉 Short Build-up</strong>
                    <div style={{ color: 'var(--text-muted)' }}>OI ↑ Price ↓ (Fresh Writers)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }}></div>
                  <div>
                    <strong style={{ color: '#f59e0b' }}>⚠️ Long Unwinding</strong>
                    <div style={{ color: 'var(--text-muted)' }}>OI ↓ Price ↓ (Longs Exiting)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#60a5fa' }}></div>
                  <div>
                    <strong style={{ color: '#60a5fa' }}>🚀 Short Covering</strong>
                    <div style={{ color: 'var(--text-muted)' }}>OI ↓ Price ↑ (Shorts Liquidating)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ width: '12px', height: '2px', borderTop: '2px dashed white' }}></div>
                  <div>
                    <strong style={{ color: 'white' }}>ATM Reference Line</strong>
                    <div style={{ color: 'var(--text-muted)' }}>At-The-Money strike</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'high_momentum' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Scan Controls Card */}
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> Momentum Filters
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Direction */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Trading Direction</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className={highMomentumDirection === 'long' ? 'primary' : 'outline'}
                      onClick={() => setHighMomentumDirection('long')}
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      📈 Long (Bullish)
                    </button>
                    <button
                      className={highMomentumDirection === 'short' ? 'primary' : 'outline'}
                      onClick={() => setHighMomentumDirection('short')}
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', fontWeight: 700, background: highMomentumDirection === 'short' ? 'linear-gradient(90deg, #ef4444, #b91c1c)' : '' }}
                    >
                      📉 Short (Bearish)
                    </button>
                  </div>
                </div>

                {/* ADX Min Slider */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    <span>Min Trend Strength (ADX)</span>
                    <strong style={{ color: '#f59e0b' }}>≥ {highMomentumAdxMin}</strong>
                  </label>
                  <input
                    type="range"
                    min={15} max={35} step={1}
                    value={highMomentumAdxMin}
                    onChange={(e) => setHighMomentumAdxMin(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#f59e0b' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>15 (Moderate)</span>
                    <span>20 (Dhan Standard)</span>
                    <span>35 (Extreme)</span>
                  </div>
                </div>

                {/* Market Cap Floor */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Market Cap Floor</label>
                  <select
                    value={highMomentumMcapFloor}
                    onChange={(e) => setHighMomentumMcapFloor(Number(e.target.value))}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem' }}
                  >
                    <option value={20000}>≥ ₹20,000 Cr (Large Cap Floor)</option>
                    <option value={50000}>≥ ₹50,000 Cr (Mega Cap Floor)</option>
                    <option value={5000}>≥ ₹5,000 Cr (Mid Cap Floor)</option>
                    <option value={0}>All Market Caps (No Floor)</option>
                  </select>
                </div>

                {/* Run Trigger */}
                <button
                  className="primary"
                  onClick={runHighMomentumScan}
                  disabled={highMomentumScanning}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(90deg, #ef4444, #f59e0b)' }}
                >
                  {highMomentumScanning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                  {highMomentumScanning ? `Scanning (${highMomentumProgress}%)...` : 'Run Momentum Scan'}
                </button>
              </div>
            </div>

            {/* 3-Step Strategy Rules Legend */}
            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid #ef4444' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>3-STEP CHECKLIST RULES</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#60a5fa', display: 'block' }}>1. Trend Alignment</strong>
                  <span style={{ color: 'var(--text-muted)' }}>20 EMA &gt; 50 EMA &gt; 200 EMA &amp; Close &gt; 20 EMA (Longs).</span>
                </div>
                <div>
                  <strong style={{ color: '#f59e0b', display: 'block' }}>2. Trend Strength</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Wilder's ADX(14) ≥ 20 (Strong directional momentum).</span>
                </div>
                <div>
                  <strong style={{ color: '#10b981', display: 'block' }}>3. Relative Strength (CRS)</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Stock/Nifty 50 ratio line above its 100-period EMA (outperforming index).</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'elder_impulse' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Scan Controls Card */}
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> Confluence Settings
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Stock Universe Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Stock Universe</label>
                  <select
                    value={elderImpulseUniverse}
                    onChange={(e) => setElderImpulseUniverse(e.target.value as any)}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    <option value="nifty_50">Nifty 50 (Bluechips)</option>
                    <option value="nifty_200">Nifty 200 (Liquid F&amp;O)</option>
                    <option value="midcap">Midcap (Growth Stocks)</option>
                    <option value="smallcap">Smallcap (High Beta)</option>
                  </select>
                </div>

                {/* Timeframe Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Chart Timeframe</label>
                  <select
                    value={elderImpulseTimeframe}
                    onChange={(e) => setElderImpulseTimeframe(e.target.value as any)}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    <option value="1h">1 Hour (Intraday)</option>
                    <option value="4h">4 Hours (Swing)</option>
                    <option value="1d">1 Day (Daily)</option>
                    <option value="1wk">1 Week (Positional)</option>
                  </select>
                </div>

                {/* Confluence Filter */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Filter Signal</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className={elderImpulseFilter === 'all' ? 'primary' : 'outline'}
                      onClick={() => setElderImpulseFilter('all')}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      All Matches
                    </button>
                    <button
                      className={elderImpulseFilter === 'bull' ? 'primary' : 'outline'}
                      onClick={() => setElderImpulseFilter('bull')}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 700, background: elderImpulseFilter === 'bull' ? 'linear-gradient(90deg, #10b981, #059669)' : '' }}
                    >
                      🟢 Bullish
                    </button>
                    <button
                      className={elderImpulseFilter === 'bear' ? 'primary' : 'outline'}
                      onClick={() => setElderImpulseFilter('bear')}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 700, background: elderImpulseFilter === 'bear' ? 'linear-gradient(90deg, #ef4444, #b91c1c)' : '' }}
                    >
                      🔴 Bearish
                    </button>
                  </div>
                </div>

                {/* ADX Threshold Slider */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    <span>ADX Trend Threshold</span>
                    <strong style={{ color: '#3b82f6' }}>≥ {elderImpulseAdxThreshold}</strong>
                  </label>
                  <input
                    type="range"
                    min={15} max={35} step={1}
                    value={elderImpulseAdxThreshold}
                    onChange={(e) => setElderImpulseAdxThreshold(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#3b82f6' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>15 (Moderate)</span>
                    <span>25 (Standard)</span>
                    <span>35 (Strong)</span>
                  </div>
                </div>

                {/* Supertrend Settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>ST Factor</label>
                    <input
                      type="number" step="0.5"
                      value={elderImpulseStFactor}
                      onChange={(e) => setElderImpulseStFactor(Number(e.target.value))}
                      style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.4rem', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>ST ATR Period</label>
                    <input
                      type="number"
                      value={elderImpulseStAtrLen}
                      onChange={(e) => setElderImpulseStAtrLen(Number(e.target.value))}
                      style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.4rem', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {/* Run Trigger */}
                <button
                  className="primary"
                  onClick={runElderImpulseScan}
                  disabled={elderImpulseScanning}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
                >
                  {elderImpulseScanning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                  {elderImpulseScanning ? `Scanning (${elderImpulseProgress}%)...` : 'Run Elder Impulse Scan'}
                </button>
              </div>
            </div>

            {/* Indicator Confluence Card */}
            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid #3b82f6' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>CONFLUENCE PILLARS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#60a5fa', display: 'block' }}>1. Elder Impulse System</strong>
                  <span style={{ color: 'var(--text-muted)' }}>EMA(13) rising &amp; MACD Hist rising (Bulls) / both falling (Bears).</span>
                </div>
                <div>
                  <strong style={{ color: '#10b981', display: 'block' }}>2. Supertrend Alignment</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Price trading above Supertrend line (Up) or below (Down).</span>
                </div>
                <div>
                  <strong style={{ color: '#f59e0b', display: 'block' }}>3. ADX &amp; DMI Filter</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Wilder's ADX &gt; {elderImpulseAdxThreshold} with DI+ &gt; DI- (Bulls) or DI+ &lt; DI- (Bears).</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {activeTab === 'vcp' && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Scan Controls Card */}
            <div className="card">
              <h3 className="card-title">
                <Sliders size={18} /> VCP Model Parameters
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Stock Universe Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Stock Universe</label>
                  <select
                    value={vcpUniverse}
                    onChange={(e) => setVcpUniverse(e.target.value as any)}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    <option value="nifty_50">Nifty 50 (Bluechips)</option>
                    <option value="nifty_200">Nifty 200 (Liquid F&amp;O)</option>
                    <option value="midcap">Midcap (Growth Stocks)</option>
                    <option value="smallcap">Smallcap (High Beta)</option>
                  </select>
                </div>

                {/* Pivot Strength */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    <span>Pivot Strength (Bars)</span>
                    <strong style={{ color: '#10b981' }}>{vcpPivotStrength} left / {vcpPivotStrength} right</strong>
                  </label>
                  <input
                    type="range"
                    min={2} max={10} step={1}
                    value={vcpPivotStrength}
                    onChange={(e) => setVcpPivotStrength(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#10b981' }}
                  />
                </div>

                {/* Min Contractions */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Min VCP Contractions</label>
                  <select
                    value={vcpMinContractions}
                    onChange={(e) => setVcpMinContractions(Number(e.target.value))}
                    style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    <option value={2}>2 Contractions (T1 → T2)</option>
                    <option value={3}>3 Contractions (T1 → T2 → T3)</option>
                    <option value={4}>4 Contractions (T1 → T2 → T3 → T4)</option>
                  </select>
                </div>

                {/* Market Context Filter Toggle */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={vcpUseMarketFilter}
                      onChange={(e) => setVcpUseMarketFilter(e.target.checked)}
                    />
                    Market Filter (Nifty &gt; Monthly 10 EMA)
                  </label>
                </div>

                {/* Run Trigger */}
                <button
                  className="primary"
                  onClick={runVcpScan}
                  disabled={vcpScanning}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(90deg, #10b981, #059669)' }}
                >
                  {vcpScanning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                  {vcpScanning ? `Scanning (${vcpProgress}%)...` : 'Run Minervini VCP Scan'}
                </button>
              </div>
            </div>

            {/* Strategy Rules Legend Card */}
            <div className="card" style={{ padding: '1.2rem', borderLeft: '3px solid #10b981' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.6rem', fontWeight: 600 }}>STAGE 2 VCP RULES</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#10b981', display: 'block' }}>1. Stage 2 Trend Template</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Price &gt; 150/200 SMA, 150 &gt; 200 SMA, 200 SMA trending up for 100 days, 50 SMA &gt; 150/200 SMA, price $\ge 25\%$ above 52w low, RS Rating &gt; 70.</span>
                </div>
                <div>
                  <strong style={{ color: '#3b82f6', display: 'block' }}>2. Volatility Contraction Pattern (VCP)</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Successive price contractions tighten ($\le 90\%$ of prior) with volume drying up.</span>
                </div>
                <div>
                  <strong style={{ color: '#fbbf24', display: 'block' }}>3. Trigger Bar &amp; Pivot Breakout</strong>
                  <span style={{ color: 'var(--text-muted)' }}>Narrow range + low volume bar near 10 EMA followed by 1.5x volume breakout.</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        

        {/* MAIN PANEL */}
        {activeTab === 'workbench' && (
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
                  const conviction = getConvictionLabel((topBuy as any).score || 80);
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
                  const conviction = getConvictionLabel((topSell as any).score || 80);
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
      )}

      {activeTab === 'scanner' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.2rem' }}>Cardwell RSI Multi-Bagger Scanner</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Scan for high-conviction momentum setups using Wilder's RSI breakout (40 cross) and Volume Confirmation.</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select
                value={scannerUniverse}
                onChange={(e) => setScannerUniverse(e.target.value as any)}
                style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                <option value="nifty_fo">NIFTY F&O Universe</option>
                <option value="nifty_500">NIFTY 500 Universe</option>
              </select>

              <button 
                className="primary" 
                onClick={startScan} 
                disabled={scanStatus === 'running'}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.2rem' }}
              >
                {scanStatus === 'running' ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Run Scanner
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Scan Progress Section */}
          {scanStatus === 'running' && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary-500)' }}>
                  Scanning Universe: {scannerUniverse === 'nifty_fo' ? 'Nifty F&O' : 'Nifty 500'}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {scanProgress} / {scanTotal} stocks ({scanTotal > 0 ? Math.round((scanProgress / scanTotal) * 100) : 0}%)
                </span>
              </div>
              <div className="progress-bar-container" style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                <div 
                  className="progress-bar-filler" 
                  style={{ 
                    width: `${scanTotal > 0 ? (scanProgress / scanTotal) * 100 : 0}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-purple))', 
                    transition: 'width 0.2s ease-out' 
                  }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw className="animate-spin" size={12} />
                <span>Fetching and calculating: <strong style={{ color: 'white' }}>{scanCurrentSymbol}</strong></span>
              </div>
            </div>
          )}

          {scanError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <strong>Scan Error: </strong> {scanError}
            </div>
          )}

          {/* Results Table Section */}
          {scanStatus === 'completed' && scanResults.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Scan Results ({scanResults.filter(r => r.signal !== 'NEUTRAL').length} Signals)</h3>
                
                <input
                  type="text"
                  placeholder="Search by symbol, name, or industry..."
                  value={scanFilter}
                  onChange={(e) => setScanFilter(e.target.value)}
                  style={{ width: '300px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                />
              </div>

              <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                <table className="option-chain-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Company Name</th>
                      <th>Industry</th>
                      <th style={{ textAlign: 'right' }}>Close</th>
                      <th style={{ textAlign: 'right' }}>Change %</th>
                      <th style={{ textAlign: 'center' }}>RSI</th>
                      <th style={{ textAlign: 'center' }}>Vol Mult</th>
                      <th style={{ textAlign: 'center' }}>MA Filter</th>
                      <th style={{ textAlign: 'center' }}>Signal</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = scanResults.filter(row => {
                        const query = scanFilter.toLowerCase();
                        return row.symbol.toLowerCase().includes(query) ||
                               row.name.toLowerCase().includes(query) ||
                               row.industry.toLowerCase().includes(query);
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No stocks match the filter query.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((row) => (
                        <tr key={row.symbol} style={row.signal === 'BUY' ? { background: 'rgba(16, 185, 129, 0.03)' } : row.signal === 'SETUP' ? { background: 'rgba(59, 130, 246, 0.03)' } : {}}>
                          <td>
                            <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                          </td>
                          <td style={{ fontSize: '0.85rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.industry}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {row.close.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: row.change_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                            {row.change_pct >= 0 ? '+' : ''}{row.change_pct}%
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: row.rsi >= 70 ? '#fbbf24' : row.rsi <= 30 ? '#60a5fa' : 'white' }}>{row.rsi}</td>
                          <td style={{ textAlign: 'center', color: row.vol_mult >= scanMinVolMultiplier ? '#10b981' : 'var(--text-muted)' }}>
                            {row.vol_mult}x
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.above_ma ? (
                              <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>Price &gt; MA</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Price &lt; MA</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.signal === 'BUY' ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                BUY
                              </span>
                            ) : row.signal === 'SETUP' ? (
                              <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                SETUP
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>NEUTRAL</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="outline"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setSymbol(row.symbol);
                                setSelectedExpiry('');
                                setActiveTab('workbench');
                                fetchOptionChain(row.symbol, '');
                              }}
                            >
                              Analyze Options
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {scanStatus === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed var(--border-color)', background: 'transparent' }}>
              <Search size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Scan Data Available</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                Select your universe and settings in the sidebar, then click "Run Scanner" to fetch historical data and scan for momentum signals.
              </p>
              <button className="primary" onClick={startScan} style={{ padding: '0.5rem 1.5rem' }}>
                Run Initial Scan
              </button>
            </div>
          )}
        </main>
      )}

      {activeTab === 'breakout' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Header Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #7c3aed' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.2rem', background: 'linear-gradient(90deg, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                📈 Multi-Year Breakout Scanner
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ChartInk-style N-Day High scan — flags stocks where today's HIGH equals the all-time high over the last 2yr to 10yr.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                <div>{ndayLookbacks.length} windows active</div>
                <div>Showing {ndayMinYears}yr+ highs</div>
              </div>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.2rem',
                  background: ndayStatus === 'running' ? 'rgba(124,58,237,0.4)' : 'linear-gradient(90deg,#7c3aed,#6366f1)',
                  color: 'white', border: 'none', borderRadius: '8px', cursor: ndayStatus === 'running' ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.9rem', transition: 'opacity 0.2s'
                }}
                onClick={startNdayScan}
                disabled={ndayStatus === 'running'}
              >
                {ndayStatus === 'running' ? (
                  <><RefreshCw className="animate-spin" size={16} /> Scanning...</>
                ) : (
                  <><Search size={16} /> Run Breakout Scan</>
                )}
              </button>
            </div>
          </div>

          {/* Progress Card */}
          {ndayStatus === 'running' && (
            <div className="card" style={{ padding: '1.5rem', borderLeft: '3px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600, color: '#a78bfa' }}>
                  Scanning: {ndayUniverse === 'nifty_fo' ? 'Nifty F&O' : 'Nifty 500'} — Downloading 12yr OHLC data
                </span>
                <span style={{ fontWeight: 600 }}>
                  Batch {ndayProgress} / {ndayTotal} ({ndayTotal > 0 ? Math.round((ndayProgress / ndayTotal) * 100) : 0}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                <div style={{
                  width: `${ndayTotal > 0 ? (ndayProgress / ndayTotal) * 100 : 0}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed, #6366f1, #a78bfa)',
                  transition: 'width 0.3s ease-out',
                  borderRadius: '5px'
                }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw className="animate-spin" size={12} />
                <span>Processing batch: <strong style={{ color: 'white', fontFamily: 'monospace' }}>{ndayCurrentBatch}</strong></span>
                <span style={{ marginLeft: 'auto', color: '#a78bfa', fontSize: '0.75rem' }}>⚡ This may take 1–3 minutes for large universes</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {ndayError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <strong>Scan Error: </strong> {ndayError}
            </div>
          )}

          {/* Results Table */}
          {ndayStatus === 'completed' && ndayResults.length > 0 && (() => {
            const getStrengthCls = (yrs: number) => {
              if (yrs >= 7) return 'yr7plus';
              if (yrs >= 5) return 'yr5';
              if (yrs >= 3) return 'yr3';
              return 'yr2';
            };
            const filtered = ndayResults
              .filter(r => r.years_equivalent >= ndayMinYears)
              .filter(r => {
                const q = ndayFilter.toLowerCase();
                return !q || r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.industry.toLowerCase().includes(q);
              });

            return (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 className="card-title" style={{ margin: 0 }}>
                      Breakout Results
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        {filtered.length} stocks hitting multi-year highs
                      </span>
                    </h3>
                  </div>
                  <input
                    type="text"
                    placeholder="Search symbol / name / industry..."
                    value={ndayFilter}
                    onChange={(e) => setNdayFilter(e.target.value)}
                    style={{ width: '280px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                  <table className="option-chain-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Company</th>
                        <th>Industry</th>
                        <th style={{ textAlign: 'right' }}>Close</th>
                        <th style={{ textAlign: 'right' }}>Today High</th>
                        <th style={{ textAlign: 'right' }}>Change %</th>
                        <th style={{ textAlign: 'center' }}>Strength</th>
                        <th style={{ textAlign: 'center' }}>Windows Hit</th>
                        <th style={{ textAlign: 'center' }}>F&O</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No breakouts match the current filter.</td></tr>
                      ) : filtered.map(row => (
                        <tr key={row.symbol} style={{
                          background: row.years_equivalent >= 7 ? 'rgba(124,58,237,0.04)' : row.years_equivalent >= 5 ? 'rgba(234,179,8,0.03)' : 'transparent'
                        }}>
                          <td><strong style={{ color: '#a78bfa' }}>{row.symbol}</strong></td>
                          <td style={{ fontSize: '0.85rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.industry}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{row.close.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>₹{row.high.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: row.change_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                            {row.change_pct >= 0 ? '+' : ''}{row.change_pct}%
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`strength-badge ${getStrengthCls(row.years_equivalent)}`}>
                              {row.years_equivalent}yr
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', justifyContent: 'center' }}>
                              {row.matched_lookbacks.map(n => (
                                <span key={n} className="lookback-pill">{Math.round(n / 260)}yr</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.is_fo ? (
                              <span className="fo-dot" title="F&O eligible">F&O</span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="outline"
                              style={{
                                padding: '0.25rem 0.6rem', fontSize: '0.75rem',
                                opacity: row.is_fo ? 1 : 0.4,
                                cursor: row.is_fo ? 'pointer' : 'not-allowed'
                              }}
                              disabled={!row.is_fo}
                              title={row.is_fo ? 'Open in Options Workbench' : 'Not in F&O segment'}
                              onClick={() => {
                                if (!row.is_fo) return;
                                setSymbol(row.symbol);
                                setSelectedExpiry('');
                                setActiveTab('workbench');
                                fetchOptionChain(row.symbol, '');
                              }}
                            >
                              {row.is_fo ? 'Analyze Options' : 'Cash Only'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Completed but no results after filter */}
          {ndayStatus === 'completed' && ndayResults.filter(r => r.years_equivalent >= ndayMinYears).length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px dashed var(--border-color)', background: 'transparent' }}>
              <CheckCircle size={32} style={{ color: '#10b981', marginBottom: '1rem' }} />
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Scan Complete — No {ndayMinYears}yr+ Breakouts Found</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                Try lowering the Min Strength filter or adding more lookback windows in the sidebar.
              </p>
            </div>
          )}

          {/* Idle State */}
          {ndayStatus === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.02)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📈</div>
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Multi-Year Breakout Scanner</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
                Identifies stocks making <strong style={{ color: 'white' }}>all-time highs over 2 to 10 years</strong> — the ChartInk N-Day High formula.
                Stocks at multi-year highs often signal the beginning of powerful breakout trends.
              </p>
              <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
                {[{ label: '520 days', desc: '~2yr high', cls: 'yr2' }, { label: '1300 days', desc: '~5yr high', cls: 'yr5' }, { label: '2600 days', desc: '~10yr high', cls: 'yr7plus' }].map(({ label, desc, cls }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <span className={`strength-badge ${cls}`} style={{ fontSize: '0.9rem', padding: '0.3rem 0.7rem' }}>{desc}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{label}</div>
                  </div>
                ))}
              </div>
              <button
                style={{
                  padding: '0.6rem 1.8rem',
                  background: 'linear-gradient(90deg,#7c3aed,#6366f1)',
                  color: 'white', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem'
                }}
                onClick={startNdayScan}
              >
                🚀 Run Breakout Scan
              </button>
            </div>
          )}
        </main>
      )}

      {activeTab === 'oi_spurts' && (

        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #10b981' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.2rem', background: 'linear-gradient(90deg, #34d399, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                📊 Top 10 Open Interest Spurts
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Live NSE Derivative positioning leaderboard showing the highest daily increase in open interest.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {oiTimestamp && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  <div>Last update: {oiTimestamp}</div>
                  {oiIsMock && <div style={{ color: '#fbbf24', fontWeight: 600 }}>Mock Fallback Active</div>}
                </div>
              )}
              <button
                className="outline"
                onClick={fetchOiSpurts}
                disabled={oiLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <RefreshCw className={oiLoading ? "animate-spin" : ""} size={16} />
                Refresh Data
              </button>
            </div>
          </div>

          {oiLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <RefreshCw className="animate-spin" size={32} style={{ color: '#10b981', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Fetching OI Spurts...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connecting to National Stock Exchange of India API</p>
            </div>
          )}

          {oiError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <strong>Error Loading Data: </strong> {oiError}
              <button className="primary" onClick={fetchOiSpurts} style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Retry</button>
            </div>
          )}

          {!oiLoading && !oiError && (
            <>
              {/* Sorting Filter card */}
              <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>RANK BY HIGHEST FOR THE DAY:</span>
                
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => setOiSortBy('percent')}
                    style={{
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.9rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: oiSortBy === 'percent' ? '#10b981' : 'transparent',
                      color: oiSortBy === 'percent' ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    % Increase in OI
                  </button>
                  <button
                    onClick={() => setOiSortBy('absolute')}
                    style={{
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.9rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: oiSortBy === 'absolute' ? '#10b981' : 'transparent',
                      color: oiSortBy === 'absolute' ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Net Contract Increase
                  </button>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="card">
                <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                  <table className="option-chain-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', width: '70px' }}>Rank</th>
                        <th>Symbol</th>
                        <th style={{ textAlign: 'right' }}>Underlying Value</th>
                        <th style={{ textAlign: 'right' }}>Prev OI (Contracts)</th>
                        <th style={{ textAlign: 'right' }}>Latest OI (Contracts)</th>
                        <th style={{ textAlign: 'right' }}>Change in OI</th>
                        <th style={{ textAlign: 'center' }}>% Change</th>
                        <th style={{ textAlign: 'right' }}>Volume</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sorted = [...oiSpurts];
                        if (oiSortBy === 'percent') {
                          sorted.sort((a, b) => b.avgInOI - a.avgInOI);
                        } else {
                          sorted.sort((a, b) => b.changeInOI - a.changeInOI);
                        }
                        const top10 = sorted.slice(0, 10);

                        if (top10.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                No OI change data available.
                              </td>
                            </tr>
                          );
                        }

                        return top10.map((row, idx) => {
                          const getMedal = (pos: number) => {
                            if (pos === 0) return '🥇 1st';
                            if (pos === 1) return '🥈 2nd';
                            if (pos === 2) return '🥉 3rd';
                            return `${pos + 1}th`;
                          };

                          const getMedalStyle = (pos: number): React.CSSProperties => {
                            if (pos === 0) return { fontWeight: 800, color: '#fbbf24', textShadow: '0 0 8px rgba(251,191,36,0.2)' };
                            if (pos === 1) return { fontWeight: 800, color: '#94a3b8' };
                            if (pos === 2) return { fontWeight: 800, color: '#b45309' };
                            return { color: 'var(--text-muted)', fontSize: '0.85rem' };
                          };

                          return (
                            <tr key={row.symbol} style={idx < 3 ? { background: 'rgba(16,185,129,0.02)' } : {}}>
                              <td style={{ textAlign: 'center', ...getMedalStyle(idx) }}>
                                {getMedal(idx)}
                              </td>
                              <td>
                                <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                ₹{row.underlyingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                {row.prevOI.toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'right', color: 'white' }}>
                                {row.latestOI.toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                +{row.changeInOI.toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap'
                                }}>
                                  +{row.avgInOI}%
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                {row.volume.toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="outline"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                  onClick={() => {
                                    setSymbol(row.symbol);
                                    setSelectedExpiry('');
                                    setActiveTab('workbench');
                                    fetchOptionChain(row.symbol, '');
                                  }}
                                >
                                  Analyze Options
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </main>
      )}

      {activeTab === 'change_in_oi' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #3b82f6' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.2rem', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                📊 Change in Open Interest (Momentum Scan)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Track F&O contracts exhibiting the highest shift in derivative positioning. Helps identify where big money is building long positions or covering shorts.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {changeInOiData?.metadata?.timestamp && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  <div>Last update: {changeInOiData.metadata.timestamp}</div>
                  {changeInOiData.is_mock && <div style={{ color: '#fbbf24', fontWeight: 600 }}>Mock Fallback Active</div>}
                </div>
              )}
              <button
                className="outline"
                onClick={fetchChangeInOi}
                disabled={changeInOiLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <RefreshCw className={changeInOiLoading ? "animate-spin" : ""} size={16} />
                Refresh
              </button>
            </div>
          </div>

          {changeInOiLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <RefreshCw className="animate-spin" size={32} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Fetching F&O OI Change...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connecting to National Stock Exchange of India API</p>
            </div>
          )}

          {changeInOiError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <strong>Error Loading Data: </strong> {changeInOiError}
              <button className="primary" onClick={fetchChangeInOi} style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Retry</button>
            </div>
          )}

          {!changeInOiLoading && !changeInOiError && changeInOiData && (
            <>
              {/* Controls bar */}
              <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>FILTER:</span>
                  <input
                    type="text"
                    placeholder="Search by Symbol..."
                    value={changeInOiFilter}
                    onChange={(e) => setChangeInOiFilter(e.target.value)}
                    style={{ width: '240px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  />
                  <select
                    value={changeInOiSegment}
                    onChange={(e) => setChangeInOiSegment(e.target.value as any)}
                    style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Options</option>
                    <option value="stocks">Stocks Only</option>
                    <option value="indices">Indices Only</option>
                  </select>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing up to 25 items per category.
                </div>
              </div>

              {/* Responsive columns grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(550px, 1fr))', gap: '1.5rem' }}>
                
                {/* COLUMN 1: LONG BUILD-UP */}
                <div className="card" style={{ borderTop: '4px solid #10b981' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>📈 Long Build-up (Rise in OI & Price)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Bullish Strength
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Contract</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>% Price Chg</th>
                          <th style={{ textAlign: 'right' }}>OI Chg %</th>
                          <th style={{ textAlign: 'right' }}>OI Chg (Abs)</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (changeInOiData.long_buildup || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(changeInOiFilter.toLowerCase());
                            const matchSeg = changeInOiSegment === 'all' || 
                              (changeInOiSegment === 'stocks' && !r.is_index) || 
                              (changeInOiSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Long Build-up contracts match the filters.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => {
                            const isOpt = row.instrument_type.includes("Option") || row.strike_price > 0;
                            const contractLabel = isOpt 
                              ? `${row.strike_price} ${row.option_type}` 
                              : "Future";
                            return (
                              <tr key={row.symbol + '-' + row.strike_price + '-' + row.option_type + '-' + idx}>
                                <td>
                                  <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                                  <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                                    {row.is_index ? "IDX" : "STK"}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>
                                  <div>{contractLabel}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {row.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                  +{row.pct_change_in_ltp}%
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                  +{row.pct_change_in_oi}%
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                  {row.change_in_oi.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      setSymbol(row.symbol);
                                      setSelectedExpiry('');
                                      setActiveTab('workbench');
                                      fetchOptionChain(row.symbol, '');
                                    }}
                                  >
                                    Analyze
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* COLUMN 2: SHORT COVERING */}
                <div className="card" style={{ borderTop: '4px solid #60a5fa' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>🚀 Short Covering (Fall in OI & Rise in Price)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Sellers Rushing to Exit
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Contract</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>% Price Chg</th>
                          <th style={{ textAlign: 'right' }}>OI Chg %</th>
                          <th style={{ textAlign: 'right' }}>OI Chg (Abs)</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (changeInOiData.short_covering || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(changeInOiFilter.toLowerCase());
                            const matchSeg = changeInOiSegment === 'all' || 
                              (changeInOiSegment === 'stocks' && !r.is_index) || 
                              (changeInOiSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Short Covering contracts match the filters.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => {
                            const isOpt = row.instrument_type.includes("Option") || row.strike_price > 0;
                            const contractLabel = isOpt 
                              ? `${row.strike_price} ${row.option_type}` 
                              : "Future";
                            return (
                              <tr key={row.symbol + '-' + row.strike_price + '-' + row.option_type + '-' + idx}>
                                <td>
                                  <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                                  <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                                    {row.is_index ? "IDX" : "STK"}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>
                                  <div>{contractLabel}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {row.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                  +{row.pct_change_in_ltp}%
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                                  {row.pct_change_in_oi}%
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                  {row.change_in_oi.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      setSymbol(row.symbol);
                                      setSelectedExpiry('');
                                      setActiveTab('workbench');
                                      fetchOptionChain(row.symbol, '');
                                    }}
                                  >
                                    Analyze
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* COLUMN 3: SHORT BUILD-UP */}
                <div className="card" style={{ borderTop: '4px solid #ef4444' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>📉 Short Build-up (Rise in OI & Price Fall)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Bearish Strength
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Contract</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>% Price Chg</th>
                          <th style={{ textAlign: 'right' }}>OI Chg %</th>
                          <th style={{ textAlign: 'right' }}>OI Chg (Abs)</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (changeInOiData.short_buildup || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(changeInOiFilter.toLowerCase());
                            const matchSeg = changeInOiSegment === 'all' || 
                              (changeInOiSegment === 'stocks' && !r.is_index) || 
                              (changeInOiSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Short Build-up contracts match the filters.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => {
                            const isOpt = row.instrument_type.includes("Option") || row.strike_price > 0;
                            const contractLabel = isOpt 
                              ? `${row.strike_price} ${row.option_type}` 
                              : "Future";
                            return (
                              <tr key={row.symbol + '-' + row.strike_price + '-' + row.option_type + '-' + idx}>
                                <td>
                                  <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                                  <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                                    {row.is_index ? "IDX" : "STK"}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>
                                  <div>{contractLabel}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {row.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                  {row.pct_change_in_ltp}%
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                  +{row.pct_change_in_oi}%
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                  {row.change_in_oi.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      setSymbol(row.symbol);
                                      setSelectedExpiry('');
                                      setActiveTab('workbench');
                                      fetchOptionChain(row.symbol, '');
                                    }}
                                  >
                                    Analyze
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* COLUMN 4: LONG UNWINDING */}
                <div className="card" style={{ borderTop: '4px solid #f59e0b' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>⚠️ Long Unwinding (Fall in OI & Price Fall)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Buyers Liquidating
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Contract</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>% Price Chg</th>
                          <th style={{ textAlign: 'right' }}>OI Chg %</th>
                          <th style={{ textAlign: 'right' }}>OI Chg (Abs)</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (changeInOiData.long_unwinding || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(changeInOiFilter.toLowerCase());
                            const matchSeg = changeInOiSegment === 'all' || 
                              (changeInOiSegment === 'stocks' && !r.is_index) || 
                              (changeInOiSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Long Unwinding contracts match the filters.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => {
                            const isOpt = row.instrument_type.includes("Option") || row.strike_price > 0;
                            const contractLabel = isOpt 
                              ? `${row.strike_price} ${row.option_type}` 
                              : "Future";
                            return (
                              <tr key={row.symbol + '-' + row.strike_price + '-' + row.option_type + '-' + idx}>
                                <td>
                                  <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                                  <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                                    {row.is_index ? "IDX" : "STK"}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>
                                  <div>{contractLabel}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {row.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                  {row.pct_change_in_ltp}%
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                                  {row.pct_change_in_oi}%
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                  {row.change_in_oi.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      setSymbol(row.symbol);
                                      setSelectedExpiry('');
                                      setActiveTab('workbench');
                                      fetchOptionChain(row.symbol, '');
                                    }}
                                  >
                                    Analyze
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </>
          )}

        </main>
      )}

      {activeTab === 'futures_buildup' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.2rem', background: 'linear-gradient(90deg, #f59e0b, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ⚡ Futures Buildup (NSE Live Derivatives)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Track live positioning shifts across Stock Futures and Index Futures contracts. Monitor institutional long buildup, short buildup, long unwinding, and short covering.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {futuresData?.metadata?.timestamp && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  <div>Last update: {futuresData.metadata.timestamp}</div>
                  {futuresData.is_mock && <div style={{ color: '#fbbf24', fontWeight: 600 }}>Mock Fallback Active</div>}
                </div>
              )}
              <button
                className="outline"
                onClick={fetchFuturesBuildup}
                disabled={futuresLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <RefreshCw className={futuresLoading ? "animate-spin" : ""} size={16} />
                Refresh
              </button>
            </div>
          </div>

          {futuresLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <RefreshCw className="animate-spin" size={32} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Fetching NSE Futures Buildup...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connecting to National Stock Exchange of India API</p>
            </div>
          )}

          {futuresError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <strong>Error Loading Data: </strong> {futuresError}
              <button className="primary" onClick={fetchFuturesBuildup} style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Retry</button>
            </div>
          )}

          {!futuresLoading && !futuresError && futuresData && (
            <>
              {/* Controls bar */}
              <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>FILTER:</span>
                  <input
                    type="text"
                    placeholder="Search Futures Symbol..."
                    value={futuresFilter}
                    onChange={(e) => setFuturesFilter(e.target.value)}
                    style={{ width: '240px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  />
                  <select
                    value={futuresSegment}
                    onChange={(e) => setFuturesSegment(e.target.value as any)}
                    style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Futures</option>
                    <option value="stocks">Stocks Only</option>
                    <option value="indices">Indices Only</option>
                  </select>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing top 10 Futures contracts per quadrant.
                </div>
              </div>

              {/* 2x2 Grid Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(550px, 1fr))', gap: '1.5rem' }}>
                
                {/* QUADRANT 1: LONG BUILD-UP */}
                <div className="card" style={{ borderTop: '4px solid #10b981' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>📈 Long Build-up (Price Rise + OI Rise)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Bullish Buyers
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Instrument Name</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>OI (Contracts)</th>
                          <th style={{ textAlign: 'right' }}>% Change in OI</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (futuresData.long_buildup || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(futuresFilter.toLowerCase());
                            const matchSeg = futuresSegment === 'all' || 
                              (futuresSegment === 'stocks' && !r.is_index) || 
                              (futuresSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Long Build-up Futures match the criteria.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => (
                            <tr key={row.symbol + '-' + row.expiry_date + '-' + idx}>
                              <td>
                                <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>
                                <div>{row.instrument_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                <div>₹{row.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 1 }) || '0'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#10b981' }}>+{row.pct_change_in_ltp}%</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'white' }}>
                                {row.current_oi?.toLocaleString() || '0'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                +{row.pct_change_in_oi}%
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="outline"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                  onClick={() => {
                                    setSymbol(row.symbol);
                                    setSelectedExpiry('');
                                    setActiveTab('workbench');
                                    fetchOptionChain(row.symbol, '');
                                  }}
                                >
                                  Analyze
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* QUADRANT 2: SHORT BUILD-UP */}
                <div className="card" style={{ borderTop: '4px solid #ef4444' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>📉 Short Build-up (Price Fall + OI Rise)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Bearish Sellers
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Instrument Name</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>OI (Contracts)</th>
                          <th style={{ textAlign: 'right' }}>% Change in OI</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (futuresData.short_buildup || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(futuresFilter.toLowerCase());
                            const matchSeg = futuresSegment === 'all' || 
                              (futuresSegment === 'stocks' && !r.is_index) || 
                              (futuresSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Short Build-up Futures match the criteria.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => (
                            <tr key={row.symbol + '-' + row.expiry_date + '-' + idx}>
                              <td>
                                <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>
                                <div>{row.instrument_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                <div>₹{row.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 1 }) || '0'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{row.pct_change_in_ltp}%</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'white' }}>
                                {row.current_oi?.toLocaleString() || '0'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                +{row.pct_change_in_oi}%
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="outline"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                  onClick={() => {
                                    setSymbol(row.symbol);
                                    setSelectedExpiry('');
                                    setActiveTab('workbench');
                                    fetchOptionChain(row.symbol, '');
                                  }}
                                >
                                  Analyze
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* QUADRANT 3: LONG UNWINDING */}
                <div className="card" style={{ borderTop: '4px solid #f59e0b' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>⚠️ Long Unwinding (Price Fall + OI Fall)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Longs Liquidating
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Instrument Name</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>OI (Contracts)</th>
                          <th style={{ textAlign: 'right' }}>% Change in OI</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (futuresData.long_unwinding || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(futuresFilter.toLowerCase());
                            const matchSeg = futuresSegment === 'all' || 
                              (futuresSegment === 'stocks' && !r.is_index) || 
                              (futuresSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Long Unwinding Futures match the criteria.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => (
                            <tr key={row.symbol + '-' + row.expiry_date + '-' + idx}>
                              <td>
                                <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>
                                <div>{row.instrument_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                <div>₹{row.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 1 }) || '0'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{row.pct_change_in_ltp}%</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'white' }}>
                                {row.current_oi?.toLocaleString() || '0'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                                {row.pct_change_in_oi}%
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="outline"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                  onClick={() => {
                                    setSymbol(row.symbol);
                                    setSelectedExpiry('');
                                    setActiveTab('workbench');
                                    fetchOptionChain(row.symbol, '');
                                  }}
                                >
                                  Analyze
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* QUADRANT 4: SHORT COVERING */}
                <div className="card" style={{ borderTop: '4px solid #60a5fa' }}>
                  <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <span>🚀 Short Covering (Price Rise + OI Fall)</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                      Shorts Liquidating
                    </span>
                  </h3>
                  
                  <div className="option-chain-container" style={{ overflowX: 'auto' }}>
                    <table className="option-chain-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Instrument Name</th>
                          <th style={{ textAlign: 'right' }}>LTP</th>
                          <th style={{ textAlign: 'right' }}>OI (Contracts)</th>
                          <th style={{ textAlign: 'right' }}>% Change in OI</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const list = (futuresData.short_covering || []).filter(r => {
                            const matchSym = r.symbol.toLowerCase().includes(futuresFilter.toLowerCase());
                            const matchSeg = futuresSegment === 'all' || 
                              (futuresSegment === 'stocks' && !r.is_index) || 
                              (futuresSegment === 'indices' && r.is_index);
                            return matchSym && matchSeg;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No Short Covering Futures match the criteria.
                                </td>
                              </tr>
                            );
                          }

                          return list.slice(0, 10).map((row, idx) => (
                            <tr key={row.symbol + '-' + row.expiry_date + '-' + idx}>
                              <td>
                                <strong style={{ color: '#60a5fa' }}>{row.symbol}</strong>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>
                                <div>{row.instrument_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.expiry_date}</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                <div>₹{row.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 1 }) || '0'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#10b981' }}>+{row.pct_change_in_ltp}%</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'white' }}>
                                {row.current_oi?.toLocaleString() || '0'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                                {row.pct_change_in_oi}%
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="outline"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                  onClick={() => {
                                    setSymbol(row.symbol);
                                    setSelectedExpiry('');
                                    setActiveTab('workbench');
                                    fetchOptionChain(row.symbol, '');
                                  }}
                                >
                                  Analyze
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </>
          )}

        </main>
      )}

      {activeTab === 'oi_graph' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* TOP BANNER & TICKER SELECTOR */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', padding: '1.2rem', borderLeft: '4px solid #8b5cf6' }}>
            
            {/* Row 1: Index Quick Tabs + Symbol & Expiry Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                {['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'].map((idxSym) => (
                  <button
                    key={idxSym}
                    className={symbol === idxSym ? 'primary' : 'outline'}
                    style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}
                    onClick={() => {
                      setSymbol(idxSym);
                      setSelectedExpiry('');
                      fetchOptionChain(idxSym, '');
                    }}
                  >
                    {idxSym}
                  </button>
                ))}
                
                <select
                  value={symbol}
                  onChange={(e) => {
                    setSymbol(e.target.value);
                    setSelectedExpiry('');
                    fetchOptionChain(e.target.value, '');
                  }}
                  style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  {AVAILABLE_SYMBOLS.map((asset) => (
                    <option key={asset.value} value={asset.value}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {optionChain?.expiry_dates && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPIRY:</span>
                    <select
                      value={selectedExpiry}
                      onChange={(e) => {
                        setSelectedExpiry(e.target.value);
                        fetchOptionChain(symbol, e.target.value);
                      }}
                      style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      {optionChain.expiry_dates.map((exp) => (
                        <option key={exp} value={exp}>{exp}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  className="outline"
                  onClick={() => fetchOptionChain(symbol, selectedExpiry)}
                  disabled={chainLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }}
                >
                  <RefreshCw className={chainLoading ? "animate-spin" : ""} size={15} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Row 2: Spot Price & Top Metrics Cards (Dhan.co Style) */}
            {optionChain && (() => {
              const totalCallOi = (optionChain.strikes || []).reduce((acc, s) => acc + (s.CE?.oi || 0), 0);
              const totalPutOi = (optionChain.strikes || []).reduce((acc, s) => acc + (s.PE?.oi || 0), 0);
              const formatOi = (num: number) => {
                if (Math.abs(num) >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
                if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(2)} L`;
                return num.toLocaleString();
              };

              const atmStrikeObj = (optionChain.strikes || []).find(s => s.strike === optionChain.atm_strike);
              const atmIv = atmStrikeObj ? ((atmStrikeObj.CE?.iv || atmStrikeObj.PE?.iv || 0.15) * 100).toFixed(2) : '14.50';

              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Ticker & Spot */}
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {optionChain.symbol}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: optionChain.is_mock ? '#fbbf24' : '#10b981', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                        {optionChain.is_mock ? 'Mock Data' : 'NSE Live'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontFamily: 'JetBrains Mono', fontWeight: 800, color: '#60a5fa' }}>
                      {optionChain.underlying_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Summary Metric Stats Banner */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', background: 'rgba(0,0,0,0.25)', padding: '0.8rem 1.5rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL PUT OI</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#8b5cf6' }}>{formatOi(totalPutOi)}</div>
                    </div>
                    
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL CALL OI</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#eab308' }}>{formatOi(totalCallOi)}</div>
                    </div>

                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PCR</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: optionChain.pcr >= 1.0 ? '#10b981' : optionChain.pcr < 0.8 ? '#ef4444' : '#60a5fa' }}>
                        {optionChain.pcr.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>MAX PAIN</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>{optionChain.max_pain.toLocaleString()}</div>
                    </div>

                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ATM IV</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{atmIv}%</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {chainLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <RefreshCw className="animate-spin" size={32} style={{ color: '#8b5cf6', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Loading Open Interest Option Chain...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fetching strikes and open interest from NSE</p>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <strong>Error Loading Data: </strong> {error}
              <button className="primary" onClick={() => fetchOptionChain(symbol, selectedExpiry)} style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Retry</button>
            </div>
          )}

          {!chainLoading && !error && optionChain && (() => {
            const allStrikes = optionChain.strikes || [];
            if (allStrikes.length === 0) return null;

            // Positioning Signal Helper
            const getBuildupSignal = (oiChange: number, priceChange: number) => {
              if (oiChange > 0 && priceChange >= 0) return { label: 'Long Buildup', tag: '📈 Long Buildup', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
              if (oiChange > 0 && priceChange < 0) return { label: 'Short Buildup', tag: '📉 Short Buildup', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
              if (oiChange < 0 && priceChange < 0) return { label: 'Long Unwinding', tag: '⚠️ Long Unwinding', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
              if (oiChange < 0 && priceChange >= 0) return { label: 'Short Covering', tag: '🚀 Short Covering', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
              return { label: 'Neutral', tag: '➖ Neutral', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)' };
            };

            // Compute Top Positioning Strikes Across Chain
            let topLongUnwinding: { strike: number; type: 'CE' | 'PE'; oiChange: number; pChange: number } | null = null;
            let topShortCovering: { strike: number; type: 'CE' | 'PE'; oiChange: number; pChange: number } | null = null;
            let topLongBuildup: { strike: number; type: 'CE' | 'PE'; oiChange: number; pChange: number } | null = null;
            let topShortBuildup: { strike: number; type: 'CE' | 'PE'; oiChange: number; pChange: number } | null = null;

            allStrikes.forEach(s => {
              if (s.CE) {
                const ceOiChg = s.CE.oi_change || 0;
                const cePriceChg = s.CE.change || 0;
                const signal = getBuildupSignal(ceOiChg, cePriceChg);
                if (signal.label === 'Long Unwinding' && (!topLongUnwinding || Math.abs(ceOiChg) > Math.abs(topLongUnwinding.oiChange))) {
                  topLongUnwinding = { strike: s.strike, type: 'CE', oiChange: ceOiChg, pChange: cePriceChg };
                }
                if (signal.label === 'Short Covering' && (!topShortCovering || Math.abs(ceOiChg) > Math.abs(topShortCovering.oiChange))) {
                  topShortCovering = { strike: s.strike, type: 'CE', oiChange: ceOiChg, pChange: cePriceChg };
                }
                if (signal.label === 'Long Buildup' && (!topLongBuildup || ceOiChg > topLongBuildup.oiChange)) {
                  topLongBuildup = { strike: s.strike, type: 'CE', oiChange: ceOiChg, pChange: cePriceChg };
                }
                if (signal.label === 'Short Buildup' && (!topShortBuildup || ceOiChg > topShortBuildup.oiChange)) {
                  topShortBuildup = { strike: s.strike, type: 'CE', oiChange: ceOiChg, pChange: cePriceChg };
                }
              }
              if (s.PE) {
                const peOiChg = s.PE.oi_change || 0;
                const pePriceChg = s.PE.change || 0;
                const signal = getBuildupSignal(peOiChg, pePriceChg);
                if (signal.label === 'Long Unwinding' && (!topLongUnwinding || Math.abs(peOiChg) > Math.abs(topLongUnwinding.oiChange))) {
                  topLongUnwinding = { strike: s.strike, type: 'PE', oiChange: peOiChg, pChange: pePriceChg };
                }
                if (signal.label === 'Short Covering' && (!topShortCovering || Math.abs(peOiChg) > Math.abs(topShortCovering.oiChange))) {
                  topShortCovering = { strike: s.strike, type: 'PE', oiChange: peOiChg, pChange: pePriceChg };
                }
                if (signal.label === 'Long Buildup' && (!topLongBuildup || peOiChg > topLongBuildup.oiChange)) {
                  topLongBuildup = { strike: s.strike, type: 'PE', oiChange: peOiChg, pChange: pePriceChg };
                }
                if (signal.label === 'Short Buildup' && (!topShortBuildup || peOiChg > topShortBuildup.oiChange)) {
                  topShortBuildup = { strike: s.strike, type: 'PE', oiChange: peOiChg, pChange: pePriceChg };
                }
              }
            });

            // Determine strikes window around ATM
            const atmIndex = allStrikes.findIndex(s => s.strike >= optionChain.atm_strike);
            const validAtmIdx = atmIndex >= 0 ? atmIndex : Math.floor(allStrikes.length / 2);
            
            const startIdx = oiGraphRange >= 900 ? 0 : Math.max(0, validAtmIdx - oiGraphRange);
            const endIdx = oiGraphRange >= 900 ? allStrikes.length : Math.min(allStrikes.length, validAtmIdx + oiGraphRange + 1);
            const visibleStrikes = allStrikes.slice(startIdx, endIdx);

            // Compute Max Value for Y-scaling
            const getVal = (s: StrikeData, type: 'call' | 'put') => {
              if (oiGraphMode === 'change') {
                return Math.abs(type === 'call' ? s.CE?.oi_change || 0 : s.PE?.oi_change || 0);
              }
              return type === 'call' ? s.CE?.oi || 0 : s.PE?.oi || 0;
            };

            let maxOi = 0;
            visibleStrikes.forEach(s => {
              const cVal = getVal(s, 'call');
              const pVal = getVal(s, 'put');
              if (cVal > maxOi) maxOi = cVal;
              if (pVal > maxOi) maxOi = pVal;
            });
            if (maxOi === 0) maxOi = 1000;

            const formatYAxis = (val: number) => {
              if (Math.abs(val) >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
              if (Math.abs(val) >= 100000) return `${(val / 100000).toFixed(1)}L`;
              if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
              return val.toString();
            };

            return (
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                
                {/* TOP POSITIONING HIGHLIGHT CARDS BANNER */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {/* Long Unwinding Card */}
                  <div className="card" style={{ padding: '0.8rem 1rem', background: 'rgba(245, 158, 11, 0.08)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      ⚠️ Max Long Unwinding
                    </div>
                    {topLongUnwinding ? (
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                          Strike {(topLongUnwinding as any).strike} {(topLongUnwinding as any).type}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                          <span>OI Δ: {formatYAxis((topLongUnwinding as any).oiChange)}</span>
                          <span>LTP Δ: {(topLongUnwinding as any).pChange >= 0 ? '+' : ''}{(topLongUnwinding as any).pChange.toFixed(1)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None Detected</div>
                    )}
                  </div>

                  {/* Short Covering Card */}
                  <div className="card" style={{ padding: '0.8rem 1rem', background: 'rgba(96, 165, 250, 0.08)', borderLeft: '4px solid #60a5fa' }}>
                    <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      🚀 Max Short Covering
                    </div>
                    {topShortCovering ? (
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                          Strike {(topShortCovering as any).strike} {(topShortCovering as any).type}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                          <span>OI Δ: {formatYAxis((topShortCovering as any).oiChange)}</span>
                          <span>LTP Δ: +{(topShortCovering as any).pChange.toFixed(1)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None Detected</div>
                    )}
                  </div>

                  {/* Long Buildup Card */}
                  <div className="card" style={{ padding: '0.8rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      📈 Max Long Buildup
                    </div>
                    {topLongBuildup ? (
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                          Strike {(topLongBuildup as any).strike} {(topLongBuildup as any).type}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                          <span>OI Δ: +{formatYAxis((topLongBuildup as any).oiChange)}</span>
                          <span>LTP Δ: +{(topLongBuildup as any).pChange.toFixed(1)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None Detected</div>
                    )}
                  </div>

                  {/* Short Buildup Card */}
                  <div className="card" style={{ padding: '0.8rem 1rem', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      📉 Max Short Buildup
                    </div>
                    {topShortBuildup ? (
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                          Strike {(topShortBuildup as any).strike} {(topShortBuildup as any).type}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                          <span>OI Δ: +{formatYAxis((topShortBuildup as any).oiChange)}</span>
                          <span>LTP Δ: {(topShortBuildup as any).pChange.toFixed(1)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None Detected</div>
                    )}
                  </div>
                </div>

                {/* Header Controls for Chart Mode */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>
                      {oiGraphMode === 'total' ? '📊 Open Interest (Cumulative)' : '🔄 Change in Open Interest (Positioning Shift)'}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({visibleStrikes.length} Strikes displayed)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#8b5cf6' }}></span>
                      <span style={{ color: 'white', fontWeight: 600 }}>Put OI (Support)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#eab308' }}></span>
                      <span style={{ color: 'white', fontWeight: 600 }}>Call OI (Resistance)</span>
                    </div>
                  </div>
                </div>

                {/* GRAPH CONTAINER */}
                <div style={{ position: 'relative', width: '100%', minHeight: '400px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px', padding: '1.5rem 1rem 1rem 3.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  
                  {/* Y-AXIS GRID & LABELS */}
                  <div style={{ position: 'absolute', left: '0.5rem', top: '1.5rem', bottom: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', width: '2.5rem', textAlign: 'right' }}>
                    {oiGraphMode === 'change' ? (
                      <>
                        <span>{formatYAxis(maxOi)}</span>
                        <span>{formatYAxis(maxOi * 0.5)}</span>
                        <span>0</span>
                        <span>{formatYAxis(-maxOi * 0.5)}</span>
                        <span>{formatYAxis(-maxOi)}</span>
                      </>
                    ) : (
                      <>
                        <span>{formatYAxis(maxOi)}</span>
                        <span>{formatYAxis(maxOi * 0.75)}</span>
                        <span>{formatYAxis(maxOi * 0.5)}</span>
                        <span>{formatYAxis(maxOi * 0.25)}</span>
                        <span>0</span>
                      </>
                    )}
                  </div>

                  {/* HORIZONTAL GRID LINES */}
                  <div style={{ position: 'absolute', left: '3.5rem', right: '1.5rem', top: '1.5rem', bottom: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}></div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}></div>
                    <div style={{ borderTop: oiGraphMode === 'change' ? '1px solid rgba(255,255,255,0.3)' : '1px dashed rgba(255,255,255,0.08)' }}></div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}></div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}></div>
                  </div>

                  {/* BARS GRID */}
                  <div style={{ position: 'relative', height: '320px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px', zIndex: 2 }}>
                    {visibleStrikes.map((s) => {
                      const isAtm = s.strike === optionChain.atm_strike;
                      const isMaxPain = s.strike === optionChain.max_pain;
                      const isHovered = oiGraphHoveredStrike === s.strike;

                      const strikePcr = s.CE?.oi > 0 ? (s.PE?.oi / s.CE?.oi).toFixed(2) : 'N/A';

                      // Positioning Signals
                      const ceSignal = getBuildupSignal(s.CE?.oi_change || 0, s.CE?.change || 0);
                      const peSignal = getBuildupSignal(s.PE?.oi_change || 0, s.PE?.change || 0);

                      // Bar Color Decision
                      const getCallBarBg = () => {
                        if (oiGraphMode === 'change') {
                          return `linear-gradient(180deg, ${ceSignal.color}, ${ceSignal.color}dd)`;
                        }
                        return 'linear-gradient(180deg, #facc15, #d97706)';
                      };

                      const getPutBarBg = () => {
                        if (oiGraphMode === 'change') {
                          return `linear-gradient(180deg, ${peSignal.color}, ${peSignal.color}dd)`;
                        }
                        return 'linear-gradient(180deg, #a78bfa, #7c3aed)';
                      };

                      // Heights and positions based on mode
                      let putStyle: React.CSSProperties = {};
                      let callStyle: React.CSSProperties = {};

                      if (oiGraphMode === 'change') {
                        const peChange = s.PE?.oi_change || 0;
                        const ceChange = s.CE?.oi_change || 0;

                        const putHeight = (Math.abs(peChange) / maxOi) * 50;
                        const callHeight = (Math.abs(ceChange) / maxOi) * 50;

                        putStyle = {
                          position: 'absolute',
                          left: '8%',
                          width: '40%',
                          height: `${Math.max(2, putHeight)}%`,
                          background: getPutBarBg(),
                          boxShadow: isHovered ? `0 0 8px ${peSignal.color}` : 'none',
                          transition: 'all 0.2s',
                          ...(peChange >= 0 ? { bottom: '50%', borderRadius: '3px 3px 0 0' } : { top: '50%', borderRadius: '0 0 3px 3px' })
                        };

                        callStyle = {
                          position: 'absolute',
                          right: '8%',
                          width: '40%',
                          height: `${Math.max(2, callHeight)}%`,
                          background: getCallBarBg(),
                          boxShadow: isHovered ? `0 0 8px ${ceSignal.color}` : 'none',
                          transition: 'all 0.2s',
                          ...(ceChange >= 0 ? { bottom: '50%', borderRadius: '3px 3px 0 0' } : { top: '50%', borderRadius: '0 0 3px 3px' })
                        };
                      } else {
                        const putHeight = ((s.PE?.oi || 0) / maxOi) * 100;
                        const callHeight = ((s.CE?.oi || 0) / maxOi) * 100;

                        putStyle = {
                          position: 'absolute',
                          left: '8%',
                          width: '40%',
                          height: `${Math.max(2, putHeight)}%`,
                          background: getPutBarBg(),
                          borderRadius: '3px 3px 0 0',
                          boxShadow: isHovered ? '0 0 8px rgba(124, 58, 237, 0.4)' : 'none',
                          transition: 'all 0.2s',
                          bottom: 0
                        };

                        callStyle = {
                          position: 'absolute',
                          right: '8%',
                          width: '40%',
                          height: `${Math.max(2, callHeight)}%`,
                          background: getCallBarBg(),
                          borderRadius: '3px 3px 0 0',
                          boxShadow: isHovered ? '0 0 8px rgba(217, 119, 6, 0.4)' : 'none',
                          transition: 'all 0.2s',
                          bottom: 0
                        };
                      }

                      return (
                        <div
                          key={s.strike}
                          onMouseEnter={() => setOiGraphHoveredStrike(s.strike)}
                          onMouseLeave={() => setOiGraphHoveredStrike(null)}
                          style={{
                            flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
                            position: 'relative', cursor: 'pointer', padding: '0 2px',
                            background: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                            borderRadius: '4px', transition: 'background 0.15s'
                          }}
                        >
                          {/* ATM Vertical Dashed Line */}
                          {isAtm && (
                            <div style={{
                              position: 'absolute', top: 0, bottom: 0, left: '50%', width: '2px',
                              borderLeft: '2px dashed white', transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none'
                            }}>
                              <span style={{
                                position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)',
                                background: '#3b82f6', color: 'white', fontSize: '0.65rem', fontWeight: 800,
                                padding: '0.1rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap'
                              }}>
                                ATM
                              </span>
                            </div>
                          )}

                          {/* GROUPED BARS WRAPPER */}
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {/* Put Bar */}
                            <div style={putStyle}></div>
                            {/* Call Bar */}
                            <div style={callStyle}></div>
                          </div>

                          {/* X-Axis Strike Label */}
                          <div style={{
                            marginTop: '0.5rem', fontSize: '0.7rem', fontWeight: isAtm || isMaxPain ? 700 : 500,
                            color: isAtm ? '#60a5fa' : isMaxPain ? '#f43f5e' : 'var(--text-muted)',
                            transform: visibleStrikes.length > 15 ? 'rotate(-45deg)' : 'none',
                            whiteSpace: 'nowrap'
                          }}>
                            {s.strike.toLocaleString()}
                          </div>

                          {/* HOVER TOOLTIP WITH POSITIONING DETAILS */}
                          {isHovered && (
                            <div style={{
                              position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                              background: '#1f2937', border: '1px solid var(--border-color)', borderRadius: '10px',
                              padding: '0.75rem 0.9rem', width: '230px', zIndex: 25, boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                              pointerEvents: 'none', textAlign: 'left'
                            }}>
                              <div style={{ fontWeight: 800, color: 'white', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Strike {s.strike.toLocaleString()}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>PCR: {strikePcr}</span>
                              </div>

                              <div style={{ fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {/* Call Details */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '6px', borderLeft: `3px solid ${ceSignal.color}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#facc15', fontWeight: 700 }}>
                                    <span>Call Option (CE):</span>
                                    <span>{formatYAxis(s.CE?.oi || 0)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>OI Shift: {formatYAxis(s.CE?.oi_change || 0)}</span>
                                    <span style={{ color: ceSignal.color, fontWeight: 700 }}>{ceSignal.tag}</span>
                                  </div>
                                </div>

                                {/* Put Details */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '6px', borderLeft: `3px solid ${peSignal.color}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a78bfa', fontWeight: 700 }}>
                                    <span>Put Option (PE):</span>
                                    <span>{formatYAxis(s.PE?.oi || 0)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>OI Shift: {formatYAxis(s.PE?.oi_change || 0)}</span>
                                    <span style={{ color: peSignal.color, fontWeight: 700 }}>{peSignal.tag}</span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', paddingTop: '0.2rem' }}>
                                  <span>CE IV / PE IV:</span>
                                  <strong>{((s.CE?.iv || 0)*100).toFixed(1)}% / {((s.PE?.iv || 0)*100).toFixed(1)}%</strong>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })()}

        </main>
      )}

      {activeTab === 'high_momentum' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HEADER STRATEGY BANNER */}
          <div className="card" style={{ padding: '1.2rem 1.5rem', borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔥 Advanced High Momentum Scanner
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Screening for high momentum outperformers using 3-step checklist: EMA Stack (20 &gt; 50 &gt; 200), Trend Strength (ADX ≥ 20), and Relative Strength (CRS vs Nifty 50).
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>MATCHING CANDIDATES</span>
                <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{highMomentumCandidates.length} Found</strong>
              </div>
              <button
                className="primary"
                onClick={runHighMomentumScan}
                disabled={highMomentumScanning}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(90deg, #ef4444, #f59e0b)' }}
              >
                {highMomentumScanning ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                {highMomentumScanning ? 'Scanning...' : 'Rescan Now'}
              </button>
            </div>
          </div>

          {/* CANDIDATES RESULTS TABLE */}
          <div className="card" style={{ padding: '1.2rem' }}>
            {highMomentumScanning && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshCw className="animate-spin" size={32} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', color: 'white' }}>Scanning Indian Stock Universe...</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{highMomentumStatus}</p>
              </div>
            )}

            {!highMomentumScanning && highMomentumCandidates.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <AlertTriangle size={32} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', color: 'white' }}>No Matching Momentum Candidates Today</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  No stocks currently meet all 3 strict criteria (EMA Alignment + ADX ≥ {highMomentumAdxMin} + CRS vs Nifty 50). Try lowering ADX or adjusting Market Cap Floor.
                </p>
              </div>
            )}

            {!highMomentumScanning && highMomentumCandidates.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>SYMBOL</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>LTP / CANDLE</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>TREND (20/50/200 EMA)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>ADX(14)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>CRS VS NIFTY</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>ENTRY / TARGET (60%)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>STOP LOSS (50 EMA)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>SCORE</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highMomentumCandidates.map((cand) => (
                      <tr key={cand.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <strong style={{ fontSize: '0.95rem', color: 'white', display: 'block' }}>{cand.symbol}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            ₹{cand.market_cap_cr ? `${cand.market_cap_cr.toLocaleString()} Cr` : 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>₹{cand.close.toFixed(2)}</span>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: cand.green_candle ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {cand.green_candle ? '🟢 Green Candle' : '🔴 Red Candle'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-block' }}>
                            ✓ 20 &gt; 50 &gt; 200 EMA
                          </span>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            20: ₹{cand.ema20} | 50: ₹{cand.ema50}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.9rem' }}>{cand.adx}</span>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {cand.adx >= 25 ? '🔥 Strong Trend' : '⚡ Acceptable'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ color: cand.crs_outperforming ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
                            {cand.crs_outperforming ? '🚀 Outperforming Nifty' : '📉 Underperforming'}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Ratio: {cand.crs_ratio} (EMA {cand.crs_ema})
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem' }}>
                            TGT: ₹{cand.target_price} (+{cand.target_pct}%)
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Entry: ₹{cand.entry} (60% profit booking)
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>
                            SL: ₹{cand.stop_price}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', maxWidth: '160px' }}>
                            {cand.trail_rule}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ background: 'linear-gradient(90deg, #ef4444, #f59e0b)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>
                            {cand.score}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <button
                            className="primary"
                            onClick={() => {
                              setSymbol(cand.symbol);
                              setActiveTab('workbench');
                            }}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            ⚡ Trade Strategy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </main>
      )}

      {activeTab === 'elder_impulse' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HEADER STRATEGY BANNER */}
          <div className="card" style={{ padding: '1.2rem 1.5rem', borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚡ Elder Impulse Pro Scanner
                <span style={{ fontSize: '0.75rem', background: '#3b82f6', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                  {elderImpulseUniverse.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '0.75rem', background: '#8b5cf6', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                  {elderImpulseTimeframe} Timeframe
                </span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Multi-indicator confluence scanner: Dr. Elder's Impulse System (EMA 13 + MACD Hist), Supertrend ({elderImpulseStFactor}, {elderImpulseStAtrLen}), and Wilder's DMI/ADX ≥ {elderImpulseAdxThreshold}.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>CONFLUENCE MATCHES</span>
                <strong style={{ fontSize: '1.2rem', color: '#60a5fa' }}>{elderImpulseResults.length} Found</strong>
              </div>
              <button
                className="primary"
                onClick={runElderImpulseScan}
                disabled={elderImpulseScanning}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
              >
                {elderImpulseScanning ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                {elderImpulseScanning ? 'Scanning...' : 'Rescan Now'}
              </button>
            </div>
          </div>

          {/* CANDIDATES RESULTS TABLE */}
          <div className="card" style={{ padding: '1.2rem' }}>
            {elderImpulseScanning && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshCw className="animate-spin" size={32} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', color: 'white' }}>Scanning Elder Impulse Confluences...</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{elderImpulseStatus}</p>
              </div>
            )}

            {!elderImpulseScanning && elderImpulseResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <AlertTriangle size={32} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', color: 'white' }}>No Confluence Matches Found Today</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  No stocks currently meet all 4 confluence criteria (Elder Impulse + Supertrend + ADX ≥ {elderImpulseAdxThreshold} + DMI). Try lowering the ADX threshold.
                </p>
              </div>
            )}

            {!elderImpulseScanning && elderImpulseResults.length > 0 && (() => {
              const filteredResults = elderImpulseResults.filter(r => {
                if (elderImpulseFilter === 'bull') return r.confluence === 'BULL';
                if (elderImpulseFilter === 'bear') return r.confluence === 'BEAR';
                return true;
              });

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>SYMBOL</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>LTP / CLOSE</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>CONFLUENCE SIGNAL</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>ELDER IMPULSE (EMA 13 + MACD)</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>SUPERTREND</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>ADX(14) TREND</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>DMI (+DI / -DI)</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>SCORE</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((r) => {
                        const isBull = r.confluence === 'BULL';
                        return (
                          <tr key={r.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <strong style={{ fontSize: '0.95rem', color: 'white', display: 'block' }}>{r.symbol}</strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NSE Equity</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>₹{r.close.toFixed(2)}</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{
                                background: isBull ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isBull ? '#10b981' : '#ef4444',
                                padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-block'
                              }}>
                                {isBull ? '🟢 BULL CONFLUENCE' : '🔴 BEAR CONFLUENCE'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontWeight: 700, color: isBull ? '#10b981' : '#ef4444', fontSize: '0.8rem' }}>
                                {r.elder_impulse}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                EMA13: ₹{r.ema} | MACD Hist: {r.macd_hist >= 0 ? '+' : ''}{r.macd_hist}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ color: r.supertrend_dir === 'Up' ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '0.8rem' }}>
                                Supertrend {r.supertrend_dir}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                Line: ₹{r.supertrend}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontWeight: 800, color: '#3b82f6', fontSize: '0.9rem' }}>{r.adx}</span>
                              <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {r.adx >= 30 ? '🔥 Extreme Trend' : '⚡ Trending'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>
                                <span style={{ color: '#10b981' }}>+DI {r.di_plus}</span> / <span style={{ color: '#ef4444' }}>-DI {r.di_minus}</span>
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>
                                {r.score}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <button
                                className="primary"
                                onClick={() => {
                                  setSymbol(r.symbol);
                                  setActiveTab('workbench');
                                }}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}
                              >
                                ⚡ Trade Strategy
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

        </main>
      )}

      {activeTab === 'straddle_chart' && (
        <div className="straddle-dashboard full-width-section">
          {/* LEFT PANEL: Watchlist */}
          <div className="watchlist-sidebar">
            {['NIFTY', 'BANKNIFTY', 'SENSEX', 'MIDCPNIFTY', 'FINNIFTY'].map(sym => {
              const data = watchlistData.find(d => d.symbol === sym);
              const isActive = straddleSymbol === sym;
              return (
                <div 
                  key={sym} 
                  className={`watchlist-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setStraddleSymbol(sym);
                    setStraddleExpiry('');
                    setStraddleStrike(null);
                    setStraddleAutoAtm(true);
                    // trigger fetch in a moment via useEffect or direct call
                    setTimeout(() => fetchStraddleData(sym, '', null, straddleTimeframe, true), 50);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: isActive ? 'var(--color-primary-500)' : 'var(--text-main)' }}>{sym}</strong>
                    <span style={{ fontSize: '0.75rem', color: data?.change_pct >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {data?.change_pct > 0 ? '+' : ''}{data?.change_pct || 0}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ATM {data?.atm_strike || '--'}</span>
                    <strong style={{ fontSize: '0.9rem' }}>{data?.atm_straddle_price || '--'}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MIDDLE PANEL: Main Chart */}
          <div className="chart-main-area">
            {/* Symbol Selector Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,18,35,0.4)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>Symbol</span>
              <select
                value={straddleSymbol}
                onChange={(e) => {
                  const sym = e.target.value;
                  setStraddleSymbol(sym);
                  setStraddleExpiry('');
                  setStraddleStrike(null);
                  setStraddleAutoAtm(true);
                  setTimeout(() => fetchStraddleData(sym, '', null, straddleTimeframe, true), 50);
                }}
                style={{ flex: 1, maxWidth: '220px', background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <optgroup label="── Indices ──">
                  <option value="NIFTY">NIFTY 50</option>
                  <option value="BANKNIFTY">BANKNIFTY</option>
                  <option value="FINNIFTY">FINNIFTY</option>
                  <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                  <option value="SENSEX">SENSEX</option>
                </optgroup>
                <optgroup label="── Banking ──">
                  <option value="HDFCBANK">HDFCBANK</option>
                  <option value="ICICIBANK">ICICIBANK</option>
                  <option value="SBIN">SBIN</option>
                  <option value="AXISBANK">AXISBANK</option>
                  <option value="KOTAKBANK">KOTAKBANK</option>
                </optgroup>
                <optgroup label="── IT ──">
                  <option value="TCS">TCS</option>
                  <option value="INFY">INFY</option>
                  <option value="HCLTECH">HCLTECH</option>
                  <option value="WIPRO">WIPRO</option>
                </optgroup>
                <optgroup label="── Large Cap ──">
                  <option value="RELIANCE">RELIANCE</option>
                  <option value="ITC">ITC</option>
                  <option value="BHARTIARTL">BHARTIARTL</option>
                  <option value="LT">LT</option>
                  <option value="BAJFINANCE">BAJFINANCE</option>
                  <option value="MARUTI">MARUTI</option>
                  <option value="SUNPHARMA">SUNPHARMA</option>
                  <option value="TATAMOTORS">TATAMOTORS</option>
                  <option value="TATASTEEL">TATASTEEL</option>
                  <option value="M&M">M&M</option>
                </optgroup>
              </select>

              {/* Active symbol badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#14b8a6' }}>{straddleSymbol}</span>
                {straddleData?.underlying_price && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    @ ₹{straddleData.underlying_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                )}
                {straddleData?.strike && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '0 0.4rem' }}>
                    ATM {straddleData.strike}
                  </span>
                )}
              </div>
            </div>

            {/* Header Metrics */}
            <div className="chart-header-metrics">
              <div className="header-metric">
                <span className="header-metric-label">High</span>
                <span className="header-metric-val" style={{ color: 'var(--color-success)' }}>
                  {straddleData?.ticks?.length ? Math.max(...straddleData.ticks.map((t: any) => t.high || t.combined)).toFixed(2) : '--'}
                </span>
              </div>
              <div className="header-metric">
                <span className="header-metric-label">Low</span>
                <span className="header-metric-val" style={{ color: 'var(--color-error)' }}>
                  {straddleData?.ticks?.length ? Math.min(...straddleData.ticks.map((t: any) => t.low || t.combined)).toFixed(2) : '--'}
                </span>
              </div>
              <div className="header-metric">
                <span className="header-metric-label">Current</span>
                <span className="header-metric-val">
                  {straddleData?.ticks?.length ? (straddleData.ticks[straddleData.ticks.length-1].close || straddleData.ticks[straddleData.ticks.length-1].combined).toFixed(2) : '--'}
                </span>
              </div>
              <div className="header-metric">
                <span className="header-metric-label">Day Range</span>
                <span className="header-metric-val">
                  {straddleData?.ticks?.length ? (Math.max(...straddleData.ticks.map((t: any) => t.high || t.combined)) - Math.min(...straddleData.ticks.map((t: any) => t.low || t.combined))).toFixed(2) : '--'}
                </span>
              </div>
              <div className="header-metric">
                <span className="header-metric-label">CE-PE Diff</span>
                <span className="header-metric-val" style={{ color: straddleData?.ticks?.length && straddleData.ticks[straddleData.ticks.length-1].ce_ltp > straddleData.ticks[straddleData.ticks.length-1].pe_ltp ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {straddleData?.ticks?.length ? (straddleData.ticks[straddleData.ticks.length-1].ce_ltp - straddleData.ticks[straddleData.ticks.length-1].pe_ltp).toFixed(2) : '--'}
                </span>
              </div>
              <div className="header-metric">
                <span className="header-metric-label">VWAP</span>
                <span className="header-metric-val">
                  {straddleData?.current_vwap ? straddleData.current_vwap.toFixed(2) : '--'}
                </span>
              </div>
              {/* VWAP Above/Below Badge */}
              {straddleData?.vwap_above !== null && straddleData?.vwap_above !== undefined && (
                <div className="header-metric">
                  <span className="header-metric-label">vs VWAP</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    background: straddleData.vwap_above ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${straddleData.vwap_above ? '#22c55e' : '#ef4444'}`,
                    color: straddleData.vwap_above ? '#22c55e' : '#ef4444',
                  }}>
                    {straddleData.vwap_above ? '▲ ABOVE' : '▼ BELOW'}
                  </span>
                </div>
              )}
              <div className="header-metric" style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                <select
                    value={straddleTimeframe}
                    onChange={(e) => setStraddleTimeframe(Number(e.target.value))}
                    style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                >
                    <option value={1}>1m</option>
                    <option value={5}>5m</option>
                    <option value={15}>15m</option>
                    <option value={60}>1H</option>
                    <option value={1440}>1D</option>
                </select>
                
                {straddleData?.expiry_dates && (
                  <select
                      value={straddleExpiry || ''}
                      onChange={(e) => setStraddleExpiry(e.target.value)}
                      style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                      {straddleData.expiry_dates.map((exp: string) => (
                        <option key={exp} value={exp}>{exp}</option>
                      ))}
                  </select>
                )}

                {straddleData?.available_strikes && (
                  <select
                      value={straddleAutoAtm ? 'auto' : (straddleStrike || '')}
                      onChange={(e) => {
                        if (e.target.value === 'auto') {
                          setStraddleAutoAtm(true);
                          setStraddleStrike(null);
                        } else {
                          setStraddleAutoAtm(false);
                          setStraddleStrike(Number(e.target.value));
                        }
                      }}
                      style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                      <option value="auto">Auto ATM</option>
                      {straddleData.available_strikes.map((strike: number) => (
                        <option key={strike} value={strike}>{strike}</option>
                      ))}
                  </select>
                )}

                <button 
                  onClick={() => fetchStraddleData(straddleSymbol, straddleExpiry, straddleStrike, straddleTimeframe, true)}
                  disabled={straddleLoading}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--color-primary-500)', border: 'none', borderRadius: '4px' }}
                >
                  <RefreshCw size={14} className={straddleLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Chart Area + CE/PE Sub-panel container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

              {/* ── Main Chart ── */}
              <div style={{ flex: '1 1 60%', position: 'relative', minHeight: '280px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, display: 'flex', gap: '1rem', background: 'rgba(15,23,42,0.8)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showStraddlePrice} onChange={e => setShowStraddlePrice(e.target.checked)} />
                    Straddle
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#22c55e', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showSpotPrice} onChange={e => setShowSpotPrice(e.target.checked)} />
                    Spot
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#3b82f6', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showCePrice} onChange={e => setShowCePrice(e.target.checked)} />
                    CE
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#a855f7', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showPePrice} onChange={e => setShowPePrice(e.target.checked)} />
                    PE
                  </label>
                </div>

                {straddleLoading && !straddleData ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <RefreshCw className="animate-spin" size={32} style={{ color: '#14b8a6' }} />
                  </div>
                ) : straddleData && straddleData.ticks ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={straddleData.ticks} margin={{ top: 30, right: 50, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={11} tickMargin={10} minTickGap={30} hide />
                      <YAxis yAxisId="left" domain={['dataMin', 'dataMax']} stroke="#22c55e" fontSize={11} orientation="left" tickFormatter={val => val.toFixed(0)} />
                      <YAxis yAxisId="right" domain={['dataMin', 'dataMax']} stroke="#ef4444" fontSize={11} orientation="right" tickFormatter={val => val.toFixed(0)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '0.8rem' }}
                        labelStyle={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.8rem' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.5rem' }} />
                      {showStraddlePrice && (
                        <Line yAxisId="right" type="monotone" dataKey="close" name="Straddle" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {showSpotPrice && (
                        <Line yAxisId="left" type="monotone" dataKey="spot_price" name="Spot" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                      )}
                      {showCePrice && (
                        <Line yAxisId="right" type="monotone" dataKey="ce_ltp" name="CE" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {showPePrice && (
                        <Line yAxisId="right" type="monotone" dataKey="pe_ltp" name="PE" stroke="#a855f7" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {/* VWAP line on main chart */}
                      <Line yAxisId="right" type="monotone" dataKey="vwap" name="VWAP" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="8 4" dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No data available.
                  </div>
                )}
              </div>

              {/* ── CE / PE Sub-chart panel ── */}
              {straddleData?.ticks && (
                <div style={{
                  flex: '0 0 140px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(10,18,35,0.6)',
                  position: 'relative',
                  padding: '4px 0 0',
                }}>
                  {/* Panel label */}
                  <div style={{ position: 'absolute', top: 4, left: 8, zIndex: 10, display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      CE / PE Movement
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>
                      ● CE&nbsp;
                      {straddleData.ticks.length > 0 && (straddleData.ticks[straddleData.ticks.length - 1].ce_ltp ?? '--')}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#a855f7' }}>
                      ● PE&nbsp;
                      {straddleData.ticks.length > 0 && (straddleData.ticks[straddleData.ticks.length - 1].pe_ltp ?? '--')}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Spread:&nbsp;
                      <span style={{ color: straddleData.ticks[straddleData.ticks.length-1]?.ce_ltp > straddleData.ticks[straddleData.ticks.length-1]?.pe_ltp ? '#22c55e' : '#ef4444' }}>
                        {straddleData.ticks.length > 0
                          ? Math.abs(
                              (straddleData.ticks[straddleData.ticks.length-1].ce_ltp ?? 0) -
                              (straddleData.ticks[straddleData.ticks.length-1].pe_ltp ?? 0)
                            ).toFixed(2)
                          : '--'}
                      </span>
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={straddleData.ticks} margin={{ top: 24, right: 50, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={10} tickMargin={4} minTickGap={30} hide />
                      <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke="rgba(255,255,255,0.2)" fontSize={10} orientation="right" tickFormatter={val => val.toFixed(0)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '0.75rem' }}
                        labelStyle={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                        formatter={(value: any, name: any) => [value != null ? Number(value).toFixed(2) : '0', String(name)]}
                      />
                      <Line type="monotone" dataKey="ce_ltp" name="CE" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                      <Line type="monotone" dataKey="pe_ltp" name="PE" stroke="#a855f7" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── OI Crossover Sub-chart panel ── */}
              {straddleData?.ticks && straddleData.ticks.some((t: any) => t.ce_oi !== undefined) && (
                <div style={{
                  flex: '0 0 140px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(10,18,35,0.6)',
                  position: 'relative',
                  padding: '4px 0 0',
                }}>
                  {/* Panel label */}
                  <div style={{ position: 'absolute', top: 4, left: 8, zIndex: 10, display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      OI Crossover
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#eab308' }}>
                      ● Call OI (Resist):&nbsp;
                      {straddleData.ticks.length > 0 && formatOiNumber(straddleData.ticks[straddleData.ticks.length - 1].ce_oi ?? 0)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6' }}>
                      ● Put OI (Support):&nbsp;
                      {straddleData.ticks.length > 0 && formatOiNumber(straddleData.ticks[straddleData.ticks.length - 1].pe_oi ?? 0)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Trend:&nbsp;
                      {straddleData.ticks.length > 0 && (() => {
                        const lastTick = straddleData.ticks[straddleData.ticks.length - 1];
                        const ceOi = lastTick.ce_oi ?? 0;
                        const peOi = lastTick.pe_oi ?? 0;
                        if (peOi > ceOi) {
                          return <span style={{ color: '#22c55e', fontWeight: 700 }}>🟢 BULLISH SUPPORT (Puts &gt; Calls)</span>;
                        } else if (ceOi > peOi) {
                          return <span style={{ color: '#ef4444', fontWeight: 700 }}>🔴 BEARISH RESISTANCE (Calls &gt; Puts)</span>;
                        }
                        return <span style={{ color: 'var(--text-muted)' }}>NEUTRAL</span>;
                      })()}
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={straddleData.ticks} margin={{ top: 24, right: 50, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={10} tickMargin={4} minTickGap={30} />
                      <YAxis domain={['dataMin', 'dataMax']} stroke="rgba(255,255,255,0.2)" fontSize={10} orientation="right" tickFormatter={val => formatOiNumber(val)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '0.75rem' }}
                        labelStyle={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                        formatter={(value: any, name: any) => [formatOiNumber(Number(value || 0)), String(name)]}
                      />
                      <Line type="monotone" dataKey="ce_oi" name="Call OI" stroke="#eab308" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                      <Line type="monotone" dataKey="pe_oi" name="Put OI" stroke="#8b5cf6" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT PANEL: Option Chain */}
          <div className="option-chain-sidebar">
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', textAlign: 'center' }}>Option Chain</h4>
            <table className="option-chain-table">
              <thead>
                <tr>
                  <th className="ce-header">Calls</th>
                  <th>Strike</th>
                  <th className="pe-header">Puts</th>
                  <th>Straddle</th>
                </tr>
              </thead>
              <tbody>
                {straddleData?.strikes ? (
                  straddleData.strikes
                    .filter((s: any) => Math.abs(s.strike - straddleData.strike) <= (straddleData.available_strikes[1] - straddleData.available_strikes[0]) * 5)
                    .map((s: any) => {
                      const ceLtp = s.CE?.ltp || 0;
                      const peLtp = s.PE?.ltp || 0;
                      const straddleCombined = ceLtp + peLtp;
                      const isAtm = s.strike === straddleData.strike;
                      
                      return (
                        <tr key={s.strike} className={isAtm ? 'atm-row' : ''}>
                          <td style={{ color: 'var(--text-main)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{ceLtp.toFixed(2)}</td>
                          <td className="strike-cell" style={{ background: isAtm ? 'rgba(234, 179, 8, 0.2)' : undefined, color: isAtm ? '#facc15' : undefined }}>{s.strike}</td>
                          <td style={{ color: 'var(--text-main)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>{peLtp.toFixed(2)}</td>
                          <td style={{ fontWeight: 600, color: isAtm ? '#facc15' : 'var(--text-main)' }}>{straddleCombined.toFixed(2)}</td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>Load a symbol to view chain.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'oi_crossover_scanner' && (
        <main className="full-width-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HEADER STRATEGY BANNER */}
          <div className="card" style={{ padding: '1.2rem 1.5rem', borderLeft: '4px solid #0284c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 OI Crossover Scanner — Indian Index Options
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Scanning NIFTY, BANKNIFTY, FINNIFTY, and MIDCPNIFTY option chains for support/resistance crossover zones, PCR readings, Max Pain, and fresh OI builds.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>LAST SCANNED</span>
                <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>{oiCrossoverTimestamp || 'Never'}</span>
              </div>
              <button
                className="primary"
                onClick={runOiCrossoverScan}
                disabled={oiCrossoverScanning}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(90deg, #0284c7, #0369a1)' }}
              >
                {oiCrossoverScanning ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                {oiCrossoverScanning ? 'Scanning...' : 'Run Scan'}
              </button>
            </div>
          </div>

          {/* STATUS TRACKER */}
          {oiCrossoverScanning && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <RefreshCw className="animate-spin" size={32} style={{ color: '#0284c7', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'white' }}>Scanning Indian Index Option Chains...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Fetching live-to-EOD contracts from NSE/BSE</p>
            </div>
          )}

          {!oiCrossoverScanning && oiCrossoverResults.length > 0 && (
            <>
              {/* MAIN METRICS COMPARISON TABLE */}
              <div className="card" style={{ padding: '1.2rem', overflowX: 'auto' }}>
                <h3 className="card-title" style={{ marginBottom: '1rem' }}>📈 Index Crossover Comparison</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Index</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Spot Price</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>ATM Strike</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>PCR</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>PCR Read</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Max Pain</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Crossover Zone</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total Calls / Puts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oiCrossoverResults.map((res) => {
                      const pcrColor = res.pcr_read === 'Bullish Tilt' ? '#22c55e' : res.pcr_read === 'Bearish Tilt' ? '#ef4444' : '#38bdf8';
                      return (
                        <tr key={res.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'white' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{res.index}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'JetBrains Mono' }}>{res.spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{res.atm}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'JetBrains Mono' }}>{res.pcr.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: pcrColor, fontWeight: 700 }}>{res.pcr_read}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{res.max_pain}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#fbbf24', fontWeight: 700 }}>{res.crossover_zone}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                            <span style={{ color: '#eab308' }}>{formatOiNumber(res.total_call_oi)}</span> / <span style={{ color: '#8b5cf6' }}>{formatOiNumber(res.total_put_oi)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SAME-SESSION FRESH OI BUILD CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
                {oiCrossoverResults.map((res) => (
                  <div key={res.index} className="card" style={{ padding: '1.2rem', borderTop: '4px solid #3b82f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>🔥 {res.index} builds</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{res.expiry} Expiry</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                      <div style={{ background: 'rgba(234,179,8,0.06)', borderLeft: '3px solid #eab308', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                        <div style={{ color: '#eab308', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Largest Call Add (Resistance Build)</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', color: 'white' }}>
                          <span style={{ fontWeight: 600 }}>Strike {res.fresh_call_strike}</span>
                          <strong style={{ color: '#facc15' }}>+{formatOiNumber(res.fresh_call_oi)} OI</strong>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(139,92,246,0.06)', borderLeft: '3px solid #8b5cf6', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                        <div style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Largest Put Add (Support Build)</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', color: 'white' }}>
                          <span style={{ fontWeight: 600 }}>Strike {res.fresh_put_strike}</span>
                          <strong style={{ color: '#a78bfa' }}>+{formatOiNumber(res.fresh_put_oi)} OI</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DATA QUALITY NOTES AND CAVEATS */}
              <div className="card" style={{ padding: '1.2rem', background: 'rgba(15,23,42,0.4)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ CAVEATS & DATA QUALITY</h4>
                <ul style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1.2rem' }}>
                  <li><strong>Snapshot Timing</strong>: Scan represents EOD snapshots or live option chains depending on exchange hours. Always verify timestamps before basing decisions.</li>
                  <li><strong>Window Limitation</strong>: Crossover zones are computed from the fetched strikes window around ATM (±10 strikes). Substantial OI changes outside this window are not captured in the zone.</li>
                  <li><strong>Liquidity Caveat</strong>: Thinner contracts (FINNIFTY, MIDCPNIFTY) are noisier. Single-strike updates are structurally less significant than NIFTY or BANKNIFTY.</li>
                  <li><strong>No Strategy Recommendation</strong>: This dashboard represents purely descriptive open interest positioning structure, not directional trading forecasts.</li>
                </ul>
              </div>
            </>
          )}

          {!oiCrossoverScanning && oiCrossoverResults.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Sliders size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'white' }}>No Scan Executed</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.3rem 0 1.2rem' }}>Initiate the scanner to compile OI crossover positioning diagnostics.</p>
              <button className="primary" onClick={runOiCrossoverScan} style={{ padding: '0.5rem 1.2rem' }}>Run Scan Now</button>
            </div>
          )}

        </main>
      )}

      {activeTab === 'vcp' && (
        <main className="full-width-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HEADER STRATEGY BANNER */}
          <div className="card" style={{ padding: '1.2rem 1.5rem', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 Minervini Growth Stock Strategy — Stage 2 &amp; VCP Scanner
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                8-Block Pine Script v6 Engine: Trend Template, VCP Contraction, Trigger Bar, Breakout, Risk Levels (Stop / 3R Target), Base Counter, 91% Market Filter, &amp; Code 3.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <select
                value={vcpUniverse}
                onChange={(e: any) => setVcpUniverse(e.target.value)}
                style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.5rem 0.8rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="nifty_50">Nifty 50 (Bluechips)</option>
                <option value="nifty_200">Liquid F&amp;O Universe (200)</option>
                <option value="midcap">Nifty Midcap 150</option>
                <option value="smallcap">Nifty Smallcap 250</option>
                <option value="custom">Custom Tickers</option>
              </select>

              <button
                className="outline"
                onClick={() => setVcpShowSettings(!vcpShowSettings)}
                style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', fontWeight: 600, borderColor: 'var(--border-color)', color: vcpShowSettings ? '#10b981' : 'white' }}
              >
                ⚙️ {vcpShowSettings ? 'Hide Config' : 'Scan Config'}
              </button>

              <button
                className="outline"
                onClick={() => exportVcpData('csv')}
                disabled={vcpCandidates.length === 0}
                style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', fontWeight: 600, borderColor: 'var(--border-color)', color: 'white' }}
                title="Export results to CSV"
              >
                📥 CSV
              </button>

              <button
                className="primary"
                onClick={runVcpScan}
                disabled={vcpScanning}
                style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(90deg, #10b981, #059669)' }}
              >
                {vcpScanning ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                {vcpScanning ? `Scanning (${vcpProgress}%)...` : 'Run Minervini Scan'}
              </button>
            </div>
          </div>

          {/* CUSTOM TICKERS INPUT ROW (IF CUSTOM UNIVERSE SELECTED) */}
          {vcpUniverse === 'custom' && (
            <div className="card" style={{ padding: '0.8rem 1.2rem', background: '#0b1329', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Custom Tickers (comma-separated, e.g. RELIANCE, TCS, INFY, DIXON, PERSISTENT):
              </label>
              <input
                type="text"
                value={vcpCustomTickers}
                onChange={(e) => setVcpCustomTickers(e.target.value)}
                placeholder="RELIANCE, TCS, INFY, HDFCBANK, DIXON"
                style={{ width: '100%', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {/* CONFIGURATION DRAWER */}
          {vcpShowSettings && (
            <div className="card" style={{ padding: '1.2rem', background: '#0b1329', border: '1px solid rgba(255,255,255,0.1)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Min RS Percentile: <strong style={{ color: '#10b981' }}>{vcpRsMinRating}th</strong>
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={vcpRsMinRating}
                  onChange={(e) => setVcpRsMinRating(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Min VCP Contractions: <strong style={{ color: '#38bdf8' }}>{vcpMinContractions}</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={vcpMinContractions}
                  onChange={(e) => setVcpMinContractions(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Contraction Tol: <strong style={{ color: '#fbbf24' }}>{vcpContractionTol}</strong>
                </label>
                <input
                  type="range"
                  min="0.75"
                  max="0.98"
                  step="0.01"
                  value={vcpContractionTol}
                  onChange={(e) => setVcpContractionTol(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Breakout Vol Surge: <strong style={{ color: '#a855f7' }}>{vcpBreakoutVolMult}x</strong>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.1"
                  value={vcpBreakoutVolMult}
                  onChange={(e) => setVcpBreakoutVolMult(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  R-Multiple Target: <strong style={{ color: '#22c55e' }}>{vcpRMultipleTarget}R</strong>
                </label>
                <input
                  type="range"
                  min="1.5"
                  max="5.0"
                  step="0.5"
                  value={vcpRMultipleTarget}
                  onChange={(e) => setVcpRMultipleTarget(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={vcpUseMarketFilter}
                    onChange={(e) => setVcpUseMarketFilter(e.target.checked)}
                  />
                  <span>Market Filter (91% Rule — Monthly EMA10)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={vcpEnableCode3}
                    onChange={(e) => setVcpEnableCode3(e.target.checked)}
                  />
                  <span>Code 3 Fundamentals (EPS &amp; Margin)</span>
                </label>
              </div>
            </div>
          )}

          {/* STATUS TRACKER */}
          {vcpScanning && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <RefreshCw className="animate-spin" size={36} style={{ color: '#10b981', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.2rem', color: 'white' }}>{vcpStatusMsg}</h3>
              <div style={{ width: '100%', maxWidth: '400px', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', margin: '1rem auto', overflow: 'hidden' }}>
                <div style={{ width: `${vcpProgress}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.3s ease' }}></div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progress: {vcpProgress}%</p>
            </div>
          )}

          {!vcpScanning && vcpCandidates.length > 0 && (
            <>
              {/* METRICS & FILTER RIBBON */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ background: '#1e293b', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Scanned: </span>
                    <strong style={{ color: 'white' }}>{vcpMetadata?.total_scanned || vcpCandidates.length}</strong>
                  </div>
                  <div style={{ background: '#1e293b', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Setups: </span>
                    <strong style={{ color: '#38bdf8' }}>{vcpCandidates.length}</strong>
                  </div>
                  <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#22c55e' }}>⚡ ALL SYSTEMS GO: </span>
                    <strong style={{ color: '#22c55e' }}>
                      {vcpCandidates.filter(c => c.long_condition || c.entry_today).length}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <button
                      onClick={() => setVcpOnlySignals(false)}
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, background: !vcpOnlySignals ? '#10b981' : '#111827', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      All Setups ({vcpCandidates.length})
                    </button>
                    <button
                      onClick={() => setVcpOnlySignals(true)}
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, background: vcpOnlySignals ? '#10b981' : '#111827', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      ⚡ Signals Only ({vcpCandidates.filter(c => c.long_condition || c.entry_today).length})
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={vcpFilter}
                  onChange={(e) => setVcpFilter(e.target.value)}
                  style={{ background: '#111827', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '180px' }}
                />
              </div>

              {/* CANDIDATES TABLE */}
              <div className="card" style={{ padding: '1.2rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Symbol</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Signal</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Close</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Risk Stop</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Target (3R)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Stage 2</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>VCP Valid</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Trigger</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Breakout</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Base #</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>RS Percentile</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vcpCandidates
                      .filter((c) => {
                        if (!c || !c.symbol) return false;
                        if (vcpOnlySignals && !c.long_condition && !c.entry_today) return false;
                        if (vcpFilter && !String(c.symbol).toLowerCase().includes(vcpFilter.toLowerCase())) return false;
                        return true;
                      })
                      .map((cand) => {
                        const isAllSystemsGo = Boolean(cand.long_condition || cand.entry_today);
                        const closePrice = typeof cand.close === 'number' ? cand.close.toFixed(2) : (cand.close || '0.00');
                        const rsVal = cand.rs_percentile ?? 0;

                        return (
                          <tr
                            key={cand.symbol}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: isAllSystemsGo ? 'rgba(34,197,94,0.06)' : undefined,
                              color: 'white'
                            }}
                          >
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{cand.symbol}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cand.as_of || 'Latest'}</div>
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              {isAllSystemsGo ? (
                                <span style={{
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  background: 'linear-gradient(90deg, #10b981, #059669)',
                                  color: 'white',
                                  boxShadow: '0 0 12px rgba(16,185,129,0.4)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}>
                                  ⚡ ALL SYSTEMS GO
                                </span>
                              ) : (
                                <span style={{ padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                  SETUP
                                </span>
                              )}
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                              ₹{closePrice}
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'JetBrains Mono' }}>
                              {cand.stop_level ? (
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>₹{cand.stop_level}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'JetBrains Mono' }}>
                              {cand.target_level ? (
                                <span style={{ color: '#22c55e', fontWeight: 700 }}>₹{cand.target_level}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: cand.stage2 || cand.trend_template ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                color: cand.stage2 || cand.trend_template ? '#22c55e' : '#ef4444'
                              }}>
                                {cand.stage2 || cand.trend_template ? 'YES' : 'NO'}
                              </span>
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: cand.vcp_valid ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.05)',
                                color: cand.vcp_valid ? '#38bdf8' : 'var(--text-muted)'
                              }}>
                                {cand.vcp_valid ? 'VALID' : 'NO'}
                              </span>
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: cand.trigger_recent ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                                color: cand.trigger_recent ? '#fbbf24' : 'var(--text-muted)'
                              }}>
                                {cand.trigger_recent ? 'RECENT' : 'NO'}
                              </span>
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              {cand.breakout ? (
                                <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}>
                                  🚀 BREAKOUT
                                </span>
                              ) : cand.pivot_price ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                                  Piv: ₹{cand.pivot_price}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{
                                color: cand.late_stage ? '#ef4444' : 'white',
                                fontWeight: cand.late_stage ? 800 : 500
                              }}>
                                #{cand.base_counter ?? 0} {cand.late_stage ? '⚠️ Late' : ''}
                              </span>
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'JetBrains Mono', fontWeight: 700, color: rsVal >= 70 ? '#22c55e' : '#fbbf24' }}>
                              {rsVal}th
                            </td>

                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                <button
                                  className="outline"
                                  onClick={() => openVcpChartModal(cand.symbol)}
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderColor: '#38bdf8', color: '#38bdf8' }}
                                  title="View Candlestick Chart with 10 EMA & 50/150/200 SMAs"
                                >
                                  📊 Chart
                                </button>
                                <button
                                  className="outline"
                                  onClick={() => openVcpChecklistModal(cand.symbol)}
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderColor: '#10b981', color: '#10b981' }}
                                  title="Inspect 8-block criteria & historical backtest"
                                >
                                  📋 Checklist
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!vcpScanning && vcpCandidates.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Sliders size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'white' }}>No Minervini Scan Executed</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.3rem 0 1.2rem' }}>
                Select a universe above and initiate the scanner to evaluate Stage 2 Trend Template, VCP contractions, and breakout entry signals.
              </p>
              <button className="primary" onClick={runVcpScan} style={{ padding: '0.5rem 1.4rem', background: 'linear-gradient(90deg, #10b981, #059669)' }}>
                Run Minervini Scan Now
              </button>
            </div>
          )}

          {/* DETAILED CHECKLIST & BACKTEST MODAL DRAWER */}
          {vcpSelectedCandidate && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
              <div style={{ background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', color: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                    🏆 Minervini Diagnostics — {vcpSelectedCandidate}
                  </h3>
                  <button
                    onClick={() => setVcpSelectedCandidate(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>

                {/* MODAL TABS */}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.2rem' }}>
                  <button
                    className={vcpModalTab === 'backtest' ? 'primary' : 'outline'}
                    onClick={() => {
                      setVcpModalTab('backtest');
                      if (!vcpBacktestData) runVcpBacktest(vcpSelectedCandidate!);
                    }}
                    style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    📋 Checklist &amp; Backtest
                  </button>
                  <button
                    className={vcpModalTab === 'chart' ? 'primary' : 'outline'}
                    onClick={() => {
                      setVcpModalTab('chart');
                      if (!vcpChartData || vcpChartData.symbol !== vcpSelectedCandidate) {
                        runVcpChartData(vcpSelectedCandidate!, vcpChartPeriod);
                      }
                    }}
                    style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    📊 Candlestick Chart
                  </button>
                </div>

                {/* TAB 1: BACKTEST & CHECKLIST */}
                {vcpModalTab === 'backtest' && (
                  <div>
                    {/* ACTIVE CANDIDATE 8-BLOCK CRITERIA SNAPSHOT */}
                    {(() => {
                      const selCand = vcpCandidates.find(c => c.symbol === vcpSelectedCandidate);
                      if (!selCand) return null;
                      const cl = selCand.checklist || {};
                      return (
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h4 style={{ fontSize: '0.95rem', color: '#10b981', fontWeight: 800 }}>
                              🎯 8-Block Minervini Scanner Criteria Snapshot
                            </h4>
                            <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.8rem', fontFamily: 'JetBrains Mono' }}>
                              <span>Close: <strong style={{ color: 'white' }}>₹{selCand.close}</strong></span>
                              {selCand.stop_level && <span>Stop: <strong style={{ color: '#ef4444' }}>₹{selCand.stop_level}</strong></span>}
                              {selCand.target_level && <span>Target: <strong style={{ color: '#22c55e' }}>₹{selCand.target_level}</strong></span>}
                              <span>Base: <strong style={{ color: selCand.late_stage ? '#ef4444' : '#fbbf24' }}>#{selCand.base_counter ?? 0}</strong></span>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>1. Stage 2 Trend Template</span>
                              <strong style={{ color: cl.trend_template || selCand.stage2 ? '#22c55e' : '#ef4444' }}>
                                {cl.trend_template || selCand.stage2 ? '✓ PASS' : '✗ FAIL'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>2. VCP Shrinking Pullbacks</span>
                              <strong style={{ color: cl.vcp_valid || selCand.vcp_valid ? '#38bdf8' : '#ef4444' }}>
                                {cl.vcp_valid || selCand.vcp_valid ? '✓ VALID' : '✗ NO'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>3. Trigger Bar (Recent)</span>
                              <strong style={{ color: cl.trigger_recent || selCand.trigger_recent ? '#fbbf24' : 'var(--text-muted)' }}>
                                {cl.trigger_recent || selCand.trigger_recent ? '✓ YES (<= 10 bars)' : 'NO'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>4. Pivot Breakout</span>
                              <strong style={{ color: cl.breakout || selCand.breakout ? '#c084fc' : 'var(--text-muted)' }}>
                                {cl.breakout || selCand.breakout ? '🚀 BREAKOUT' : (selCand.pivot_price ? `Pivot: ₹${selCand.pivot_price}` : 'NO')}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>5. Risk / Reward Target</span>
                              <strong style={{ color: selCand.stop_level ? '#22c55e' : 'var(--text-muted)' }}>
                                {selCand.stop_level ? `3.0R Target: ₹${selCand.target_level}` : 'Pending Breakout'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>6. Base Stage Counter</span>
                              <strong style={{ color: selCand.late_stage ? '#ef4444' : '#22c55e' }}>
                                #{selCand.base_counter ?? 0} {selCand.late_stage ? '(Late Stage >= 4)' : '(Early Base)'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>7. Market 91% Rule</span>
                              <strong style={{ color: cl.market_ok !== false ? '#22c55e' : '#ef4444' }}>
                                {cl.market_ok !== false ? '✓ BULL (Nifty > 10 EMA)' : '✗ BEAR'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>8. RS Rating Percentile</span>
                              <strong style={{ color: (selCand.rs_percentile ?? 0) >= 70 ? '#22c55e' : '#fbbf24' }}>
                                {selCand.rs_percentile ?? 0}th Percentile
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {vcpBacktestLoading && (
                      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <RefreshCw className="animate-spin" size={28} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Running bar-by-bar backtest simulation...</p>
                      </div>
                    )}

                    {!vcpBacktestLoading && vcpBacktestData && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                        {/* PERFORMANCE SUMMARY STATS */}
                        {vcpBacktestData.summary && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.8rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL TRADES</span>
                              <strong style={{ fontSize: '1.1rem', color: 'white' }}>{vcpBacktestData.summary.trades || 0}</strong>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>WIN RATE</span>
                              <strong style={{ fontSize: '1.1rem', color: '#22c55e' }}>{vcpBacktestData.summary.win_rate_pct || 0}%</strong>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>PROFIT FACTOR</span>
                              <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{vcpBacktestData.summary.profit_factor || 0}</strong>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>AVG R-MULTIPLE</span>
                              <strong style={{ fontSize: '1.1rem', color: '#fbbf24' }}>{vcpBacktestData.summary.avg_r_multiple || 0}R</strong>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>MAX DRAWDOWN</span>
                              <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>{vcpBacktestData.summary.max_drawdown_pct || 0}%</strong>
                            </div>
                          </div>
                        )}

                        {/* TRADE HISTORY LOG TABLE */}
                        {vcpBacktestData.trades && vcpBacktestData.trades.length > 0 && (
                          <div style={{ overflowX: 'auto' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>📜 Trade Execution Log</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                                  <th style={{ padding: '0.4rem' }}>Entry Date</th>
                                  <th style={{ padding: '0.4rem' }}>Entry Price</th>
                                  <th style={{ padding: '0.4rem' }}>Stop Level</th>
                                  <th style={{ padding: '0.4rem' }}>Exit Date</th>
                                  <th style={{ padding: '0.4rem' }}>Exit Price</th>
                                  <th style={{ padding: '0.4rem' }}>Reason</th>
                                  <th style={{ padding: '0.4rem' }}>PnL</th>
                                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>R-Multiple</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vcpBacktestData.trades.map((t: any, idx: number) => {
                                  const isWin = (t.pnl || 0) > 0;
                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <td style={{ padding: '0.4rem' }}>{t.entry_date}</td>
                                      <td style={{ padding: '0.4rem' }}>₹{t.entry_price}</td>
                                      <td style={{ padding: '0.4rem', color: '#ef4444' }}>₹{t.stop_level}</td>
                                      <td style={{ padding: '0.4rem' }}>{t.exit_date}</td>
                                      <td style={{ padding: '0.4rem' }}>₹{t.exit_price}</td>
                                      <td style={{ padding: '0.4rem', color: 'var(--text-muted)' }}>{t.exit_reason}</td>
                                      <td style={{ padding: '0.4rem', color: isWin ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                                        ₹{t.pnl?.toLocaleString()}
                                      </td>
                                      <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, color: isWin ? '#22c55e' : '#ef4444' }}>
                                        {t.r_multiple}R
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: CANDLESTICK CHART */}
                {vcpModalTab === 'chart' && (
                  <div>
                    {vcpChartLoading && (
                      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <RefreshCw className="animate-spin" size={28} style={{ color: '#38bdf8', marginBottom: '0.5rem' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching daily candlestick and moving average data for {vcpSelectedCandidate}...</p>
                      </div>
                    )}

                    {!vcpChartLoading && vcpChartData && vcpChartData.candles && (
                      <div>
                        {renderVcpCandlestickChart(vcpChartData.candles)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      )}

      {activeTab === 'backtest_lab' && (
        <main className="full-width-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HEADER STRATEGY BANNER */}
          <div className="card" style={{ padding: '1.4rem 1.6rem', borderLeft: '4px solid #6366f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🧪</span> VectorBT Backtest Lab &amp; Performance Tearsheets
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem', maxWidth: '850px' }}>
                5-Year historical daily backtest across NSE Assets (NIFTY, BANKNIFTY, RELIANCE) and Option Strategies with Stop-Loss, Take-Profit, and NIFTY 200 SMA Market-Regime filters.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>LAST SIMULATION RUN</span>
                <span style={{ fontSize: '0.85rem', color: '#a5b4fc', fontWeight: 600 }}>{backtestSummary?.updated_at || 'Ready'}</span>
              </div>
              <button
                className="primary"
                onClick={triggerBacktestRun}
                disabled={backtestLoading}
                style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}
              >
                {backtestLoading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                {backtestLoading ? 'Running VectorBT...' : 'Re-Run Backtests'}
              </button>
            </div>
          </div>

          {/* STATUS TRACKER IF RUNNING */}
          {backtestLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <RefreshCw className="animate-spin" size={36} style={{ color: '#818cf8', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.15rem', color: 'white', fontWeight: 700 }}>Running VectorBT Portfolio Simulations...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Executing 21 strategy-asset iterations, calculating QuantStats tearsheets, underwater drawdowns, and monthly return matrices.
              </p>
            </div>
          )}

          {/* COMBINED MULTI-ASSET PORTFOLIO SPOTLIGHT */}
          {backtestSummary?.portfolio && (
            <div className="card" style={{ padding: '1.4rem', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'radial-gradient(ellipse at top right, rgba(99, 102, 241, 0.15), rgba(15, 23, 42, 0.8))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={20} style={{ color: '#fbbf24' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>Multi-Strategy Combined Portfolio</h3>
                    <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      🛡️ Max DD 6.08%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Blended allocation: 45% BankNifty, 35% Nifty, 20% Reliance | 35% Elder Impulse, 30% High Momentum, 20% VCP, 10% Iron Condor, 5% Breakout
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => setSelectedTearsheet({ title: 'Combined Multi-Strategy Portfolio', report: 'PORTFOLIO_Combined_tearsheet.html' })}
                  style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#3b82f6' }}
                >
                  <ExternalLink size={15} /> Open Portfolio Tearsheet
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.8rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL RETURN</span>
                  <strong style={{ fontSize: '1.2rem', color: '#34d399' }}>+{backtestSummary.portfolio.metrics.total_return}%</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>CAGR</span>
                  <strong style={{ fontSize: '1.2rem', color: '#38bdf8' }}>{backtestSummary.portfolio.metrics.cagr}%</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>SHARPE RATIO</span>
                  <strong style={{ fontSize: '1.2rem', color: '#a78bfa' }}>{backtestSummary.portfolio.metrics.sharpe}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>SORTINO RATIO</span>
                  <strong style={{ fontSize: '1.2rem', color: '#a78bfa' }}>{backtestSummary.portfolio.metrics.sortino}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>MAX DRAWDOWN</span>
                  <strong style={{ fontSize: '1.2rem', color: '#f87171' }}>-{backtestSummary.portfolio.metrics.max_dd}%</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>ANN. VOLATILITY</span>
                  <strong style={{ fontSize: '1.2rem', color: '#fbbf24' }}>{backtestSummary.portfolio.metrics.volatility}%</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>BETA VS NIFTY</span>
                  <strong style={{ fontSize: '1.2rem', color: '#cbd5e1' }}>{backtestSummary.portfolio.metrics.beta}</strong>
                </div>
              </div>
            </div>
          )}

          {/* FILTER & STRATEGY PERFORMANCE MATRIX */}
          <div className="card" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart2 size={18} style={{ color: '#38bdf8' }} /> Strategy Performance Matrix (21 Backtests)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click any column header to sort. Click View Tearsheet to examine equity curve &amp; heatmap.</span>
              </div>

              {/* ASSET FILTER TABS */}
              <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {['ALL', 'NIFTY', 'BANKNIFTY', 'RELIANCE'].map(asset => (
                  <button
                    key={asset}
                    onClick={() => setBacktestAssetFilter(asset)}
                    style={{
                      padding: '0.3rem 0.8rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: backtestAssetFilter === asset ? '#6366f1' : 'transparent',
                      color: backtestAssetFilter === asset ? 'white' : 'var(--text-muted)'
                    }}
                  >
                    {asset}
                  </button>
                ))}
              </div>
            </div>

            {/* PERFORMANCE TABLE */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Asset</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Strategy</th>
                    <th 
                      onClick={() => { setBacktestSortField('Total_Return_Pct'); setBacktestSortAsc(!backtestSortAsc); }}
                      style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }}
                    >
                      Total Return {backtestSortField === 'Total_Return_Pct' ? (backtestSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th 
                      onClick={() => { setBacktestSortField('CAGR_Pct'); setBacktestSortAsc(!backtestSortAsc); }}
                      style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }}
                    >
                      CAGR {backtestSortField === 'CAGR_Pct' ? (backtestSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th 
                      onClick={() => { setBacktestSortField('Sharpe_Ratio'); setBacktestSortAsc(!backtestSortAsc); }}
                      style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }}
                    >
                      Sharpe {backtestSortField === 'Sharpe_Ratio' ? (backtestSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th 
                      onClick={() => { setBacktestSortField('Sortino_Ratio'); setBacktestSortAsc(!backtestSortAsc); }}
                      style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }}
                    >
                      Sortino {backtestSortField === 'Sortino_Ratio' ? (backtestSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th 
                      onClick={() => { setBacktestSortField('Max_Drawdown_Pct'); setBacktestSortAsc(!backtestSortAsc); }}
                      style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }}
                    >
                      Max DD {backtestSortField === 'Max_Drawdown_Pct' ? (backtestSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Win Rate</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Trades</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Risk Limits</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Interactive Report</th>
                  </tr>
                </thead>
                <tbody>
                  {backtestSummary?.strategies
                    ?.filter((item: any) => backtestAssetFilter === 'ALL' || item.Asset === backtestAssetFilter)
                    ?.sort((a: any, b: any) => {
                      const valA = a[backtestSortField] ?? 0;
                      const valB = b[backtestSortField] ?? 0;
                      return backtestSortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
                    })
                    ?.map((row: any, idx: number) => {
                      const isPositive = (row.Total_Return_Pct || 0) >= 0;
                      const sharpeColor = (row.Sharpe_Ratio || 0) >= 0.7 ? '#22c55e' : (row.Sharpe_Ratio || 0) >= 0.3 ? '#38bdf8' : (row.Sharpe_Ratio || 0) < 0 ? '#ef4444' : '#fbbf24';
                      
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                              {row.Asset}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'white' }}>
                            {row.Strategy.replace(/_/g, ' ')}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: isPositive ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                            {row.Total_Return_Pct > 0 ? `+${row.Total_Return_Pct}%` : `${row.Total_Return_Pct}%`}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: (row.CAGR_Pct || 0) >= 0 ? '#38bdf8' : '#ef4444', fontWeight: 600 }}>
                            {row.CAGR_Pct > 0 ? `+${row.CAGR_Pct}%` : `${row.CAGR_Pct}%`}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span style={{ color: sharpeColor, fontWeight: 700, background: `${sharpeColor}15`, padding: '2px 6px', borderRadius: '4px' }}>
                              {row.Sharpe_Ratio?.toFixed(2)}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {row.Sortino_Ratio?.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#f87171', fontWeight: 600 }}>
                            -{row.Max_Drawdown_Pct}%
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#cbd5e1' }}>
                            {row.Win_Rate_Pct}%
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)' }}>
                            {row.Total_Trades}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {row.SL_Pct ? `SL ${(row.SL_Pct * 100).toFixed(0)}%` : 'No SL'}
                            {row.TP_Pct ? ` | TP ${(row.TP_Pct * 100).toFixed(0)}%` : ''}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedTearsheet({
                                title: `${row.Asset} — ${row.Strategy.replace(/_/g, ' ')}`,
                                asset: row.Asset,
                                strategy: row.Strategy
                              })}
                              style={{
                                padding: '0.25rem 0.65rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <ExternalLink size={12} /> Tearsheet
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SHARPE RATIO HEATMAP MATRIX (STRATEGY × ASSET) */}
          <div className="card" style={{ padding: '1.2rem' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Layers size={18} style={{ color: '#a855f7' }} /> Sharpe Ratio Heatmap Matrix (Strategy × Asset)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Strategy</th>
                    <th style={{ padding: '0.6rem' }}>NIFTY</th>
                    <th style={{ padding: '0.6rem' }}>BANKNIFTY</th>
                    <th style={{ padding: '0.6rem' }}>RELIANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    'VCP_Breakout',
                    'NDay_High_Breakout',
                    'High_Momentum',
                    'Bull_Call_Spread',
                    'Elder_Impulse',
                    'Iron_Condor',
                    'Max_Pain_Straddle'
                  ].map((strat, idx) => {
                    const getNifty = backtestSummary?.strategies?.find((s: any) => s.Asset === 'NIFTY' && s.Strategy === strat);
                    const getBanknifty = backtestSummary?.strategies?.find((s: any) => s.Asset === 'BANKNIFTY' && s.Strategy === strat);
                    const getReliance = backtestSummary?.strategies?.find((s: any) => s.Asset === 'RELIANCE' && s.Strategy === strat);

                    const renderPill = (item: any) => {
                      if (!item) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                      const sh = item.Sharpe_Ratio || 0;
                      const bg = sh >= 0.7 ? 'rgba(34, 197, 94, 0.25)' : sh >= 0.4 ? 'rgba(56, 189, 248, 0.2)' : sh >= 0 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                      const fg = sh >= 0.7 ? '#4ade80' : sh >= 0.4 ? '#38bdf8' : sh >= 0 ? '#facc15' : '#f87171';
                      return (
                        <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', display: 'inline-block' }}>
                          {sh.toFixed(2)} ({item.Total_Return_Pct > 0 ? `+${item.Total_Return_Pct}%` : `${item.Total_Return_Pct}%`})
                        </span>
                      );
                    };

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.6rem', textAlign: 'left', fontWeight: 600, color: 'white' }}>
                          {strat.replace(/_/g, ' ')}
                        </td>
                        <td style={{ padding: '0.6rem' }}>{renderPill(getNifty)}</td>
                        <td style={{ padding: '0.6rem' }}>{renderPill(getBanknifty)}</td>
                        <td style={{ padding: '0.6rem' }}>{renderPill(getReliance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      )}

      {/* INTERACTIVE TEARSHEET MODAL */}
      {selectedTearsheet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#0a0f1e',
            border: '1px solid #1e2d4a',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '1350px',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* MODAL HEADER */}
            <div style={{
              padding: '0.8rem 1.2rem',
              borderBottom: '1px solid #1e2d4a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#111827'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📈</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', margin: 0 }}>
                  {selectedTearsheet.title} — QuantStats Performance Tearsheet
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <a
                  href={selectedTearsheet.report 
                    ? `/api/backtest/tearsheet?report=${selectedTearsheet.report}` 
                    : `/api/backtest/tearsheet?asset=${selectedTearsheet.asset}&strategy=${selectedTearsheet.strategy}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    textDecoration: 'none',
                    padding: '0.3rem 0.6rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px'
                  }}
                >
                  <ExternalLink size={13} /> Open in New Tab
                </a>
                <button
                  onClick={() => setSelectedTearsheet(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* MODAL BODY (IFRAME) */}
            <div style={{ flex: 1, position: 'relative', background: '#0a0f1e' }}>
              <iframe
                src={selectedTearsheet.report 
                  ? `/api/backtest/tearsheet?report=${selectedTearsheet.report}` 
                  : `/api/backtest/tearsheet?asset=${selectedTearsheet.asset}&strategy=${selectedTearsheet.strategy}`}
                title="Performance Tearsheet"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#0a0f1e'
                }}
              />
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}



