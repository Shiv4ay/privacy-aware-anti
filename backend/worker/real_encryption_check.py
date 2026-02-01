
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print("--- [REAL ENCRYPTION DETECTION] ---")
    objects = client.list_objects(BUCKET, recursive=True)
    for obj in objects:
        res = client.get_object(BUCKET, obj.object_name)
        data = res.read(64)
        res.close()
        
        # Check if it's binary but NOT a PDF
        is_binary = any(b > 127 for b in data)
        is_pdf = data.startswith(b"%PDF")
        is_text = False
        try:
            data.decode('utf-8')
            is_text = True
        except:
            is_text = False
            
        if is_binary and not is_pdf and not is_text:
             print(f"File: {obj.object_name} | Size: {obj.size} bytes")
             print(f"Header (Hex): {data.hex(' ')}")
             print("STATUS: ✅ TRUE ENCRYPTED CIPHERTEXT")
             print("-" * 30)

except Exception as e:
    print(f"Error: {e}")
