
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print("--- [TARGETED ALE SEARCH] ---")
    objects = client.list_objects(BUCKET, recursive=True)
    for obj in objects:
        if "17668259705" in obj.object_name or obj.size > 50000:
            print(f"Match: {obj.object_name} ({obj.size} bytes)")
            res = client.get_object(BUCKET, obj.object_name)
            data = res.read(32)
            res.close()
            print(f"Header: {data.hex(' ')}")
            # If entropy is high or non-ASCII
            if any(b > 127 for b in data):
                 print("Result: ✅ ENCRYPTED")
            else:
                 print("Result: ℹ️ PLAINTEXT")
            print("-" * 20)
except Exception as e:
    print(f"Error: {e}")
