
import os
import json
import base64
import time
from minio import Minio
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

# --- Configuration ---
MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"
# Master Key from .env
MASTER_KEY_HEX = "2aa4fbe08383ca44dd57365711ef438430930c74855e3e4ac5b3829114bca9da"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

def perform_ale_upload(filename, content_text):
    print(f"--- [ALE ENCRYPTION START] File: {filename} ---")
    
    # 1. Generate Data Encryption Key (DEK)
    dek = AESGCM.generate_key(bit_length=256)
    
    # 2. Encrypt Content with DEK
    aesgcm = AESGCM(dek)
    iv = os.urandom(12)
    ciphertext = aesgcm.encrypt(iv, content_text.encode('utf-8'), None)
    
    # 3. Simulate "Wrapping" DEK with Master Key (Envelope Encryption)
    master_key = bytes.fromhex(MASTER_KEY_HEX)
    master_aesgcm = AESGCM(master_key)
    wrapped_dek = master_aesgcm.encrypt(iv, dek, None) # Using same IV for demo simplicity
    
    # 4. Upload to MinIO
    file_key = f"ale_demo_{int(time.time())}_{filename}"
    from io import BytesIO
    client.put_object(BUCKET, file_key, BytesIO(ciphertext), len(ciphertext))
    
    print(f"✅ Uploaded to MinIO: {file_key}")
    print(f"🔒 Status: AES-256-GCM Encrypted")
    print(f"🔑 Wrapped DEK: {base64.b64encode(wrapped_dek).decode()}")
    print("-" * 50)
    return file_key

if __name__ == "__main__":
    sensitive_data = """
    SECRET STUDENT RECORDS - GRADE RECOVERY LIST
    ID: STU999, Name: Confidential User, GPA Override: 4.0
    Social Security: [REDACTED BY SHIELD]
    """
    perform_ale_upload("confidential_records.txt", sensitive_data)
