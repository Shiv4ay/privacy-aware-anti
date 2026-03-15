import requests
import json

BASE_URL = "http://localhost:8001"
ORG_ID = 4

def test_org4_search():
    print(f"=== VERIFYING SEARCH & PRIVACY FOR ORG {ORG_ID} ===")
    
    # 1. Search for an Alumnus (General knowledge in Org 4)
    # Based on alumni.csv preview, searching for common terms
    query = "List some alumni from organization 4"
    
    payload = {
        "query": query,
        "org_id": ORG_ID,
        "top_k": 5
    }
    
    print(f"\n[SEARCH] Query: '{query}'")
    try:
        response = requests.post(f"{BASE_URL}/search", json=payload)
        response.raise_for_status()
        results = response.json()
        print(f"✅ Search successful. Found {len(results.get('results', []))} matches.")
        
        # Check for PII Redaction in snippets
        for i, res in enumerate(results.get('results', [])[:2]):
            snippet = res.get('content', '')
            print(f"Snippet {i+1}: {snippet[:200]}...")
            if "[EMAIL]" in snippet or "[PERSON]" in snippet or "[PHONE]" in snippet:
                print(f"  ✨ PRIVACY CHECK: PII Redacted in search result snippet.")
            else:
                print(f"  ⚠️ PRIVACY CHECK: No PII tokens found (might be non-PII content).")
                
    except Exception as e:
        print(f"❌ Search failed: {e}")

def test_org4_chat():
    print(f"\n[CHAT] Query: 'Who are the notable alumni?'")
    
    payload = {
        "message": "Who are the notable alumni in organization 4?",
        "org_id": ORG_ID,
        "user_role": "student", # Testing with low privilege to ensure redaction
        "history": []
    }
    
    try:
        response = requests.post(f"{BASE_URL}/chat", json=payload)
        response.raise_for_status()
        resp_json = response.json()
        
        answer = resp_json.get('answer', '')
        print(f"Answer: {answer}")
        
        pii_map = resp_json.get('pii_map', {})
        if pii_map:
            print(f"✅ PRIVACY CHECK: PII Map returned (Redaction Active).")
            print(f"Sample Map: {list(pii_map.items())[:3]}")
        else:
            print(f"⚠️ PRIVACY CHECK: No PII Map returned (Check if redaction triggered).")
            
    except Exception as e:
        print(f"❌ Chat failed: {e}")

if __name__ == "__main__":
    test_org4_search()
    test_org4_chat()
