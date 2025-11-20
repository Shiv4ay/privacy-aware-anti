import requests
import json

# Test the worker search endpoint directly
API_URL = "http://localhost:8001"

# Test data
search_payload = {
    "query": "University",
    "top_k": 5,
    "organization": "University",
    "department": "CS",
    "user_category": "Student"
}

print("Testing Worker Search Endpoint Directly")
print(f"Payload: {json.dumps(search_payload, indent=2)}")

try:
    response = requests.post(f"{API_URL}/search", json=search_payload, timeout=10)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
