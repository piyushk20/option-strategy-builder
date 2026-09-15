import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  X, 
  ExternalLink, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Layers,
  ArrowRight,
  BarChart2,
  Sliders,
  RefreshCw,
  Info
} from 'lucide-react';
import type { OHLRecord } from './OhlScannerView';

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  ema9?: number;
}

interface TradingViewChartModalProps {
  record: OHLRecord;
  onClose: () => void;
  onAddLegToWorkbench?: (leg: { type: 'call' | 'put'; action: 'buy' | 'sell'; strike: number; premium: number; quantity: number }) => void;
  onOpenChain?: (symbol: string) => void;
}

export const TradingViewChartModal: React.FC<TradingViewChartModalProps> = ({
  record,
  onClose,
  onAddLegToWorkbench,
  onOpenChain
}) => {
  const tvContainerRef = useRef<HTMLDivElement>(null);
  const [activeInterval, setActiveInterval] = useState<string>('15');
  const [viewMode, setViewMode] = useState<'strike_candles' | 'tradingview_widget'>('strike_candles');

  // Strike Candle States
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loadingCandles, setLoadingCandles] = useState<boolean>(true);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);

  // Indicators toggle
  const [showVwap, setShowVwap] = useState<boolean>(true);
  const [showEma, setShowEma] = useState<boolean>(true);
  const [showOpenLine, setShowOpenLine] = useState<boolean>(true);

  // Parse clean underlying symbol
  const getCleanBaseSymbol = (): string => {
    const raw = record.symbol.toUpperCase().replace('&', '_').trim();
    if (raw === 'NIFTY 50') return 'NIFTY';
    if (raw === 'NIFTY BANK') return 'BANKNIFTY';
    return raw;
  };

  const baseSym = getCleanBaseSymbol();
  const underlyingTvSymbol = baseSym === 'SENSEX' ? 'BSE:SENSEX' : `NSE:${baseSym}`;

  // Fetch strike candles from backend
  const fetchStrikeCandles = async () => {
    setLoadingCandles(true);
    try {
      let url = `/api/ohl/candles?symbol=${encodeURIComponent(record.symbol)}&timeframe=${activeInterval}`;
      if (record.strike != null) url += `&strike=${record.strike}`;
      if (record.option_type) url += `&option_type=${record.option_type}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCandles(data.candles || []);
    } catch (err) {
      console.error('Failed to fetch strike candles:', err);
    } finally {
      setLoadingCandles(false);
    }
  };

  useEffect(() => {
    fetchStrikeCandles();
  }, [record.identifier, record.symbol, record.strike, record.option_type, activeInterval]);

  // Load TradingView Widget when in tradingview_widget viewMode
  useEffect(() => {
    if (viewMode !== 'tradingview_widget') return;

    const containerId = `tv_chart_container_${Date.now()}`;
    if (tvContainerRef.current) {
      tvContainerRef.current.innerHTML = `<div id="${containerId}" style="width: 100%; height: 100%;"></div>`;
    }

    const initWidget = () => {
      if (typeof (window as any).TradingView !== 'undefined' && document.getElementById(containerId)) {
        try {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: underlyingTvSymbol,
            interval: activeInterval,
            timezone: 'Asia/Kolkata',
            theme: 'dark',
            style: '1',
            locale: 'in',
            toolbar_bg: '#0f172a',
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: containerId,
            hide_side_toolbar: false,
            studies: [
              'Volume@tv-basicstudies',
              'MASimple@tv-basicstudies',
              'RSI@tv-basicstudies'
            ]
          });
        } catch (e) {
          console.error('TradingView error:', e);
        }
      }
    };

    if (typeof (window as any).TradingView !== 'undefined') {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }
  }, [viewMode, underlyingTvSymbol, activeInterval]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isOpenLow = record.signal === 'OPEN_EQUALS_LOW';
  const actionType = isOpenLow ? 'buy' : 'sell';
  const tradingViewExternalUrl = `https://in.tradingview.com/chart/?symbol=${encodeURIComponent(underlyingTvSymbol)}`;

  // SVG Candlestick Math & Geometry
  const chartDimensions = { width: 1180, height: 500 };
  const padding = { top: 30, right: 75, bottom: 65, left: 20 };
  const volHeight = 85;
  const mainPlotHeight = chartDimensions.height - padding.top - padding.bottom - volHeight;

  const { minPrice, maxPrice, priceRange, maxVol, barWidth, barStep } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100, maxVol: 1000, barWidth: 8, barStep: 12 };
    }
    const lows = candles.map(c => c.low);
    const highs = candles.map(c => c.high);
    const vols = candles.map(c => c.volume);

    // Include open price in boundary check
    lows.push(record.open);
    highs.push(record.open);

    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const pad = (maxP - minP) * 0.08 || 1;

    const minBound = Math.max(0, minP - pad);
    const maxBound = maxP + pad;
    const range = maxBound - minBound || 1;
    const maxV = Math.max(...vols) || 1;

    const plotWidth = chartDimensions.width - padding.left - padding.right;
    const step = plotWidth / candles.length;
    const bWidth = Math.max(2, Math.min(22, step * 0.72));

    return {
      minPrice: minBound,
      maxPrice: maxBound,
      priceRange: range,
      maxVol: maxV,
      barWidth: bWidth,
      barStep: step
    };
  }, [candles, record.open]);

  const getY = (price: number) => padding.top + mainPlotHeight * (1 - (price - minPrice) / priceRange);
  const getVolY = (vol: number) => chartDimensions.height - padding.bottom - (vol / maxVol) * volHeight;

  // Polyline Paths for VWAP and EMA-9
  const vwapPath = useMemo(() => {
    if (!showVwap) return '';
    return candles.reduce((acc, c, i) => {
      if (c.vwap == null) return acc;
      const x = padding.left + i * barStep + barStep / 2;
      const y = getY(c.vwap);
      return acc === '' ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [candles, showVwap, barStep, minPrice, priceRange]);

  const emaPath = useMemo(() => {
    if (!showEma) return '';
    return candles.reduce((acc, c, i) => {
      if (c.ema9 == null) return acc;
      const x = padding.left + i * barStep + barStep / 2;
      const y = getY(c.ema9);
      return acc === '' ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [candles, showEma, barStep, minPrice, priceRange]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 10, 20, 0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1400px',
        height: '94vh',
        maxHeight: '940px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.2)'
      }}>
        {/* ROW 1: HEADER & SIGNAL RIBBON */}
        <div style={{
          padding: '0.85rem 1.4rem',
          background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.8rem'
        }}>
          {/* Left contract summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                {record.identifier || record.symbol}
              </span>
              <span style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: isOpenLow ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isOpenLow ? '#22c55e' : '#ef4444',
                border: `1px solid ${isOpenLow ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
              }}>
                {isOpenLow ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isOpenLow ? 'OPEN = LOW (BULLISH 🚀)' : 'OPEN = HIGH (BEARISH 🔻)'}
              </span>
              {record.confluence && (
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)'
                }}>
                  🔥 Confluence
                </span>
              )}
            </div>

            {/* Price stats pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <span>Open: <strong style={{ color: '#f59e0b' }}>₹{record.open}</strong></span>
              <span>•</span>
              <span>High: <strong style={{ color: '#f8fafc' }}>₹{record.high}</strong></span>
              <span>•</span>
              <span>Low: <strong style={{ color: '#f8fafc' }}>₹{record.low}</strong></span>
              <span>•</span>
              <span>LTP: <strong style={{ color: isOpenLow ? '#22c55e' : '#ef4444' }}>₹{record.ltp}</strong></span>
              <span>•</span>
              <span>Move: <strong style={{ color: record.pct_from_open >= 0 ? '#22c55e' : '#ef4444' }}>
                {record.pct_from_open >= 0 ? `+${record.pct_from_open}%` : `${record.pct_from_open}%`}
              </strong></span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Timeframe selector */}
            <div style={{ display: 'flex', background: '#020617', padding: '2px', borderRadius: '6px', border: '1px solid #334155' }}>
              {['5', '15', '60', 'D'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveInterval(tf)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '4px',
                    background: activeInterval === tf ? '#38bdf8' : 'transparent',
                    color: activeInterval === tf ? '#0f172a' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tf === '60' ? '1H' : tf === 'D' ? '1D' : `${tf}m`}
                </button>
              ))}
            </div>

            {/* Option Chain Button */}
            {onOpenChain && (
              <button
                className="outline"
                onClick={() => {
                  onOpenChain(record.symbol);
                  onClose();
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Layers size={13} /> OI Chain
              </button>
            )}

            {/* Add to Workbench Button */}
            {onAddLegToWorkbench && record.strike && record.option_type && (
              <button
                className="primary"
                onClick={() => {
                  onAddLegToWorkbench({
                    type: record.option_type?.toLowerCase() as 'call' | 'put',
                    action: actionType,
                    strike: record.strike!,
                    premium: record.ltp > 0 ? record.ltp : 100,
                    quantity: 1
                  });
                  onClose();
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: isOpenLow ? 'linear-gradient(90deg, #16a34a, #15803d)' : 'linear-gradient(90deg, #dc2626, #b91c1c)'
                }}
              >
                <Zap size={13} /> {isOpenLow ? 'Buy' : 'Sell'} in Builder
              </button>
            )}

            {/* Open in TradingView External */}
            <a
              href={tradingViewExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                fontSize: '0.76rem',
                fontWeight: 600,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '6px',
                textDecoration: 'none'
              }}
              title="Open full chart on TradingView"
            >
              <ExternalLink size={13} /> TradingView ↗
            </a>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease'
              }}
              title="Close chart (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ROW 2: ENGINE SWITCHER & INDICATOR TOGGLES */}
        <div style={{
          padding: '0.45rem 1.4rem',
          background: '#0b1120',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.8rem'
        }}>
          {/* Dual Mode View Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setViewMode('strike_candles')}
              style={{
                padding: '0.3rem 0.8rem',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: '6px',
                border: viewMode === 'strike_candles' ? '1px solid #38bdf8' : '1px solid #334155',
                background: viewMode === 'strike_candles' ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
                color: viewMode === 'strike_candles' ? '#38bdf8' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <BarChart2 size={13} /> 📊 Strike Candlestick Chart (OHL Setup)
            </button>

            <button
              onClick={() => setViewMode('tradingview_widget')}
              style={{
                padding: '0.3rem 0.8rem',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '6px',
                border: viewMode === 'tradingview_widget' ? '1px solid #38bdf8' : '1px solid #334155',
                background: viewMode === 'tradingview_widget' ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
                color: viewMode === 'tradingview_widget' ? '#38bdf8' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              🏢 TradingView Spot ({underlyingTvSymbol})
            </button>
          </div>

          {/* Indicator toggles for Strike Candlestick Chart */}
          {viewMode === 'strike_candles' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={showOpenLine} onChange={(e) => setShowOpenLine(e.target.checked)} />
                Open Price Line (₹{record.open})
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#c084fc', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={showVwap} onChange={(e) => setShowVwap(e.target.checked)} />
                VWAP
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={showEma} onChange={(e) => setShowEma(e.target.checked)} />
                EMA-9
              </label>

              <button
                onClick={() => fetchStrikeCandles()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.72rem'
                }}
                title="Refresh candles"
              >
                <RefreshCw size={12} className={loadingCandles ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* MAIN CHART CONTAINER */}
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', background: '#020617', overflow: 'hidden' }}>
          {viewMode === 'strike_candles' ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Candlestick SVG Chart */}
              {loadingCandles && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 6, 23, 0.7)', zIndex: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontSize: '0.85rem' }}>
                    <RefreshCw className="animate-spin" size={18} />
                    Loading Candlestick Data for {record.identifier}...
                  </div>
                </div>
              )}

              {/* Hover Stats Ribbon */}
              <div style={{ padding: '0.4rem 1.4rem', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #1e293b', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '1.2rem', color: '#94a3b8' }}>
                <span>Candle: <strong style={{ color: '#f8fafc' }}>{hoveredCandle ? hoveredCandle.time : (candles[candles.length - 1]?.time || 'Latest')}</strong></span>
                <span>O: <strong style={{ color: '#f8fafc' }}>₹{hoveredCandle ? hoveredCandle.open : (candles[candles.length - 1]?.open ?? record.open)}</strong></span>
                <span>H: <strong style={{ color: '#f8fafc' }}>₹{hoveredCandle ? hoveredCandle.high : (candles[candles.length - 1]?.high ?? record.high)}</strong></span>
                <span>L: <strong style={{ color: '#f8fafc' }}>₹{hoveredCandle ? hoveredCandle.low : (candles[candles.length - 1]?.low ?? record.low)}</strong></span>
                <span>C: <strong style={{ color: '#f8fafc' }}>₹{hoveredCandle ? hoveredCandle.close : (candles[candles.length - 1]?.close ?? record.ltp)}</strong></span>
                <span>Vol: <strong style={{ color: '#f8fafc' }}>{(hoveredCandle ? hoveredCandle.volume : (candles[candles.length - 1]?.volume ?? record.volume)).toLocaleString()}</strong></span>
                {showVwap && <span>VWAP: <strong style={{ color: '#c084fc' }}>₹{hoveredCandle?.vwap ?? candles[candles.length - 1]?.vwap ?? '—'}</strong></span>}
                {showEma && <span>EMA-9: <strong style={{ color: '#38bdf8' }}>₹{hoveredCandle?.ema9 ?? candles[candles.length - 1]?.ema9 ?? '—'}</strong></span>}
              </div>

              {/* Responsive SVG Chart */}
              <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                <svg
                  viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="volGradGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="volGradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                    const price = minPrice + priceRange * (1 - ratio);
                    const y = padding.top + mainPlotHeight * ratio;
                    return (
                      <g key={ratio}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={chartDimensions.width - padding.right}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={chartDimensions.width - padding.right + 8}
                          y={y + 4}
                          fill="#64748b"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          ₹{price.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Open Price Level Reference Line */}
                  {showOpenLine && (
                    <g>
                      <line
                        x1={padding.left}
                        y1={getY(record.open)}
                        x2={chartDimensions.width - padding.right}
                        y2={getY(record.open)}
                        stroke="#f59e0b"
                        strokeDasharray="6 3"
                        strokeWidth="1.5"
                      />
                      <rect
                        x={chartDimensions.width - padding.right}
                        y={getY(record.open) - 10}
                        width={70}
                        height={18}
                        fill="#f59e0b"
                        rx={4}
                      />
                      <text
                        x={chartDimensions.width - padding.right + 6}
                        y={getY(record.open) + 3}
                        fill="#0f172a"
                        fontSize="9"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        OPEN ₹{record.open}
                      </text>
                    </g>
                  )}

                  {/* Volume Separator Line */}
                  <line
                    x1={padding.left}
                    y1={chartDimensions.height - padding.bottom - volHeight}
                    x2={chartDimensions.width - padding.right}
                    y2={chartDimensions.height - padding.bottom - volHeight}
                    stroke="#334155"
                    strokeWidth="1"
                  />

                  {/* Candlesticks & Volume Bars */}
                  {candles.map((c, i) => {
                    const x = padding.left + i * barStep + barStep / 2;
                    const isBullish = c.close >= c.open;
                    const candleColor = isBullish ? '#22c55e' : '#ef4444';

                    const highY = getY(c.high);
                    const lowY = getY(c.low);
                    const openY = getY(c.open);
                    const closeY = getY(c.close);

                    const bodyY = Math.min(openY, closeY);
                    const bodyHeight = Math.max(2, Math.abs(closeY - openY));

                    const volY = getVolY(c.volume);
                    const volBarH = chartDimensions.height - padding.bottom - volY;

                    return (
                      <g
                        key={c.time + i}
                        onMouseEnter={() => setHoveredCandle(c)}
                        onMouseLeave={() => setHoveredCandle(null)}
                        style={{ cursor: 'crosshair' }}
                      >
                        {/* Volume Bar */}
                        <rect
                          x={x - barWidth / 2}
                          y={volY}
                          width={barWidth}
                          height={Math.max(1, volBarH)}
                          fill={isBullish ? 'url(#volGradGreen)' : 'url(#volGradRed)'}
                        />

                        {/* Wick */}
                        <line
                          x1={x}
                          y1={highY}
                          x2={x}
                          y2={lowY}
                          stroke={candleColor}
                          strokeWidth="1.2"
                        />

                        {/* Body */}
                        <rect
                          x={x - barWidth / 2}
                          y={bodyY}
                          width={barWidth}
                          height={bodyHeight}
                          fill={candleColor}
                          rx={1}
                        />
                      </g>
                    );
                  })}

                  {/* VWAP Overlay */}
                  {showVwap && vwapPath && (
                    <path
                      d={vwapPath}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* EMA-9 Overlay */}
                  {showEma && emaPath && (
                    <path
                      d={emaPath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Time Axis Labels */}
                  {candles.map((c, i) => {
                    // Show roughly 8 evenly spaced time ticks
                    const step = Math.max(1, Math.floor(candles.length / 8));
                    if (i % step !== 0 && i !== candles.length - 1) return null;
                    const x = padding.left + i * barStep + barStep / 2;
                    return (
                      <text
                        key={'lbl' + i}
                        x={x}
                        y={chartDimensions.height - padding.bottom + 18}
                        fill="#64748b"
                        fontSize="10"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {c.time}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : (
            /* TRADINGVIEW REAL-TIME IFRAME/CONTAINER */
            <div ref={tvContainerRef} style={{ width: '100%', height: '100%' }} />
          )}
        </div>

        {/* BOTTOM METRICS STATUS BAR */}
        <div style={{
          padding: '0.55rem 1.4rem',
          background: '#090d16',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.8rem',
          fontSize: '0.74rem',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Active Contract: <strong style={{ color: '#38bdf8' }}>{record.identifier || record.symbol}</strong></span>
            <span>•</span>
            <span>Traded Volume: <strong style={{ color: '#f8fafc' }}>{record.volume.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Open Interest: <strong style={{ color: '#f8fafc' }}>{record.oi.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Timezone: <strong style={{ color: '#f8fafc' }}>Asia/Kolkata (IST)</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={12} />
            <span>{viewMode === 'strike_candles' ? 'Intraday OHL Candlestick Engine with VWAP & EMA-9' : 'TradingView Live Underlying Feed'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
