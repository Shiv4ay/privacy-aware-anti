import requests
import time
import sys

WORKER_URL = "http://localhost:8001"
ORG_ID = 1
BATCH_SIZE = 50

def process_batch():
    try:
        url = f"{WORKER_URL}/process-batch"
        params = {
            "org_id": ORG_ID,
            "batch_size": BATCH_SIZE,
            "max_documents": BATCH_SIZE
        }
        
        print(f"Requesting batch processing... (Batch Size: {BATCH_SIZE})")
        response = requests.post(url, params=params, timeout=300)
        
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Exception: {e}")
        return None

def main():
    print("Starting document processing...")
    
    total_processed_overall = 0
    
    while True:
        result = process_batch()
        
        if not result:
            print("Failed to get result. Retrying in 5s...")
            time.sleep(5)
            continue
            
        processed = result.get("processed", 0)
        failed = result.get("failed", 0)
        remaining = result.get("remaining", 0)
        
        total_processed_overall += processed
        
        print(f"Batch Complete: Processed {processed}, Failed {failed}. Remaining Pending: {remaining}")
        
        if remaining == 0 and processed == 0:
            print("All documents processed!")
            break
        
        if remaining == 0:
            print("No more pending documents.")
            break
            
        # Optional: slight delay to not hammer the server if needed, but synchronous is fine
        time.sleep(1)

if __name__ == "__main__":
    main()
