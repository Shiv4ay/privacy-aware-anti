
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "documents" # Changed to 'documents'

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print(f"--- [ALE STORAGE INSPECTOR: BUCKET={BUCKET}] ---")
    objects = client.list_objects(BUCKET, recursive=True)
    count = 0
    for obj in objects:
        count += 1
        print(f"[{count}] File: {obj.object_name} | Size: {obj.size} bytes")
        
        # Read header
        response = client.get_object(BUCKET, obj.object_name)
        raw_header = response.read(32)
        response.close()
        response.release_conn()
        
        # Binary data check
        is_binary = any(b > 127 for b in raw_header)
        status = "[CONFIRMED ENCRYPTED]" if is_binary else "[PLAINTEXT/LEGACY]"
        
        print(f"    Raw Header (Hex): {raw_header.hex(' ')}")
        print(f"    Status: {status}")
        print("-" * 40)
        
        if count >= 30: # Check more files
             break

except Exception as e:
    print(f"Error: {e}")
