import os
import sys
import json
import logging
import threading
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional, List

logger = logging.getLogger("backtest_service")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REPORTS_DIR = os.path.join(BASE_DIR, ".tmp", "reports")
DATA_DIR = os.path.join(BASE_DIR, ".tmp", "data")


class BacktestService:
    def __init__(self):
        self.status = "idle"  # "idle", "running", "completed", "failed"
        self.last_run_time = ""
        self.error_message = ""
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": self.status,
                "last_run_time": self.last_run_time,
                "error": self.error_message,
                "reports_available": os.path.exists(os.path.join(REPORTS_DIR, "backtest_summary.json"))
            }

    def get_summary(self) -> Dict[str, Any]:
        summary_file = os.path.join(REPORTS_DIR, "backtest_summary.json")
        portfolio_file = os.path.join(REPORTS_DIR, "portfolio_summary.json")

        summary_data = []
        portfolio_data = None

        if os.path.exists(summary_file):
            try:
                with open(summary_file, "r", encoding="utf-8") as f:
                    summary_data = json.load(f)
            except Exception as e:
                logger.error(f"Error reading backtest_summary.json: {e}")

        if os.path.exists(portfolio_file):
            try:
                with open(portfolio_file, "r", encoding="utf-8") as f:
                    portfolio_data = json.load(f)
            except Exception as e:
                logger.error(f"Error reading portfolio_summary.json: {e}")

        return {
            "strategies": summary_data,
            "portfolio": portfolio_data,
            "updated_at": datetime.fromtimestamp(os.path.getmtime(summary_file)).strftime("%Y-%m-%d %H:%M:%S") if os.path.exists(summary_file) else None
        }

    def get_tearsheet_html(self, report_name: Optional[str] = None, asset: Optional[str] = None, strategy: Optional[str] = None) -> Optional[str]:
        if report_name:
            filename = f"{report_name}.html" if not report_name.endswith(".html") else report_name
        elif asset and strategy:
            filename = f"{asset}_{strategy}_tearsheet.html"
        else:
            filename = "PORTFOLIO_Combined_tearsheet.html"

        # Sanitize filename
        filename = os.path.basename(filename)
        file_path = os.path.join(REPORTS_DIR, filename)

        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        return None

    def start_backtest_async(self) -> bool:
        with self._lock:
            if self.status == "running":
                return False
            self.status = "running"
            self.error_message = ""
            self.last_run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        self._thread = threading.Thread(target=self._run_backtests_worker, daemon=True)
        self._thread.start()
        return True

    def _run_backtests_worker(self):
        logger.info("Initiating full VectorBT backtests and tearsheet generations...")
        try:
            python_exe = sys.executable
            # 1. Run individual backtests
            run_script = os.path.join(BASE_DIR, "execution", "run_backtest.py")
            res1 = subprocess.run([python_exe, run_script], cwd=BASE_DIR, capture_output=True, text=True)
            if res1.returncode != 0:
                raise RuntimeError(f"run_backtest.py failed: {res1.stderr}")

            # 2. Run portfolio backtest
            pf_script = os.path.join(BASE_DIR, "execution", "portfolio_backtest.py")
            res2 = subprocess.run([python_exe, pf_script], cwd=BASE_DIR, capture_output=True, text=True)
            if res2.returncode != 0:
                raise RuntimeError(f"portfolio_backtest.py failed: {res2.stderr}")

            with self._lock:
                self.status = "completed"
                self.last_run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            logger.info("Backtest run completed successfully.")
        except Exception as e:
            logger.error(f"Backtest execution failed: {e}", exc_info=True)
            with self._lock:
                self.status = "failed"
                self.error_message = str(e)


backtest_service = BacktestService()
