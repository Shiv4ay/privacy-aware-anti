import os
from minio import Minio

def check_minio():
    MINIO_HOST = os.getenv("MINIO_HOST", "minio")
    MINIO_PORT = os.getenv("MINIO_PORT", "9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
    MINIO_BUCKET = os.getenv("MINIO_BUCKET", "privacy-documents")

    client = Minio(
        f"{MINIO_HOST}:{MINIO_PORT}",
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False
    )

    print(f"Checking bucket: {MINIO_BUCKET}")
    try:
        if not client.bucket_exists(MINIO_BUCKET):
            print(f"Bucket {MINIO_BUCKET} does NOT exist!")
            return

        objects = client.list_objects(MINIO_BUCKET, prefix="uploads/4/", recursive=True)
        found = False
        for obj in objects:
            print(f"Found: {obj.object_name} ({obj.size} bytes)")
            found = True
        
        if not found:
            print("No objects found with prefix 'uploads/4/'")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_minio()
