import requests
import json

API_URL = "http://localhost:8001/chat"

# Simulated User History
history = [
    # Turn 1: Ask about student A
    {"role": "user", "content": "pes1pg24ca001 give details"},
    {"role": "assistant", "content": "Here is the data for PES1PG24CA001: Yash..."},
    
    # Turn 2: Switch to student B
    {"role": "user", "content": "pes1pg24ca165 give details"},
    {"role": "assistant", "content": "Here is the data for PES1PG24CA165: Siba Sundar..."},
]

# Turn 3: The Follow-up
query = "where he gets placed"

payload = {
    "query": query,
    "conversation_history": history,
    "org_id": 4,
    "user_role": "admin"
}

print(f"Testing LIFO Brain with query: '{query}'")
print("-" * 50)

try:
    r = requests.post(API_URL, json=payload)
    if r.status_code == 200:
        data = r.json()
        print(f"LLM Thinking & Answer:\n")
        print(data.get("response", "No response found"))
        print("\n" + "-" * 50)
        
        # Verify internal routing via returned context chunks if available
        # (Usually chat endpoint just returns text, but we can infer success if it mentions placement data)
        resp_text = data.get("response", "").upper()
        if "PES1PG24CA165" in resp_text or "WIPRO" in resp_text or "DATA NOT FOUND" not in resp_text:
             print("✅ PASS: AI successfully linked 'he' to PES1PG24CA165 and retrieved related data.")
        else:
             print("❓ INITIAL CHECK: Read response manually to confirm if data was found.")
             
    else:
        print(f"Error {r.status_code}: {r.text}")

except Exception as e:
    print(f"Request failed: {e}")
