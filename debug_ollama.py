import os
import requests
import json
import sys

# 1. Check Env Vars
ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")

print(f"--- DIAGNOSTIC START ---")
print(f"ENV OLLAMA_URL: {ollama_url}")
print(f"ENV OLLAMA_MODEL: {ollama_model}")

# 2. Check Connectivity & List Models
print(f"\n[1/3] Testing Connectivity...")
try:
    resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        models = [m['name'] for m in resp.json().get('models', [])]
        print(f"Available Models: {models}")
        if ollama_model not in models and f"{ollama_model}:latest" not in models:
             print(f"⚠️ WARNING: Configured model '{ollama_model}' NOT found in list!")
    else:
        print(f"❌ Error: {resp.text}")
except Exception as e:
    print(f"❌ Connection Failed: {e}")

# 3. Test Generation
print(f"\n[2/3] Testing Generation with model '{ollama_model}'...")
payload = {
    "model": ollama_model,
    "prompt": "Say hi",
    "stream": False
}
try:
    print(f"Sending payload: {json.dumps(payload)}")
    resp = requests.post(f"{ollama_url}/api/generate", json=payload, timeout=60)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        print(f"✅ Success! Response: {resp.json().get('response')}")
    else:
        print(f"❌ Generation Failed: {resp.text}")
except Exception as e:
    print(f"❌ Request Error: {e}")

print(f"--- DIAGNOSTIC END ---")
