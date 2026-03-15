import requests
import json
import time

print("Testing Follow-up Questions and Memory Identity...")
print("-" * 50)

URL = "http://localhost:8001/chat"

# Simulated User Info
payload_1 = {
    "query": "Can you get me the complete details of the student with id PES1PG24CA135?",
    "org_id": 4,
    "user_id": "test_user",
    "user_role": "student",
    "organization": "default",
    "conversation_history": []
}

print("=== Query 1: Initial Question ===")
response_1 = requests.post(URL, json=payload_1)
if response_1.status_code == 200:
    data_1 = response_1.json()
    print("Response:", data_1.get("response", "")[:500] + "...")
else:
    print("Failed query 1:", response_1.text)
    exit(1)

# Wait a moment for processing and display realistic delay
time.sleep(2)

print("\n=== Query 2: Follow-up Question ===")
# Follow-up question relying on memory (Identity Preservation)
history = [
    {"role": "user", "content": payload_1["query"]},
    {"role": "assistant", "content": data_1.get("response", "")}
]

payload_2 = {
    "query": "what are his scores?",
    "org_id": 4,
    "user_id": "test_user",
    "user_role": "student",
    "organization": "default",
    "conversation_history": history
}

response_2 = requests.post(URL, json=payload_2)
if response_2.status_code == 200:
    data_2 = response_2.json()
    print("Response:", data_2.get("response", ""))
else:
    print("Failed query 2:", response_2.text)
    
print("\n=== Query 3: Follow-up Question (Placement) ===")
# Follow-up question relying on memory (Identity Preservation)
history.append({"role": "user", "content": payload_2["query"]})
history.append({"role": "assistant", "content": data_2.get("response", "")})

payload_3 = {
    "query": "what is his placement details and check salary vs stipend?",
    "org_id": 4,
    "user_id": "test_user",
    "user_role": "student",
    "organization": "default",
    "conversation_history": history
}

response_3 = requests.post(URL, json=payload_3)
if response_3.status_code == 200:
    data_3 = response_3.json()
    print("Response:", data_3.get("response", ""))
else:
    print("Failed query 3:", response_3.text)
