import urllib.request

url = 'https://archives.nseindia.com/content/fo/fo_mktlots.csv'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('iso-8859-1')
    print(content[:500])
except Exception as e:
    print(f'Error: {e}')
