
from minio import Minio
import os

MINIO_HOST = "minio:9000"
ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin123")
BUCKET = "privacy-documents"

client = Minio(MINIO_HOST, access_key=ACCESS_KEY, secret_key=SECRET_KEY, secure=False)

def check_entropy(data):
    # AES-GCM Ciphertext has high entropy (rarely contains printable ASCII sequences)
    if not data: return False
    try:
        data.decode('utf-8')
        return False # It's valid UTF-8 text (likely plaintext)
    except UnicodeDecodeError:
        return True # It's binary/cipher data

try:
    print("\n" + "="*60)
    print("      SHIELD AI: PRIVACY STORAGE INSPECTOR (ALE-VERIFY)")
    print("="*60)
    
    objects = client.list_objects(BUCKET, recursive=True)
    found_any = False
    
    for obj in objects:
        found_any = True
        res = client.get_object(BUCKET, obj.object_name)
        header = res.read(64)
        res.close()
        
        is_encrypted = check_entropy(header)
        status = "✅ [ALE ENCRYPTED]" if is_encrypted else "ℹ️ [LEGACY PLAINTEXT]"
        
        print(f"FILE: {obj.object_name.ljust(45)}")
        print(f"SIZE: {str(obj.size).ljust(10)} | STATUS: {status}")
        print(f"PREVIEW (HEX): {header[:16].hex(' ')} ...")
        print("-" * 60)
        
    if not found_any:
        print("No documents found in storage.")

except Exception as e:
    print(f"Inspector Error: {e}")
