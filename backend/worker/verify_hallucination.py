import requests
import json
import time

API_URL = "http://localhost:3001/api/chat"

# We test with a student that caused hallucination in the user's screenshot
student_id = "pes1pg24ca165"

payload = {
    "query": f"Give details for {student_id}",
    "orgId": "4",
    "conversationId": "test_hallucination_1"
}


print(f"Testing Query: '{payload['query']}'")
print("-" * 40)

try:
    # Use streaming response handling to mimic frontend
    with requests.post(API_URL, json=payload, stream=True) as r:
        if r.status_code != 200:
            print(f"Error: HTTP {r.status_code}")
            print(r.text)
        else:
            full_response = ""
            for line in r.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        data_str = decoded_line[6:]
                        if data_str == '[DONE]':
                            break
                        try:
                            data_json = json.loads(data_str)
                            if 'chunk' in data_json:
                                full_response += data_json['chunk']
                        except json.JSONDecodeError:
                            pass
            
            print("AI RESPONSE:")
            print("=" * 40)
            print(full_response)
            print("=" * 40)
            
            # Check for hallucination
            if "pes1pg24ca019" in full_response.lower() or "pes1pg24ca023" in full_response.lower():
                print("❌ FAIL: Hallucination detected! AI mentioned other students.")
            elif "no data found" in full_response.lower() or "not be indexed yet" in full_response.lower() or "[n/a]" in full_response.lower():
                 print("✅ PASS: AI correctly identified missing data without hallucinating.")
            else:
                 print("⚠️ UNKNOWN: Manual review required.")

except Exception as e:
    print(f"Failed to connect to API: {e}")
