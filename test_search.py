
import requests
import json

WORKER_URL = "http://localhost:8001"

payload = {
    "query": "Margaret Johnson",
    "top_k": 5,
    "org_id": 1
}

try:
    response = requests.post(f"{WORKER_URL}/search", json=payload, timeout=10)
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
