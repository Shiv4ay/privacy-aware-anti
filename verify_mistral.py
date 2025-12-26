import requests
import json
import time
import os
import sys

# Ensure UTF-8 output for Windows redirection
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_inference():
    print("--- MISTRAL PERFORMANCE BENCHMARK ---")
    url = "http://localhost:11434/api/generate"
    model = "mistral:7b-instruct-v0.3-q4_0"
    payload = {
        "model": model,
        "prompt": "Explain the importance of privacy in AI in 50 words.",
        "stream": False
    }
    
    print(f"Testing model: {model}")
    start_time = time.time()
    try:
        response = requests.post(url, json=payload, timeout=120)
        end_time = time.time()
        
        if response.status_code == 200:
            result = response.json()
            duration = end_time - start_time
            print(f"\n✅ Success!")
            print(f"Response: {result.get('response')}")
            print(f"\nTotal Time: {duration:.2f} seconds")
            
            # Estimate tokens per second
            # A rough estimate for 50 words is 75 tokens
            tokens_estimate = len(result.get('response', '').split()) * 1.3
            tps = tokens_estimate / duration
            print(f"Estimated Speed: {tps:.2f} tokens/sec")
            
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Request Failed: {e}")

if __name__ == "__main__":
    test_inference()
