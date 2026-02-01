
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    buckets = client.list_buckets()
    for bucket in buckets:
        print(f"Bucket: {bucket.name}")
        objects = client.list_objects(bucket.name, recursive=True)
        for obj in objects:
            print(f"  - {obj.object_name} ({obj.size} bytes)")
except Exception as e:
    print(f"Error: {e}")
