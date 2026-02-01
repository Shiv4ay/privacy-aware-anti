
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print(f"--- [FULL INSPECTION: {BUCKET}] ---")
    objects = client.list_objects(BUCKET, recursive=True)
    for obj in objects:
        print(f"File: {obj.object_name} ({obj.size} bytes)")
        
        # Check if it's the one we want
        if "users.csv" in obj.object_name and obj.size > 100000:
             response = client.get_object(BUCKET, obj.object_name)
             data = response.read(64)
             response.close()
             print(f"    Raw Hex: {data.hex(' ')}")
             is_binary = any(b > 127 for b in data)
             print(f"    Status: {'✅ ENCRYPTED' if is_binary else 'ℹ️ PLAINTEXT'}")
             print("-" * 30)

except Exception as e:
    print(f"Error: {e}")
