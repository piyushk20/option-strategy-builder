import json
import re

with open('kite_lot_sizes.json', 'r') as f:
    lot_sizes = json.load(f)

# Convert lot_sizes dict to a TypeScript object string
ts_obj = 'const LOT_SIZES: Record<string, number> = {\n'
for k, v in sorted(lot_sizes.items()):
    ts_obj += f"  '{k}': {v},\n"
ts_obj = ts_obj.rstrip(',\n') + '\n};'

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the existing LOT_SIZES block
pattern = re.compile(r'const LOT_SIZES:\s*Record<string,\s*number>\s*=\s*\{.*?\};', re.DOTALL)
new_content = pattern.sub(ts_obj, content)

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated LOT_SIZES in App.tsx')
