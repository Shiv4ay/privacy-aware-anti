
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print("--- [EXHAUSTIVE ENCRYPTION SCAN] ---")
    objects = client.list_objects(BUCKET, recursive=True)
    count = 0
    encrypted_found = 0
    for obj in objects:
        count += 1
        res = client.get_object(BUCKET, obj.object_name)
        data = res.read(32)
        res.close()
        
        # Binary data check
        is_binary = any(b > 127 for b in data)
        # Exclude common headers
        is_pdf = data.startswith(b"%PDF")
        
        if is_binary and not is_pdf:
            encrypted_found += 1
            print(f"Found Encrypted: {obj.object_name} ({obj.size} bytes)")
            print(f"Header: {data.hex(' ')}")
            print("-" * 20)
            if encrypted_found >= 3: break
            
    print(f"Scan complete. Scanned {count} files. Found {encrypted_found} encrypted.")
except Exception as e:
    print(f"Error: {e}")
