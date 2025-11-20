from minio import Minio
import os,sys
src = "/tmp/enhancing-healthcare.pdf"
endpoint = f"{os.getenv('MINIO_ENDPOINT','minio')}:{os.getenv('MINIO_PORT','9000')}"
c = Minio(endpoint, access_key=os.getenv('MINIO_ACCESS_KEY','admin'), secret_key=os.getenv('MINIO_SECRET_KEY','secure_password'), secure=False)
bucket = os.getenv('MINIO_BUCKET','privacy-documents')
if not c.bucket_exists(bucket):
    c.make_bucket(bucket)
c.fput_object(bucket, "enhancing-healthcare.pdf", src)
print("UPLOADED", bucket, "-> enhancing-healthcare.pdf")
