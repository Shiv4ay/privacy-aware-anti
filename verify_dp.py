import requests
import json
import time

WORKER_URL = "http://localhost:8001"

def test_search_dp(query, description):
    print(f"\n--- Testing: {description} ---")
    
    # First search
    resp1 = requests.post(f"{WORKER_URL}/search", json={"query": query, "dp_enabled": True}, timeout=30)
    data1 = resp1.json()
    
    # Second search
    resp2 = requests.post(f"{WORKER_URL}/search", json={"query": query, "dp_enabled": True}, timeout=30)
    data2 = resp2.json()
    
    res1 = data1.get('results', [])
    res2 = data2.get('results', [])
    
    print(f"Search 1 Result Count: {len(res1)}")
    print(f"Search 2 Result Count: {len(res2)}")
    
    if len(res1) > 0 and len(res2) > 0:
        score1 = res1[0].get('score')
        score2 = res2[0].get('score')
        print(f"Top Score 1: {score1}")
        print(f"Top Score 2: {score2}")
        
        if score1 != score2:
            print("SUCCESS: Jitter detected (Differential Privacy working)")
        else:
            print("WARNING: Scores are identical. DP may not be applying correctly.")
            
        # Check order
        ids1 = [r.get('id') for r in res1]
        ids2 = [r.get('id') for r in res2]
        if ids1 != ids2:
            print("SUCCESS: Result order changed (Distractor injection triggered)")
        else:
            print("NOTE: Result order is identical (Normal for small result sets, but should vary eventually)")

# 1. Test DP Jitter
test_search_dp("University", "Differential Privacy Jitter Check")
