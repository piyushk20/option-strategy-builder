import pandas as pd
import json

print('Downloading Kite instruments...')
df = pd.read_csv('https://api.kite.trade/instruments')

# Filter for NFO (NSE F&O) and active options/futures to get lot sizes
nfo = df[df['exchange'] == 'NFO']
# Group by name (which is the underlying symbol) and get the mode of lot_size
lot_sizes = nfo.groupby('name')['lot_size'].first().to_dict()

# Overwrite index names if they are different in Kite
# Kite uses NIFTY 50 -> NIFTY, NIFTY BANK -> BANKNIFTY etc.
if 'NIFTY' in lot_sizes: pass
elif 'NIFTY 50' in lot_sizes: lot_sizes['NIFTY'] = lot_sizes['NIFTY 50']

if 'BANKNIFTY' in lot_sizes: pass
elif 'NIFTY BANK' in lot_sizes: lot_sizes['BANKNIFTY'] = lot_sizes['NIFTY BANK']

print(f'Found {len(lot_sizes)} F&O symbols')

with open('kite_lot_sizes.json', 'w') as f:
    json.dump(lot_sizes, f, indent=2)
