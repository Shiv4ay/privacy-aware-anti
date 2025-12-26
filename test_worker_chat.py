import requests
import json

def test_chat():
    url = "http://localhost:8001/chat"
    payload = {
        "query": "Margaret Johnson GPA",
        "org_id": 1,
        "organization": "Organization 1",
        "top_k": 5
    }
    
    print(f"Sending query: {payload['query']}")
    try:
        response = requests.post(url, json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            print("\n=== RESPONSE ===")
            print(result.get('response', 'No response field'))
            print("\n=== CONTEXT USED ===")
            context = result.get('context', 'No context field')
            if context:
                print(context[:500] + "...")
            else:
                print("No context retrieved.")
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_chat()
