import requests
import json
import re

def test_search():
    url = "http://localhost:8001/search"
    payload = {
        "query": "Who did an internship at Swiggy?",
        "top_k": 3,
        "org_id": 1,
        "organization": "default",
        "user_role": "admin",
        "dp_enabled": False
    }

    print(f"Sending search request to {url}...")
    try:
        resp = requests.post(url, json=payload, timeout=60)
        print(f"Response status: {resp.status_code}")
        data = resp.json()
        print("\n=== SYSTEM SYNTHESIZED QUERY ===")
        print(f"[{data.get('query_redacted')}]")
        
        print("\n=== RESULTS (INTERNAL VIEW) ===")
        results = data.get("results", [])
        if not results:
            print("No results found.")
            return

        for r in results:
            text = r.get("text", "")
            print(f"- [Score: {r.get('score'):.2f}] {text[:100]}...")
            
        print("\n=== FINAL UI REDACTION PROOF ===")
        # Manually create a string with raw identifiers to test the /redact endpoint
        # This simulates the final step before the user sees the message
        test_string = "The student PES1PG24CA169 was placed at COMP_MCA015 in record PLC00028."
        print(f"Input to UI: '{test_string}'")
        
        # Test full UI redaction (internal_only=False)
        payload_redact = {"text": test_string, "internal_only": False}
        resp_redact = requests.post("http://localhost:8001/redact", json=payload_redact)
        final_view = resp_redact.json().get('redacted_text')
        print(f"Output for User: '{final_view}'")
        
        if "[USER_ID:idx_" in final_view or "[ID:idx_" in final_view:
            print("\nVERIFICATION: SUCCESS! IDs are now masked as badges for the user.")
        else:
            print("\nVERIFICATION: FAILED. Check if Presidio Recognizers are registered.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_search()
