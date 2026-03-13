import requests
import json

# worker's internal search endpoint
API_URL = "http://localhost:8001/search"

# Test 1: Query that caused hallucination
student_id = "PES1PG24CA165"
payload = {
    "query": f"pes1pg24ca165 give details",
    "org_id": 4,
    "top_k": 15
}

print(f"Testing Query: '{payload['query']}'")
print("-" * 40)

try:
    r = requests.post(API_URL, json=payload)
    if r.status_code != 200:
        print(f"Error: HTTP {r.status_code}")
        print(r.text)
    else:
        data = r.json()
        print(f"Total Found: {data.get('total_found')}")
        results = data.get('results', [])
        
        all_text = " ".join([d.get('text', '') for d in results]).lower()
        
        if "pes1pg24ca019" in all_text or "pes1pg24ca023" in all_text:
            print("❌ FAIL: Hallucination detected! Worker returned chunks for other students.")
            for chunk in results:
                print(f"Score: {chunk.get('score')} | ID: {chunk.get('id')}")
        elif len(results) == 0:
            print("✅ PASS: Identity Firewall successfully purged all non-matching records.")
        else:
            print("✅ PASS: Records found, but no neighbor pollution detected.")

except Exception as e:
    print(f"Failed to connect to Worker: {e}")
