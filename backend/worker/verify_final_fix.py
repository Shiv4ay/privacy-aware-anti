import requests
import json
import time

# Use the internal search endpoint
URL = "http://localhost:8001/search"
query = "PES1PG24CA169 give details"
org_id = 4

print(f"Verifying final fix for query: '{query}' in Org {org_id}...")

payload = {
    "query": query,
    "org_id": org_id,
    "top_k": 15,
    "user_id": 1
}

try:
    # Give the worker a moment to be ready if it just restarted
    time.sleep(2)
    
    response = requests.post(URL, json=payload)
    if response.status_code == 200:
        data = response.json()
        results = data.get("results", [])
        print(f"Retrieved {len(results)} results.")
        
        found_demographic = False
        for i, res in enumerate(results):
            txt = res.get("text", "")
            if "gender:" in txt.lower() or "home_state:" in txt.lower():
                found_demographic = True
                print(f"\n--- SUCCESS: Demographic Data Found in Result {i} ---")
                print(txt[:300])
                break
        
        if not found_demographic:
            print("\nFAILURE: Demographic data still not in search results.")
            # Print top 3 filenames found to check ranking
            print("\nTop 3 filenames in results:")
            # In results, search response doesn't give filename metadata in the list easily 
            # unless it's in the text. Let's look at the text contents.
            for i in range(min(3, len(results))):
                print(f"Result {i}: {results[i]['text'][:100]}...")

    else:
        print(f"Error: {response.status_code} - {response.text}")

except Exception as e:
    print(f"Error connecting to worker: {e}")
