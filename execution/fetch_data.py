import os
import pandas as pd
import yfinance as yf
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fetch_data")

# Dictionary of target NSE assets & Yahoo Finance tickers
ASSETS = {
    "NIFTY": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "RELIANCE": "RELIANCE.NS"
}

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".tmp", "data")

def download_ohlcv_data(period="5y", interval="1d"):
    """
    Downloads historical daily OHLCV data for specified NSE assets from Yahoo Finance.
    Saves clean CSV files into .tmp/data/ directory.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    downloaded_files = {}

    for name, ticker in ASSETS.items():
        logger.info(f"Downloading data for {name} ({ticker}) [Period: {period}, Interval: {interval}]...")
        try:
            df = yf.download(ticker, period=period, interval=interval, auto_adjust=False)
            if df.empty:
                logger.error(f"Failed to fetch data for {name} ({ticker}) - Empty DataFrame returned.")
                continue

            # Handle MultiIndex columns if returned by yfinance
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            # Standardize column names
            df.columns = [c.capitalize() for c in df.columns]
            df.index.name = "Date"

            # Drop missing values
            df = df.dropna(subset=["Open", "High", "Low", "Close", "Volume"])

            out_path = os.path.join(DATA_DIR, f"{name}.csv")
            df.to_csv(out_path)
            logger.info(f"Successfully saved {len(df)} rows to {out_path} (From {df.index[0].date()} to {df.index[-1].date()})")
            downloaded_files[name] = out_path

        except Exception as e:
            logger.error(f"Error downloading data for {name} ({ticker}): {e}", exc_info=True)

    return downloaded_files

if __name__ == "__main__":
    download_ohlcv_data(period="5y")
