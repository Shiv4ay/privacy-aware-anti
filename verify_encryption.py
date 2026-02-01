
import boto3
import os
from botocore.client import Config

# Configuration from environment or defaults
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
BUCKET = "privacy-documents"

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)

try:
    print(f"--- Listing files in MinIO bucket: {BUCKET} ---")
    response = s3.list_objects_v2(Bucket=BUCKET)
    if "Contents" in response:
        for obj in response["Contents"]:
            key = obj["Key"]
            print(f"Found File: {key} ({obj['Size']} bytes)")
            
            # Preview first 32 bytes to prove encryption
            data = s3.get_object(Bucket=BUCKET, Key=key, Range="bytes=0-31")
            content = data["Body"].read()
            print(f"Raw Encrypted Start (Hex): {content.hex(' ')}")
            print("-" * 30)
    else:
        print("No files found in bucket.")
except Exception as e:
    print(f"Error: {e}")
