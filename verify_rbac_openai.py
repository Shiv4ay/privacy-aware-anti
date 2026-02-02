import requests
import json

WORKER_URL = "http://localhost:8001"

def test_chat(query, user_role="student", user_id=None, org_id=None):
    print(f"\n--- Testing Chat | Role: {user_role} | UserID: {user_id} | OrgID: {org_id} ---")
    payload = {
        "query": query,
        "user_role": user_role,
        "user_id": user_id,
        "org_id": org_id
    }
    try:
        r = requests.post(f"{WORKER_URL}/chat", json=payload, timeout=120)
        if r.status_code == 200:
            res = r.json()
            print(f"Query: {res.get('query')}")
            print(f"Response: {res.get('response')}")
            print(f"Status: {res.get('status')}")
        else:
            print(f"Error {r.status_code}: {r.text}")
    except Exception as e:
        print(f"Request failed: {e}")

def test_search(query, user_role="student", user_id=None, org_id=None):
    print(f"\n--- Testing Search | Role: {user_role} | UserID: {user_id} | OrgID: {org_id} ---")
    payload = {
        "query": query,
        "user_role": user_role,
        "user_id": user_id,
        "org_id": org_id,
        "top_k": 3
    }
    try:
        r = requests.post(f"{WORKER_URL}/search", json=payload, timeout=30)
        if r.status_code == 200:
            res = r.json()
            print(f"Found {res.get('total_found')} results")
            for i, result in enumerate(res.get('results', [])):
                print(f" Result {i+1} (ID: {result.get('id')}): {result.get('text')[:100]}...")
        else:
            print(f"Error {r.status_code}: {r.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    # 1. Test Strict Context (Ask something not in documents)
    test_chat("What is the capital of France?", user_role="student", user_id=999)
    
    # 2. Test PII Redaction (Query with email)
    test_chat("Tell me about the student with email admin@mit.edu", user_role="admin", org_id=1)
    
    # 3. Test RBAC Visibility
    # Note: These IDs should match data in your database
    # Test Student (should only see their own)
    test_search("internship", user_role="student", user_id=101, org_id=1)
    
    # Test Org Admin (should see everything in org 1)
    test_search("internship", user_role="admin", org_id=1)
    
    # 4. Test Direct Chat (bypass search)
    test_chat("Hello, who are you?", user_role="student", user_id=123, org_id=1)
    
    # 5. Test Direct Chat with manual context
    test_chat("What is my secret key?", user_role="student", user_id=123, org_id=1)
