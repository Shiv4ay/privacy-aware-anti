
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    buckets = client.list_buckets()
    print("--- [GLOBAL ALE SEARCH] ---")
    for bucket in buckets:
        print(f"Searching Bucket: {bucket.name}")
        objects = client.list_objects(bucket.name, recursive=True)
        for obj in objects:
            if "1766" in obj.object_name:
                 print(f"FOUND: {bucket.name} / {obj.object_name} ({obj.size} bytes)")
                 res = client.get_object(bucket.name, obj.object_name)
                 data = res.read(64)
                 res.close()
                 print(f"Header: {data.hex(' ')}")
                 is_binary = any(b > 127 for b in data)
                 print(f"Status: {'✅ ENCRYPTED' if is_binary else 'ℹ️ PLAINTEXT'}")
                 print("-" * 30)

except Exception as e:
    print(f"Error: {e}")
