import requests
import os
import sys
import json

# Configuration
WORKER_URL = "http://localhost:8001"
API_URL = "http://localhost:3001"
TEST_QUERY = "Margaret Johnson"

def test_worker():
    print(f"\n--- Testing Worker directly ({WORKER_URL}/search) ---")
    try:
        # Worker search payload
        payload = {
            "query": TEST_QUERY,
            "top_k": 3,
            "org_id": 1
        }
        response = requests.post(f"{WORKER_URL}/search", json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            print(f"✅ Worker Connection: SUCCESS")
            print(f"ℹ️ Results Found: {len(results)}")
            if len(results) > 0:
                print(f"   First Match: {results[0].get('text', '')[:100]}...")
            else:
                print("⚠️ Worker returned 0 results (DB might be empty or embedding mismatch)")
            return True
        else:
            print(f"❌ Worker Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Worker FAILED: {e}")
        return False

def test_api():
    print(f"\n--- Testing API Endpoint ({API_URL}/api/health) ---")
    try:
        response = requests.get(f"{API_URL}/api/health", timeout=5)
        if response.status_code == 200:
             print(f"✅ API Health: SUCCESS ({response.json()})")
             return True
        else:
             print(f"❌ API Health Error: {response.status_code}")
             return False
    except Exception as e:
        print(f"❌ API FAILED: {e}")
        return False

if __name__ == "__main__":
    print("starting diagnostics...")
    worker_ok = test_worker()
    api_ok = test_api()
    
    if worker_ok and api_ok:
        print("\n✅ SYSTEM DIAGNOSIS: components are communicatng.")
    else:
        print("\n❌ SYSTEM DIAGNOSIS: Components are failing.")
