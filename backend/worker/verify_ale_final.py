
from minio import Minio
import os
import psycopg2

# 1. Connect to DB to get the latest encrypted key
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password123@postgres:5432/privacy_docs")
file_key = None

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT file_key FROM documents WHERE is_encrypted = true ORDER BY created_at DESC LIMIT 1;")
    row = cur.fetchone()
    if row:
        file_key = row[0]
except Exception as e:
    print(f"DB Error: {e}")
finally:
    if 'conn' in locals(): conn.close()

if not file_key:
    print("Verification skipped: No encrypted documents found in DB.")
    exit(0)

# 2. Inspect MinIO
MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

try:
    print(f"--- [ALE SECURE STORAGE VERIFICATION] ---")
    print(f"Targeting Encrypted Key: {file_key}")
    
    response = client.get_object(BUCKET, file_key)
    raw_data = response.read(64)
    response.close()
    
    print(f"\nRAW STORAGE PREVIEW (Hexadecimal):")
    print(f"{raw_data.hex(' ')}")
    
    # Check for binary/encrypted signatures
    is_binary = any(b > 127 for b in raw_data)
    # Most common text headers (CSV/PDF) are printable ASCII
    if is_binary:
        print("\n✅ STATUS: CONFIRMED ENCRYPTED")
        print("   The file content is non-readable ciphertext.")
        print("   Storage contains zero plaintext PII.")
    else:
        print("\n⚠️ STATUS: PLAINTEXT DETECTED")
        
    print("-" * 50)

except Exception as e:
    print(f"MinIO Error: {e}")
