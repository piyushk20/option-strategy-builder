import urllib.request
import json

symbols = ['SENSEX', 'NIFTY', 'RELIANCE', 'HDFCBANK']

for sym in symbols:
    url = f"http://127.0.0.1:8005/api/nse/straddle-chart?symbol={sym}"
    try:
        response = urllib.request.urlopen(url)
        data = json.loads(response.read())
        if "error" in data:
            print(f"{sym} Error: {data['error']}")
        else:
            last_tick = data['ticks'][-1] if data.get('ticks') else None
            print(f"{sym} ATM Strike: {data.get('strike')}")
            print(f"{sym} Last Tick: {last_tick}")
    except Exception as e:
        print(f"Failed to fetch {sym}: {e}")
