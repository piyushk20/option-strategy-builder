import sys
import os

# Adjust path to import backend modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from services.oi_crossover_service import oi_crossover_service

def test_oi_crossover_scanner():
    print("Initializing test scan loop...")
    # Run the scan loop synchronously for testing
    oi_crossover_service._run_scan_loop()
    
    status = oi_crossover_service.get_status()
    results = oi_crossover_service.get_results()
    
    print(f"Scan Status: {status}")
    print(f"Number of indices processed: {len(results)}")
    
    assert status["status"] == "completed", "Expected status to be completed"
    assert len(results) > 0, "Expected at least one result"
    
    expected_keys = {
        "index", "spot", "atm", "pcr", "pcr_read", "max_pain", 
        "crossover_zone", "total_call_oi", "total_put_oi", 
        "expiry", "is_mock", "snapshot_ts", 
        "fresh_call_oi", "fresh_call_strike", 
        "fresh_put_oi", "fresh_put_strike"
    }
    
    for r in results:
        idx = r["index"]
        print(f"\n--- Checking results for {idx} ---")
        print(f"Expiry: {r['expiry']}")
        print(f"Spot: {r['spot']} | ATM: {r['atm']}")
        print(f"PCR: {r['pcr']} ({r['pcr_read']})")
        print(f"Max Pain: {r['max_pain']}")
        print(f"Crossover Zone: {r['crossover_zone']}")
        print(f"Fresh Call Addition: +{r['fresh_call_oi']} at strike {r['fresh_call_strike']}")
        print(f"Fresh Put Addition: +{r['fresh_put_oi']} at strike {r['fresh_put_strike']}")
        
        # Verify schema
        actual_keys = set(r.keys())
        missing_keys = expected_keys - actual_keys
        assert not missing_keys, f"Missing keys for {idx}: {missing_keys}"
        
    print("\nAll unit tests passed successfully!")

if __name__ == "__main__":
    test_oi_crossover_scanner()
