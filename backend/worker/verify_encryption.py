
from minio import Minio
import os

# Configuration (internal worker networking)
MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(
    MINIO_HOST,
    access_key=ACCESS_KEY,
    secret_key=SECRET_KEY,
    secure=False
)

def check_recursive(bucket, prefix=""):
    objects = client.list_objects(bucket, prefix=prefix, recursive=True)
    count = 0
    for obj in objects:
        count += 1
        print(f"[{count}] File: {obj.object_name} | Size: {obj.size} bytes")
        
        # Read header
        response = client.get_object(bucket, obj.object_name)
        raw_header = response.read(32)
        response.close()
        response.release_conn()
        
        # Check if it looks like binary/encrypted (non-ASCII characters or high entropy)
        looks_encrypted = any(b > 127 for b in raw_header)
        status = "[CONFIRMED ENCRYPTED]" if looks_encrypted else "[PLAINTEXT/LEGACY]"
        
        print(f"    Raw Header (Hex): {raw_header.hex(' ')}")
        print(f"    Status: {status}")
        print("-" * 40)

try:
    print(f"--- [ALE STORAGE INSPECTOR] ---")
    check_recursive(BUCKET)
except Exception as e:
    print(f"Error: {e}")
