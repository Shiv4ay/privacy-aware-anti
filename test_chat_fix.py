
import requests
import json
import time

WORKER_URL = "http://localhost:8001"

payload = {
    "query": "Margaret Johnson GPA and email",
    "org_id": 1,
    "user_role": "admin"
}

print(f"--- Testing Chat with Admin Role ---")
try:
    response = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=60)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Query: {data.get('query')}")
    print(f"Response: {data.get('response')}")
    print(f"Context Used: {data.get('context_used')}")
except Exception as e:
    print(f"Error: {e}")
