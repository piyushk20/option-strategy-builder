import urllib.request
import re
import json

url = 'https://archives.nseindia.com/content/fo/fo_mktlots.csv'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('iso-8859-1')
    
    lot_sizes = {}
    # Find lines that look like: "  UNDERLYING, SYMBOL ,  10-12-24, ..."
    # Or just extract SYMBOL and the first number that follows
    for line in content.split('\n'):
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 3 and parts[1].isupper():
            symbol = parts[1]
            for val in parts[2:]:
                val = val.strip()
                if val.isdigit():
                    lot_sizes[symbol] = int(val)
                    break

    indices = {'NIFTY': 25, 'BANKNIFTY': 15, 'FINNIFTY': 25, 'MIDCPNIFTY': 50}
    for k, v in indices.items():
        lot_sizes[k] = v

    print(f'Fetched {len(lot_sizes)} lot sizes.')
    with open('lot_sizes.json', 'w') as f:
        json.dump(lot_sizes, f, indent=2)
except Exception as e:
    print(f'Error: {e}')
