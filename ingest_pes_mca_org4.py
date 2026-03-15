import os
import requests
import time
from pathlib import Path

# --- CONFIGURATION FOR ORG 4 ---
API_URL = "http://localhost:3001/api/documents/upload"
DATASET_DIR = r"c:\project3\AntiGravity\Datasets\University\pes_mca_dataset"
ORG_ID = 4
DEV_TOKEN_URL = "http://localhost:3001/api/dev/token"

print(f"=== BULK INGESTION FOR ORG {ORG_ID} ===")

# 1. Get auth token for admin
try:
    token_resp = requests.post(
        DEV_TOKEN_URL, 
        json={"user": {"id": 1, "organization": ORG_ID}, "expiresIn": "2h"}, 
        headers={"x-dev-auth-key": "super-secret-dev-key"}
    )
    token_resp.raise_for_status()
    token = token_resp.json()["token"]
    print(f"✅ Got auth token for Org {ORG_ID}")
except Exception as e:
    print(f"❌ Failed to get token: {e}")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# 2. Identify files
csv_files = [f for f in os.listdir(DATASET_DIR) if f.endswith('.csv')]
csv_files.sort()

print(f"\n📁 Found {len(csv_files)} files in dataset directory.")

# 3. Upload loop
successful = 0
failed = 0

for filename in csv_files:
    filepath = os.path.join(DATASET_DIR, filename)
    record_type = filename.replace(".csv", "")
    print(f"\n📤 Uploading {filename} (Type: {record_type})...")
    
    try:
        with open(filepath, 'rb') as f:
            files = {'file': (filename, f, 'text/csv')}
            # We explicitly pass organization_id=4
            data = {
                'organization_id': ORG_ID,
                'record_type': record_type,
                'source_name': 'PES MCA Dataset'
            }
            
            response = requests.post(API_URL, files=files, data=data, headers=headers, timeout=600)
            
            if response.status_code == 200:
                resp_json = response.json()
                doc_count = len(resp_json.get('documents', []))
                print(f"  ✅ SUCCESS: Inserted {doc_count} records.")
                successful += 1
            else:
                print(f"  ❌ FAILED: {response.status_code} - {response.text[:200]}")
                failed += 1
        
        # 2s delay between files to allow worker queue to breathe
        time.sleep(2)
        
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        failed += 1

print(f"\n{'='*60}")
print(f"📊 INGESTION SUMMARY (ORG {ORG_ID}):")
print(f"  ✅ Successful: {successful}/{len(csv_files)}")
print(f"  ❌ Failed: {failed}/{len(csv_files)}")
print(f"{'='*60}")

# 4. Trigger Worker Processing
print("\n⚡ Triggering worker deep indexing for Org 4...")
try:
    worker_url = "http://localhost:8001/process-batch"
    w_resp = requests.post(f"{worker_url}?org_id={ORG_ID}&batch_size=500")
    print(f"Worker Response: {w_resp.status_code} - {w_resp.json()}")
except Exception as e:
    print(f"⚠️ Worker trigger failed (may be running in background): {e}")
