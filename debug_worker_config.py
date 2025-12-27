import requests

WORKER_URL = "http://localhost:8001"

def check_worker():
    print(f"Checking worker at {WORKER_URL}...")
    try:
        # We can't directly get the config, but we can try to trigger a chat and see logs or use a dummy request
        # Or if there's a specific internal debugging endpoint? Not in the code I saw.
        # But I can check the health endpoint.
        resp = requests.get(f"{WORKER_URL}/health", timeout=5)
        print(f"Health check response: {resp.json()}")
        
        # I'll also check the environment variables of the running process if I can.
    except Exception as e:
        print(f"❌ Worker check failed: {e}")

if __name__ == "__main__":
    check_worker()
