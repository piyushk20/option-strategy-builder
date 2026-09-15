import React, { useState, useMemo } from 'react';
import { Sliders, RefreshCw, Info, HelpCircle } from 'lucide-react';

export interface StrikeData {
  strike: number;
  CE: { ltp: number; oi: number; oi_change: number; change: number; iv: number; bid?: number; ask?: number };
  PE: { ltp: number; oi: number; oi_change: number; change: number; iv: number; bid?: number; ask?: number };
}

export interface OptionChainData {
  symbol: string;
  underlying_price: number;
  future_price?: number;
  selected_expiry: string;
  expiry_dates: string[];
  pcr: number;
  max_pain: number;
  atm_strike: number;
  atm_straddle?: number;
  strikes: StrikeData[];
  is_mock?: boolean;
  timestamp?: string;
}

interface QuantsappOiChartProps {
  optionChain: OptionChainData;
  symbol: string;
  lotSize?: number;
  onRefresh?: () => void;
  loading?: boolean;
}

export const QuantsappOiChart: React.FC<QuantsappOiChartProps> = ({
  optionChain,
  symbol,
  lotSize = 1,
  onRefresh,
  loading = false,
}) => {
  // Mode: 'total' = Total OI, 'change' = OI Change
  const [activeMode, setActiveMode] = useState<'total' | 'change'>('change');
  
  // Strike range: number of strikes above and below ATM
  const [strikeRange, setStrikeRange] = useState<number>(10);
  
  // Units: 'contracts' or 'shares'
  const [unitType, setUnitType] = useState<'contracts' | 'shares'>('contracts');
  
  // Hovered strike for rich tooltip
  const [hoveredStrike, setHoveredStrike] = useState<number | null>(null);

  const underlyingPrice = optionChain.underlying_price || 0;
  const futurePrice = optionChain.future_price || underlyingPrice;
  const atmStrike = optionChain.atm_strike;

  // Multiplier depending on unitType
  const multiplier = unitType === 'shares' ? Math.max(1, lotSize) : 1;

  // Filter strikes around ATM and sort DESCENDING (Highest strike on top, lowest on bottom - Quantsapp layout)
  const sortedStrikes = useMemo(() => {
    const strikes = optionChain.strikes || [];
    if (strikes.length === 0) return [];

    // Sort ascending first to find index around ATM
    const ascStrikes = [...strikes].sort((a, b) => a.strike - b.strike);
    const atmIdx = ascStrikes.findIndex(s => s.strike >= atmStrike);
    const validAtmIdx = atmIdx >= 0 ? atmIdx : Math.floor(ascStrikes.length / 2);

    let filtered = ascStrikes;
    if (strikeRange < 900) {
      const start = Math.max(0, validAtmIdx - strikeRange);
      const end = Math.min(ascStrikes.length, validAtmIdx + strikeRange + 1);
      filtered = ascStrikes.slice(start, end);
    }

    // Return DESCENDING (high strike at top, low at bottom like Quantsapp)
    return [...filtered].sort((a, b) => b.strike - a.strike);
  }, [optionChain.strikes, atmStrike, strikeRange]);

  // Compute maximum value for X-axis scaling
  const maxAxisValue = useMemo(() => {
    let max = 0;
    sortedStrikes.forEach(s => {
      if (activeMode === 'total') {
        const ceOi = (s.CE?.oi || 0) * multiplier;
        const peOi = (s.PE?.oi || 0) * multiplier;
        if (ceOi > max) max = ceOi;
        if (peOi > max) max = peOi;
      } else {
        const ceChg = Math.abs(s.CE?.oi_change || 0) * multiplier;
        const peChg = Math.abs(s.PE?.oi_change || 0) * multiplier;
        if (ceChg > max) max = ceChg;
        if (peChg > max) max = peChg;
      }
    });
    // Fallback if all values are 0
    return max > 0 ? max * 1.12 : 10000;
  }, [sortedStrikes, activeMode, multiplier]);

  // Formatting helper for Indian numeric systems (Cr, L, K)
  const formatValue = (val: number): string => {
    const abs = Math.abs(val);
    if (abs >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toLocaleString();
  };

  // Helper to determine derivative buildup signal
  const getBuildup = (oiChg: number, priceChg: number) => {
    if (oiChg > 0 && priceChg >= 0) return { label: 'Long Buildup', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.15)' };
    if (oiChg > 0 && priceChg < 0) return { label: 'Short Buildup', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' };
    if (oiChg < 0 && priceChg < 0) return { label: 'Long Unwinding', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    if (oiChg < 0 && priceChg >= 0) return { label: 'Short Covering', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
    return { label: 'Neutral', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)' };
  };

  // Find between which two strikes the future/spot line sits
  // sortedStrikes is descending [23650, 23600, ..., 22950]
  const referenceStrikeIndex = useMemo(() => {
    const price = futurePrice || underlyingPrice;
    for (let i = 0; i < sortedStrikes.length - 1; i++) {
      const high = sortedStrikes[i].strike;
      const low = sortedStrikes[i + 1].strike;
      if (price <= high && price >= low) {
        return i; // place reference line right below strike i
      }
    }
    return -1;
  }, [sortedStrikes, futurePrice, underlyingPrice]);

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: '16px',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #1e293b'
      }}>
        {/* Left: Quantsapp Style Pill Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveMode('total')}
            style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeMode === 'total' ? 'none' : '1px solid #475569',
              background: activeMode === 'total' ? '#f59e0b' : 'transparent',
              color: activeMode === 'total' ? '#0f172a' : '#94a3b8',
              boxShadow: activeMode === 'total' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Total OI
          </button>
          
          <button
            onClick={() => setActiveMode('change')}
            style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeMode === 'change' ? 'none' : '1px solid #475569',
              background: activeMode === 'change' ? '#f59e0b' : 'transparent',
              color: activeMode === 'change' ? '#0f172a' : '#94a3b8',
              boxShadow: activeMode === 'change' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            OI Change
          </button>

          {/* Range Dropdown */}
          <div style={{ marginLeft: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Strikes:</span>
            <select
              value={strikeRange}
              onChange={(e) => setStrikeRange(Number(e.target.value))}
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <option value={7}>ATM ± 7</option>
              <option value={10}>ATM ± 10 (Quantsapp Standard)</option>
              <option value={15}>ATM ± 15</option>
              <option value={20}>ATM ± 20</option>
              <option value={999}>All Available Strikes</option>
            </select>
          </div>

          {/* Unit Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.5rem' }}>
            <button
              onClick={() => setUnitType(unitType === 'contracts' ? 'shares' : 'contracts')}
              style={{
                background: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Toggle between number of contracts and total shares quantity"
            >
              {unitType === 'contracts' ? 'Contracts' : `Shares (x${lotSize})`}
            </button>
          </div>
        </div>

        {/* Right: Signature Quantsapp Interactive Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          fontSize: '0.75rem',
          color: '#cbd5e1'
        }}>
          {activeMode === 'total' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#16a34a', display: 'inline-block' }}></span>
                <span>Call OI</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#dc2626', display: 'inline-block' }}></span>
                <span>Put OI</span>
              </div>
            </>
          ) : (
            <>
              {/* Call Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }}></span>
                <span>Call OI</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#15803d', display: 'inline-block' }}></span>
                <span>Call addition</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', border: '2px solid #22c55e', background: 'transparent', display: 'inline-block' }}></span>
                <span>Call unwinding</span>
              </div>

              {/* Put Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }}></span>
                <span>Put OI</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#991b1b', display: 'inline-block' }}></span>
                <span>Put addition</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', border: '2px solid #ef4444', background: 'transparent', display: 'inline-block' }}></span>
                <span>Put unwinding</span>
              </div>
            </>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.2rem'
              }}
              title="Refresh Chain"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* 2. TABLE HEADERS (STRIKE | OPEN INTEREST (CONTRACTS) ->) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 0.5rem 0.5rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: '#94a3b8',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ width: '85px', textAlign: 'right', paddingRight: '1.25rem' }}>
          STRIKE
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>OPEN INTEREST ({unitType.toUpperCase()}) &rarr;</span>
        </div>
      </div>

      {/* 3. MAIN CHART BODY: STRIKE-BY-STRIKE HORIZONTAL ROWS */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '0.5rem 0 1rem 0'
      }}>
        {sortedStrikes.map((s, idx) => {
          const isAtm = s.strike === atmStrike;
          const isHovered = hoveredStrike === s.strike;

          // Call data
          const ceOi = (s.CE?.oi || 0) * multiplier;
          const ceOiChg = (s.CE?.oi_change || 0) * multiplier;
          const ceLtp = s.CE?.ltp || 0;
          const cePriceChg = s.CE?.change || 0;
          const ceIv = s.CE?.iv ? (s.CE.iv * 100).toFixed(1) : '-';
          const ceSignal = getBuildup(s.CE?.oi_change || 0, cePriceChg);

          // Put data
          const peOi = (s.PE?.oi || 0) * multiplier;
          const peOiChg = (s.PE?.oi_change || 0) * multiplier;
          const peLtp = s.PE?.ltp || 0;
          const pePriceChg = s.PE?.change || 0;
          const peIv = s.PE?.iv ? (s.PE.iv * 100).toFixed(1) : '-';
          const peSignal = getBuildup(s.PE?.oi_change || 0, pePriceChg);

          // Calculate bar widths (percentage of maxAxisValue)
          let callBarWidthPct = 0;
          let putBarWidthPct = 0;
          let callIsUnwinding = false;
          let putIsUnwinding = false;

          if (activeMode === 'total') {
            callBarWidthPct = Math.min(100, Math.max(0.4, (ceOi / maxAxisValue) * 100));
            putBarWidthPct = Math.min(100, Math.max(0.4, (peOi / maxAxisValue) * 100));
          } else {
            // OI Change Mode
            const ceAbs = Math.abs(ceOiChg);
            const peAbs = Math.abs(peOiChg);
            callBarWidthPct = Math.min(100, Math.max(ceAbs > 0 ? 0.8 : 0, (ceAbs / maxAxisValue) * 100));
            putBarWidthPct = Math.min(100, Math.max(peAbs > 0 ? 0.8 : 0, (peAbs / maxAxisValue) * 100));
            callIsUnwinding = ceOiChg < 0;
            putIsUnwinding = peOiChg < 0;
          }

          // Bar styles
          const callBarStyle: React.CSSProperties = {
            height: '11px',
            width: `${callBarWidthPct}%`,
            borderRadius: '2px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(activeMode === 'total'
              ? { background: '#16a34a' }
              : callIsUnwinding
                ? {
                    border: '1.5px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.06)',
                    boxSizing: 'border-box'
                  }
                : { background: '#15803d' })
          };

          const putBarStyle: React.CSSProperties = {
            height: '11px',
            width: `${putBarWidthPct}%`,
            borderRadius: '2px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(activeMode === 'total'
              ? { background: '#dc2626' }
              : putIsUnwinding
                ? {
                    border: '1.5px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.06)',
                    boxSizing: 'border-box'
                  }
                : { background: '#991b1b' })
          };

          return (
            <React.Fragment key={s.strike}>
              {/* Individual Strike Row */}
              <div
                onMouseEnter={() => setHoveredStrike(s.strike)}
                onMouseLeave={() => setHoveredStrike(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  // Quantsapp Signature ATM Strike Highlight Box
                  background: isAtm
                    ? 'rgba(245, 158, 11, 0.12)'
                    : isHovered
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'transparent',
                  border: isAtm
                    ? '1.5px solid #f59e0b'
                    : isHovered
                      ? '1px solid #334155'
                      : '1px solid transparent',
                  boxShadow: isAtm ? '0 0 12px rgba(245, 158, 11, 0.15)' : 'none'
                }}
              >
                {/* Strike Price Label on Left */}
                <div style={{
                  width: '85px',
                  textAlign: 'right',
                  paddingRight: '1.25rem',
                  fontSize: '0.85rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: isAtm ? 800 : 600,
                  color: isAtm ? '#f59e0b' : '#f1f5f9'
                }}>
                  {s.strike.toLocaleString()}
                </div>

                {/* Paired Horizontal Bars Container */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  justifyContent: 'center',
                  minHeight: '26px'
                }}>
                  {/* Call Bar (Top) */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={callBarStyle} />
                    {isHovered && (
                      <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#4ade80', fontWeight: 600 }}>
                        {activeMode === 'total' ? formatValue(ceOi) : `${ceOiChg >= 0 ? '+' : ''}${formatValue(ceOiChg)}`}
                      </span>
                    )}
                  </div>

                  {/* Put Bar (Bottom) */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={putBarStyle} />
                    {isHovered && (
                      <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#f87171', fontWeight: 600 }}>
                        {activeMode === 'total' ? formatValue(peOi) : `${peOiChg >= 0 ? '+' : ''}${formatValue(peOiChg)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rich Hover Floating Tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '260px',
                    zIndex: 50,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                    pointerEvents: 'none',
                    minWidth: '240px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #334155',
                      paddingBottom: '0.4rem',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>
                        Strike {s.strike.toLocaleString()}
                      </span>
                      {isAtm && (
                        <span style={{
                          background: '#f59e0b',
                          color: '#0f172a',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 800
                        }}>
                          ATM
                        </span>
                      )}
                    </div>

                    {/* Call Summary */}
                    <div style={{ marginBottom: '0.4rem', background: 'rgba(34, 197, 94, 0.08)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#4ade80' }}>
                        <span>CALL (CE):</span>
                        <span>LTP ₹{ceLtp.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                        <span>Total OI: {formatValue(ceOi)}</span>
                        <span>Chg: {ceOiChg >= 0 ? '+' : ''}{formatValue(ceOiChg)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: ceSignal.color, marginTop: '0.2rem', fontWeight: 600 }}>
                        <span>Buildup: {ceSignal.label}</span>
                        <span>IV: {ceIv}%</span>
                      </div>
                    </div>

                    {/* Put Summary */}
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#f87171' }}>
                        <span>PUT (PE):</span>
                        <span>LTP ₹{peLtp.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                        <span>Total OI: {formatValue(peOi)}</span>
                        <span>Chg: {peOiChg >= 0 ? '+' : ''}{formatValue(peOiChg)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: peSignal.color, marginTop: '0.2rem', fontWeight: 600 }}>
                        <span>Buildup: {peSignal.label}</span>
                        <span>IV: {peIv}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Underlying Spot / Future Orange Dashed Reference Line (Inserted between strikes) */}
              {referenceStrikeIndex === idx && (
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  margin: '4px 0 4px 75px',
                  zIndex: 10
                }}>
                  {/* Dashed Line Left */}
                  <div style={{
                    flex: 1,
                    borderTop: '1.5px dashed #f59e0b',
                    opacity: 0.85
                  }} />

                  {/* Centered Price Badge */}
                  <div style={{
                    padding: '0.15rem 0.6rem',
                    fontSize: '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    color: '#f59e0b',
                    background: '#0f172a',
                    border: '1px solid #f59e0b',
                    borderRadius: '4px',
                    margin: '0 0.5rem',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 0 8px rgba(245, 158, 11, 0.25)'
                  }}>
                    Future {futurePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>

                  {/* Dashed Line Right */}
                  <div style={{
                    flex: 3,
                    borderTop: '1.5px dashed #f59e0b',
                    opacity: 0.85
                  }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 4. BOTTOM X-AXIS SCALING (0, 1.79Cr, 3.58Cr...) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.5rem 0.5rem 0 95px',
        borderTop: '1px solid #1e293b',
        fontSize: '0.72rem',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#64748b'
      }}>
        <span>0</span>
        <span>{formatValue(maxAxisValue * 0.5)}</span>
        <span>{formatValue(maxAxisValue)}</span>
      </div>

      {/* 5. FOOTER INFO */}
      <div style={{
        marginTop: '0.75rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.7rem',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={13} />
          <span>Live strike-by-strike open interest structure for <strong>{symbol}</strong> ({optionChain.selected_expiry})</span>
        </div>
        <div>
          PCR: <strong style={{ color: optionChain.pcr >= 1.0 ? '#22c55e' : '#ef4444' }}>{optionChain.pcr?.toFixed(2)}</strong> | Max Pain: <strong style={{ color: '#f8fafc' }}>{optionChain.max_pain?.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
};
