import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Search, 
  Flame, 
  Sliders, 
  ArrowRight, 
  Layers, 
  Clock, 
  ShieldCheck, 
  ExternalLink,
  BarChart2
} from 'lucide-react';
import { TradingViewChartModal } from './TradingViewChartModal';

export interface OHLRecord {
  symbol: string;
  instrument_type: string;
  identifier: string;
  strike: number | null;
  option_type: 'CE' | 'PE' | null;
  expiry: string | null;
  open: number;
  high: number;
  low: number;
  ltp: number;
  prev_close: number;
  volume: number;
  oi: number;
  oi_change: number;
  signal: 'OPEN_EQUALS_LOW' | 'OPEN_EQUALS_HIGH';
  diff_pct: number;
  pct_from_open: number;
  underlying_price: number;
  confluence: boolean;
}

interface OhlScannerViewProps {
  onSelectSymbolForChain?: (symbol: string) => void;
  onAddLegToWorkbench?: (leg: {
    type: 'call' | 'put' | 'stock';
    action: 'buy' | 'sell';
    strike: number;
    premium: number;
    quantity: number;
  }) => void;
}

export const OhlScannerView: React.FC<OhlScannerViewProps> = ({
  onSelectSymbolForChain,
  onAddLegToWorkbench
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [universeFilter, setUniverseFilter] = useState<'all' | 'indices' | 'stocks'>('all');
  const [signalFilter, setSignalFilter] = useState<'all' | 'OPEN_EQUALS_LOW' | 'OPEN_EQUALS_HIGH'>('all');
  const [optionTypeFilter, setOptionTypeFilter] = useState<'all' | 'CE' | 'PE' | 'spot'>('all');
  const [confluenceOnly, setConfluenceOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tolerance, setTolerance] = useState<number>(0.001); // 0.1% tolerance
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off

  // Data States
  const [records, setRecords] = useState<OHLRecord[]>([]);
  const [metrics, setMetrics] = useState<{ total: number; open_low: number; open_high: number; confluence: number }>({
    total: 0,
    open_low: 0,
    open_high: 0,
    confluence: 0
  });
  const [lastScannedAt, setLastScannedAt] = useState<string>('');
  const [selectedChartRecord, setSelectedChartRecord] = useState<OHLRecord | null>(null);

  // Fetch Cached Results
  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/ohl/results?universe=${universeFilter}&signal=${signalFilter}&option_type=${optionTypeFilter}&confluence_only=${confluenceOnly}`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch OHL scan results.`);
      const data = await res.json();
      setRecords(data.results || []);
      setMetrics(data.metrics || { total: 0, open_low: 0, open_high: 0, confluence: 0 });
      setLastScannedAt(data.last_scanned_at || '');
      setScanProgress(data.progress_pct || 100);
    } catch (err: any) {
      console.error('Error fetching OHL results:', err);
      setError(err.message || 'Failed to load OHL scan data.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Live Scan
  const triggerLiveScan = async (universe: string = 'leaders') => {
    setScanning(true);
    try {
      const res = await fetch('/api/ohl/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe, tolerance_pct: tolerance })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to trigger live scan.`);

      // Poll status until ready
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/ohl/status');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setScanProgress(statusData.progress_pct || 50);
            if (statusData.status !== 'scanning') {
              clearInterval(pollInterval);
              setScanning(false);
              fetchResults();
            }
          }
        } catch (e) {
          clearInterval(pollInterval);
          setScanning(false);
        }
      }, 1500);
    } catch (err: any) {
      console.error('Error triggering OHL scan:', err);
      setScanning(false);
    }
  };

  // Initial fetch and auto-refresh loop
  useEffect(() => {
    fetchResults();
  }, [universeFilter, signalFilter, optionTypeFilter, confluenceOnly]);

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchResults();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, universeFilter, signalFilter, optionTypeFilter, confluenceOnly, searchQuery]);

  const formatNumber = (val: number): string => {
    const abs = Math.abs(val);
    if (abs >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toLocaleString();
  };

  return (
    <div className="full-width-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', gridColumn: '1 / -1' }}>
      {/* 1. TOP HEADER STRATEGY BANNER */}
      <div className="card" style={{
        padding: '1.25rem 1.5rem',
        borderLeft: '4px solid #f59e0b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap style={{ color: '#f59e0b' }} size={24} />
              Live Open = High / Open = Low (OHL) Scanner
            </h2>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              NSE LIVE & SNAPSHOT
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Identifies aggressive opening order flow across F&O stocks and index options. Open = Low represents powerful intraday buying; Open = High represents heavy institutional shorting.
          </p>
        </div>

        {/* Action Controls & Last Scanned */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          {lastScannedAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
              <Clock size={13} />
              <span>Updated: {lastScannedAt.split(' ')[1] || lastScannedAt}</span>
            </div>
          )}

          {/* Auto Refresh Interval */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Auto-Poll:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              style={{
                background: '#111827',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              <option value={0}>Off (Manual)</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            className="outline"
            onClick={() => fetchResults()}
            disabled={loading || scanning}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={14} />
            Refresh
          </button>

          {/* Trigger Full Live Scan Button */}
          <button
            className="primary"
            onClick={() => triggerLiveScan(universeFilter === 'stocks' ? 'leaders' : 'leaders')}
            disabled={scanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #f59e0b, #d97706)',
              color: '#0f172a'
            }}
          >
            <Zap size={14} className={scanning ? "animate-spin" : ""} />
            {scanning ? `Scanning (${scanProgress}%)...` : '⚡ Run Live Scan'}
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC STATS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Total Scanned */}
        <div className="card" style={{ padding: '1rem', borderLeft: '3px solid #64748b' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
            Scanned Contracts
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginTop: '0.2rem' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
            Across liquid Index & F&O strikes
          </div>
        </div>

        {/* Open = Low (Bullish) */}
        <div className="card" style={{ padding: '1rem', borderLeft: '3px solid #16a34a', background: 'rgba(22, 163, 74, 0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingUp size={15} /> Open = Low (Bullish 🚀)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80', marginTop: '0.2rem' }}>
            {metrics.open_low}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Buyers held low from open; upward drive
          </div>
        </div>

        {/* Open = High (Bearish) */}
        <div className="card" style={{ padding: '1rem', borderLeft: '3px solid #dc2626', background: 'rgba(220, 38, 38, 0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingDown size={15} /> Open = High (Bearish 🔻)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
            {metrics.open_high}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Sellers held high from open; heavy decay
          </div>
        </div>

        {/* Confluence Signals */}
        <div className="card" style={{ padding: '1rem', borderLeft: '3px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Flame size={15} /> Confluence Matches (🔥)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
            {metrics.confluence}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Stock Spot AND Option Strike aligned
          </div>
        </div>
      </div>

      {/* 3. FILTER TOOLBAR */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Left: Universe Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginRight: '0.2rem' }}>UNIVERSE:</span>
            {[
              { id: 'all', label: 'All Universe' },
              { id: 'indices', label: 'Indices Only' },
              { id: 'stocks', label: 'F&O Stocks' }
            ].map(tab => (
              <button
                key={tab.id}
                className={universeFilter === tab.id ? 'primary' : 'outline'}
                onClick={() => setUniverseFilter(tab.id as any)}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 600 }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right: Search Input */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search symbol or strike..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchResults(); }}
              style={{
                width: '100%',
                background: '#111827',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: 'white',
                padding: '0.35rem 0.8rem 0.35rem 2rem',
                fontSize: '0.8rem'
              }}
            />
          </div>
        </div>

        {/* Secondary Filter Row: Signal, Instrument Type, Confluence & Tolerance */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {/* Signal Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>SIGNAL:</span>
            <button
              onClick={() => setSignalFilter('all')}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: signalFilter === 'all' ? '#334155' : 'transparent',
                color: signalFilter === 'all' ? 'white' : '#94a3b8',
                border: '1px solid #475569'
              }}
            >
              All
            </button>
            <button
              onClick={() => setSignalFilter('OPEN_EQUALS_LOW')}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: signalFilter === 'OPEN_EQUALS_LOW' ? '#16a34a' : 'transparent',
                color: signalFilter === 'OPEN_EQUALS_LOW' ? 'white' : '#4ade80',
                border: '1px solid #16a34a'
              }}
            >
              🚀 Open = Low
            </button>
            <button
              onClick={() => setSignalFilter('OPEN_EQUALS_HIGH')}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: signalFilter === 'OPEN_EQUALS_HIGH' ? '#dc2626' : 'transparent',
                color: signalFilter === 'OPEN_EQUALS_HIGH' ? 'white' : '#f87171',
                border: '1px solid #dc2626'
              }}
            >
              🔻 Open = High
            </button>
          </div>

          {/* Option Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>TYPE:</span>
            <select
              value={optionTypeFilter}
              onChange={(e) => setOptionTypeFilter(e.target.value as any)}
              style={{
                background: '#111827', border: '1px solid #334155', borderRadius: '6px',
                color: 'white', padding: '0.3rem 0.6rem', fontSize: '0.75rem'
              }}
            >
              <option value="all">All Types</option>
              <option value="CE">Calls (CE) Only</option>
              <option value="PE">Puts (PE) Only</option>
              <option value="spot">Spot Equities Only</option>
            </select>
          </div>

          {/* Confluence Toggle Button */}
          <button
            onClick={() => setConfluenceOnly(!confluenceOnly)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: confluenceOnly ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)',
              color: confluenceOnly ? '#0f172a' : '#f59e0b',
              border: '1px solid #f59e0b'
            }}
          >
            <Flame size={13} />
            {confluenceOnly ? 'Confluence Active (🔥)' : 'Filter Confluence Only'}
          </button>

          {/* Strictness Tolerance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Strictness:</span>
            <select
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              style={{
                background: '#111827', border: '1px solid #334155', borderRadius: '6px',
                color: 'white', padding: '0.3rem 0.6rem', fontSize: '0.75rem'
              }}
            >
              <option value={0.0}>Exact (0.00%)</option>
              <option value={0.001}>Strict (&le; 0.10%)</option>
              <option value={0.0025}>Moderate (&le; 0.25%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. ERROR NOTICE */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span><strong>Error:</strong> {error}</span>
          <button className="primary" onClick={() => fetchResults()} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Retry</button>
        </div>
      )}

      {/* 5. DATA TABLE */}
      <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#111827', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.8rem 1rem' }}>Instrument / Identifier</th>
              <th style={{ padding: '0.8rem 0.8rem' }}>Signal</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>Open</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>High</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>Low</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>LTP</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>% From Open</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>Volume</th>
              <th style={{ padding: '0.8rem 0.8rem', textAlign: 'right' }}>Open Interest</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw className="animate-spin" size={24} style={{ color: '#f59e0b' }} />
                      <span>Loading Open = High / Low Matches...</span>
                    </div>
                  ) : (
                    <div>No contracts matched the selected filters. Try broadening the strictness or clearing search.</div>
                  )}
                </td>
              </tr>
            ) : (
              records.map((r, idx) => {
                const isOpenLow = r.signal === 'OPEN_EQUALS_LOW';
                const isSpot = r.strike === null;

                return (
                  <tr
                    key={`${r.identifier}-${idx}`}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      background: r.confluence ? 'rgba(245, 158, 11, 0.04)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Instrument Identifier */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.85rem' }}>
                          {r.identifier}
                        </span>
                        {r.confluence && (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}>
                            <Flame size={10} /> Confluence
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                        {r.instrument_type} {r.expiry ? `• ${r.expiry}` : ''} • Spot: ₹{r.underlying_price.toLocaleString()}
                      </div>
                    </td>

                    {/* Signal Badge */}
                    <td style={{ padding: '0.75rem 0.8rem' }}>
                      {isOpenLow ? (
                        <span style={{
                          background: 'rgba(22, 163, 74, 0.15)',
                          color: '#4ade80',
                          border: '1px solid rgba(22, 163, 74, 0.4)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          🚀 OPEN = LOW
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(220, 38, 38, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(220, 38, 38, 0.4)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          🔻 OPEN = HIGH
                        </span>
                      )}
                    </td>

                    {/* Open Price */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#e2e8f0' }}>
                      ₹{r.open.toLocaleString()}
                    </td>

                    {/* High Price */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: !isOpenLow ? 800 : 500, color: !isOpenLow ? '#f87171' : '#94a3b8' }}>
                      ₹{r.high.toLocaleString()}
                    </td>

                    {/* Low Price */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: isOpenLow ? 800 : 500, color: isOpenLow ? '#4ade80' : '#94a3b8' }}>
                      ₹{r.low.toLocaleString()}
                    </td>

                    {/* LTP */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#60a5fa', fontSize: '0.85rem' }}>
                      ₹{r.ltp.toLocaleString()}
                    </td>

                    {/* % from Open */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: r.pct_from_open >= 0 ? '#4ade80' : '#f87171' }}>
                      {r.pct_from_open >= 0 ? '+' : ''}{r.pct_from_open.toFixed(2)}%
                    </td>

                    {/* Volume */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.75rem', color: '#cbd5e1' }}>
                      {formatNumber(r.volume)}
                    </td>

                    {/* Open Interest */}
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.75rem', color: '#cbd5e1' }}>
                      {r.oi > 0 ? formatNumber(r.oi) : '-'}
                    </td>

                    {/* Action Buttons */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        {/* TradingView Chart Button */}
                        <button
                          onClick={() => setSelectedChartRecord(r)}
                          className="outline"
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.72rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            borderColor: 'rgba(56, 189, 248, 0.4)',
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.08)'
                          }}
                          title="View Live TradingView Chart"
                        >
                          <BarChart2 size={12} /> Chart
                        </button>

                        {/* Option Chain Button */}
                        <button
                          onClick={() => onSelectSymbolForChain && onSelectSymbolForChain(r.symbol)}
                          className="outline"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Open in Quantsapp OI Visualizer"
                        >
                          <ExternalLink size={12} /> Chain
                        </button>

                        {/* Workbench Action (Only for options) */}
                        {!isSpot && r.strike && r.option_type && (
                          <button
                            onClick={() => onAddLegToWorkbench && onAddLegToWorkbench({
                              type: r.option_type === 'CE' ? 'call' : 'put',
                              action: isOpenLow ? 'buy' : 'sell',
                              strike: r.strike!,
                              premium: r.ltp,
                              quantity: 1
                            })}
                            className="primary"
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              background: isOpenLow ? 'linear-gradient(90deg, #16a34a, #15803d)' : 'linear-gradient(90deg, #dc2626, #b91c1c)'
                            }}
                            title={`Add to workbench (${isOpenLow ? 'Buy' : 'Sell'} ${r.option_type})`}
                          >
                            <ArrowRight size={12} /> {isOpenLow ? 'Buy' : 'Sell'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* TRADINGVIEW CHART MODAL */}
      {selectedChartRecord && (
        <TradingViewChartModal
          record={selectedChartRecord}
          onClose={() => setSelectedChartRecord(null)}
          onAddLegToWorkbench={onAddLegToWorkbench}
          onOpenChain={onSelectSymbolForChain}
        />
      )}
    </div>
  );
};
