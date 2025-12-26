"""Copy files from 'documents' bucket to 'privacy-documents' bucket"""
from minio import Minio
from minio.error import S3Error

# MinIO configuration
MINIO_ENDPOINT = "localhost:9000"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin123"

SOURCE_BUCKET = "documents"
TARGET_BUCKET = "privacy-documents"

# Initialize MinIO client
client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)

print(f"📦 Copying files from '{SOURCE_BUCKET}' to '{TARGET_BUCKET}'...")

# List all objects in source bucket
objects = client.list_objects(SOURCE_BUCKET, recursive=True)

copied = 0
failed = 0

for obj in objects:
    try:
        # Copy object using CopySource
        from minio.commonconfig import CopySource
        client.copy_object(
            TARGET_BUCKET,
            obj.object_name,
            CopySource(SOURCE_BUCKET, obj.object_name)
        )
        print(f"  ✅ Copied: {obj.object_name}")
        copied += 1
    except S3Error as e:
        print(f"  ❌ Failed to copy {obj.object_name}: {e}")
        failed += 1

print(f"\n{'='*60}")
print(f"📊 Copy Summary:")
print(f"  ✅ Copied: {copied}")
print(f"  ❌ Failed: {failed}")
print(f"{'='*60}")
