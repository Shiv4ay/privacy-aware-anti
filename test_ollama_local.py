import requests
import json
import time

OLLAMA_URL = "http://localhost:11434"
MODELS_TO_TEST = ["phi3:mini", "qwen2.5:0.5b", "nomic-embed-text"]

def test_connectivity():
    print(f"Testing connectivity to {OLLAMA_URL}...")
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            models = [m['name'] for m in resp.json().get('models', [])]
            print(f"✅ Connected! Available models: {models}")
            return models
        else:
            print(f"❌ Failed with status code {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
    return []

def test_generation(model):
    print(f"\nTesting generation with model '{model}'...")
    payload = {
        "model": model,
        "prompt": "Explain the concept of academic probation in one sentence.",
        "stream": False
    }
    start_time = time.time()
    try:
        resp = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=60)
        duration = time.time() - start_time
        if resp.status_code == 200:
            print(f"✅ Success in {duration:.2f}s!")
            print(f"Response: {resp.json().get('response')}")
        else:
            print(f"❌ Failed with status code {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    available = test_connectivity()
    for model in MODELS_TO_TEST:
        if any(model in m for m in available):
            test_generation(model)
        else:
            print(f"\n⚠️ Model '{model}' not available.")
