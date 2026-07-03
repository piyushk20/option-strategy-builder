import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find LOT_SIZES
lot_match = re.search(r'(// Official NSE F&O lot sizes.*?const LOT_SIZES: Record<string, number> = \{.*?\};)', content, re.DOTALL)
lot_sizes_str = lot_match.group(1)

# Find AVAILABLE_SYMBOLS
avail_match = re.search(r'(const AVAILABLE_SYMBOLS = \[.*?\];)', content, re.DOTALL)
avail_symbols_str = avail_match.group(1)

# Remove LOT_SIZES from its current position
content = content.replace(lot_sizes_str, '')

# New AVAILABLE_SYMBOLS logic
new_avail = """const INDEX_NAMES: Record<string, string> = {
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
});"""

# Replace old AVAILABLE_SYMBOLS with LOT_SIZES + New Logic
content = content.replace(avail_symbols_str, lot_sizes_str + '\n\n' + new_avail)

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated App.tsx with dynamic AVAILABLE_SYMBOLS')
