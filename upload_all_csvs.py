import os
import requests
import time
from pathlib import Path

# Configuration
API_URL = "http://localhost:3001/api/documents/upload"
DATASET_DIR = r"c:\project3\AntiGravity\Datasets\University\final"
EXCLUDE_FILES = ["attendance.csv"]  # Skip this file
ORG_ID = 1

# Get auth token (assuming you're logged in as admin)
# For simplicity, using dev auth
DEV_TOKEN_URL = "http://localhost:3001/api/dev/token"
try:
    token_resp = requests.post(DEV_TOKEN_URL, json={"user": {"id": 1}, "expiresIn": "1h"}, headers={"x-dev-auth-key": "super-secret-dev-key"})
    token_resp.raise_for_status()
    token = token_resp.json()["token"]
    print(f"✅ Got auth token")
except Exception as e:
    print(f"❌ Failed to get token: {e}")
    print("Please ensure you're logged in or use the UI to upload manually")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# Get all CSV files
csv_files = [f for f in os.listdir(DATASET_DIR) if f.endswith('.csv') and f not in EXCLUDE_FILES]
csv_files.sort()

print(f"\n📁 Found {len(csv_files)} CSV files to upload:")
for f in csv_files:
    print(f"  - {f}")

print(f"\n🚀 Starting upload...")

successful = 0
failed = 0

for filename in csv_files:
    filepath = os.path.join(DATASET_DIR, filename)
    print(f"\n📤 Uploading {filename}...")
    
    try:
        with open(filepath, 'rb') as f:
            files = {'file': (filename, f, 'text/csv')}
            data = {'organization_id': ORG_ID}
            
            response = requests.post(API_URL, files=files, data=data, headers=headers, timeout=300)
            
            if response.status_code == 200:
                print(f"  ✅ SUCCESS")
                successful += 1
            else:
                print(f"  ❌ FAILED: {response.status_code} - {response.text[:200]}")
                failed += 1
        
        # Small delay to avoid overwhelming the system
        time.sleep(2)
        
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        failed += 1

print(f"\n{'='*60}")
print(f"📊 Upload Summary:")
print(f"  ✅ Successful: {successful}/{len(csv_files)}")
print(f"  ❌ Failed: {failed}/{len(csv_files)}")
print(f"{'='*60}")
