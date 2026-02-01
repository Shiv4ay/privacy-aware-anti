
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print(f"--- [FINAL ALE STORAGE INSPECTION] ---")
    objects = list(client.list_objects(BUCKET, recursive=True))
    # Sort by object name (which starts with timestamp in many cases) or just take last 5
    last_files = objects[-5:]
    
    for obj in last_files:
        print(f"File: {obj.object_name} | Size: {obj.size} bytes")
        response = client.get_object(BUCKET, obj.object_name)
        data = response.read(64)
        response.close()
        response.release_conn()
        
        print(f"Raw Header (Hex): {data.hex(' ')}")
        # If it has bytes > 127 and doesn't look like CSV headers, it's encrypted
        is_binary = any(b > 127 for b in data)
        # Check if first few bytes are common CSV/JSON chars
        looks_like_text = data[:5].decode('utf-8', errors='ignore').isprintable()
        
        if is_binary and not looks_like_text:
            print("Status: ✅ [CONFIRMED ALE-ENCRYPTED BLOB]")
        else:
            print("Status: ℹ️ [LEGACY PLAINTEXT/METADATA]")
        print("-" * 50)

except Exception as e:
    print(f"Error: {e}")
