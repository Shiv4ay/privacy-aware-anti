import requests
import json

print("=== COMPREHENSIVE SEARCH & CHAT TEST ===\n")

# Test 1: Search Test
print("1. Testing Search Endpoint...")
search_payload = {
    "query": "What is the GPA of students in Computer Science department?",
    "top_k": 3
}

try:
    response = requests.post(
        "http://localhost:3001/api/search",
        json=search_payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    print(f"   Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Search Success! Found {data.get('total_found', 0)} results")
        if data.get('results'):
            print(f"   Top Result: {data['results'][0].get('text', '')[:100]}...")
    else:
        print(f"   ❌ Error: {response.text}")
except Exception as e:
    print(f"   ❌ Search Failed: {e}")

print("\n2. Testing Chat Endpoint...")
chat_payload = {
    "query": "What are the privacy features of this RAG system?"
}

try:
    response = requests.post(
        "http://localhost:3001/api/chat",
        json=chat_payload,
        headers={"Content-Type": "application/json"},
        timeout=60
    )
    print(f"   Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Chat Success!")
        print(f"   Response: {data.get('response', '')[:200]}...")
    else:
        print(f"   ❌ Error: {response.text}")
except Exception as e:
    print(f"   ❌ Chat Failed: {e}")

print("\n=== TEST COMPLETED ===")
