import requests
import json

def test_bridging():
    url = "http://localhost:8001/chat"
    
    # Simulating Turn 2: Follow-up question
    # Turn 1 history is included to test if the backend bridges the ID from Turn 1
    payload = {
        "query": "where he placed",
        "conversation_history": [
            {"role": "user", "content": "Tell me about student STU20240015?"},
            {"role": "assistant", "content": "Student [USER_ID:idx_0] (STU20240015) is studying Data Science..."}
        ],
        "org_id": 1,
        "user_role": "admin"
    }

    print(f"Sending follow-up request to {url}...")
    try:
        resp = requests.post(url, json=payload, timeout=60)
        print(f"Response status: {resp.status_code}")
        data = resp.json()
        
        # In a follow-up, the search_query should contain the ID STU20240457
        # We can't see the synthesized query directly from the /chat response metadata 
        # unless it's returned. But we can check if it found context.
        context_used = data.get("context_used", False)
        print(f"Context used: {context_used}")
        print(f"AI Response: {data.get('response')}")
        
        if context_used and "No results found" not in data.get('response'):
            print("\nSUCCESS: Context bridging seems to be working!")
        else:
            print("\nFAILURE: Context was not used or no records found for the bridged ID.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_bridging()
