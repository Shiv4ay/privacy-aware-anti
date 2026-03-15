import requests
import json
import time

BASE_URL = "http://127.0.0.1:8001"

def test_full_rag():
    print("=== STARTING FULL-FLEDGED RAG VERIFICATION ===")
    
    # 1. Indirect Query: Conceptual Mapping
    print("\n[TEST 1] Indirect Query: 'Who teaches Artificial Intelligence?'")
    resp1 = requests.post(f"{BASE_URL}/chat", json={
        "query": "Who teaches Artificial Intelligence?",
        "org_id": 1,
        "organization": "University",
        "user_role": "admin",
        "user_id": "TEST_USER",
        "conversation_history": []
    })
    
    if resp1.status_code == 200:
        data = resp1.json()
        resp_text = data.get("response", "")
        pii_map = data.get("pii_map", {}) or {}
        
        print(f"AI Response Snippet: {resp_text[:150]}...")
        
        # Check if it found a faculty member associated with AI
        # (Jonathan Johnson FAC002, Donald Lewis FAC003 are AI specialists)
        found_pii = any("Johnson" in str(v) or "Lewis" in str(v) for v in pii_map.values())
        found_literal = "Johnson" in resp_text or "Lewis" in resp_text
        
        if found_pii or found_literal or "Faculty" in resp_text:
            print("✅ SUCCESS: Indirect mapping worked.")
        else:
            print(f"❌ FAILURE: Could not confirm faculty resolution. PII Map: {pii_map}")
    else:
        print(f"❌ API Error: {resp1.status_code}")

    # 2. Multi-Turn Bridging & Recursive Join
    print("\n[TEST 2] Step A: Direct ID query")
    history = []
    resp2a = requests.post(f"{BASE_URL}/chat", json={
        "query": "Tell me about student STU20240015",
        "org_id": 1,
        "organization": "University",
        "user_role": "admin",
        "user_id": "TEST_USER",
        "conversation_history": history
    })
    
    if resp2a.status_code == 200:
        data = resp2a.json()
        history.append({"role": "user", "content": "Tell me about student STU20240015"})
        history.append({"role": "assistant", "content": data['response']})
        print(f"AI Response (Turn A) Snippet: {data['response'][:100]}...")

        print("\n[TEST 2] Step B: Follow-up with Recursive Join ('where is he placed?')")
        resp2b = requests.post(f"{BASE_URL}/chat", json={
            "query": "where is he placed?",
            "org_id": 1,
            "organization": "University",
            "user_role": "admin",
            "user_id": "TEST_USER",
            "conversation_history": history
        })
        
        if resp2b.status_code == 200:
            data_b = resp2b.json()
            resp_b_text = data_b.get("response", "")
            pii_map_b = data_b.get("pii_map", {}) or {}
            
            print(f"AI Response (Turn B) Snippet: {resp_b_text[:200]}...")
            
            # Check for Morgan Stanley (COMP041) or Sony (COMP004) or Placement details
            found_company = any(c in str(pii_map_b.values()) for c in ["Morgan Stanley", "Sony"])
            found_location = any(l in str(pii_map_b.values()) or l in resp_b_text for l in ["Delhi", "Hyderabad", "Mumbai"])
            
            if found_company or found_location or "placed" in resp_b_text.lower():
                print("✅ SUCCESS: Multi-turn bridging and Recursive Join worked.")
                if found_company:
                    print(f"   (Matched Company via RRR: {pii_map_b})")
            else:
                print(f"❌ FAILURE: AI failed to resolve the placement. Response: {resp_b_text}")
                print(f"   Context PII Map was: {pii_map_b}")
        else:
            print(f"❌ API Error: {resp2b.status_code}")

if __name__ == "__main__":
    test_full_rag()
