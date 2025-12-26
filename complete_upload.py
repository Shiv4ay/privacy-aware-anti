"""
Complete document upload pipeline - uploads to MinIO, creates DB records, triggers processing
"""
import os
import psycopg2
from datetime import datetime
from minio import Minio
from minio.error import S3Error

# Configuration
DATASET_DIR = r"c:\project3\AntiGravity\Datasets\University\final"
EXCLUDE_FILES = ["attendance.csv"]
ORG_ID = 1

# MinIO configuration
MINIO_ENDPOINT = "localhost:9000"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin123"
MINIO_BUCKET = "documents"

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "privacy_docs",
    "user": "postgres",
    "password": "postgres123"
}

# Initialize MinIO client
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False  # Use secure=True in production with HTTPS
)

# Ensure bucket exists
try:
    if not minio_client.bucket_exists(MINIO_BUCKET):
        minio_client.make_bucket(MINIO_BUCKET)
        print(f"✅ Created bucket: {MINIO_BUCKET}")
    else:
        print(f"✅ Bucket exists: {MINIO_BUCKET}")
except S3Error as e:
    print(f"❌ MinIO error: {e}")
    exit(1)

def upload_to_minio(filepath, file_key):
    """Upload file to MinIO"""
    try:
        minio_client.fput_object(
            MINIO_BUCKET,
            file_key,
            filepath,
            content_type="text/csv"
        )
        return True
    except S3Error as e:
        print(f"  ❌ MinIO upload error: {e}")
        return False

def insert_document_to_db(filename, file_key, file_size, org_id=1):
    """Insert document record into PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        query = """
        INSERT INTO documents (file_key, filename, original_filename, file_size, mime_type, org_id, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        
        cur.execute(query, (
            file_key,
            filename,
            filename,
            file_size,
            "text/csv",
            org_id,
            "pending",
            datetime.now()
        ))
        
        doc_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return doc_id
        
    except Exception as e:
        print(f"  ❌ Database error: {e}")
        return None

# Get all CSV files
csv_files = [f for f in os.listdir(DATASET_DIR) if f.endswith('.csv') and f not in EXCLUDE_FILES]
csv_files.sort()

print(f"📁 Found {len(csv_files)} CSV files to upload:")
for f in csv_files:
    size_mb = os.path.getsize(os.path.join(DATASET_DIR, f)) / (1024 * 1024)
    print(f"  - {f} ({size_mb:.2f} MB)")

print(f"\n🚀 Starting complete upload pipeline...")

successful = 0
failed = 0

for filename in csv_files:
    filepath = os.path.join(DATASET_DIR, filename)
    file_size = os.path.getsize(filepath)
    file_key = f"uploads/{ORG_ID}/{filename}"
    
    print(f"\n📤 Processing {filename}...")
    
    # Step 1: Upload to MinIO
    print(f"  ⬆️  Uploading to MinIO...")
    if not upload_to_minio(filepath, file_key):
        failed += 1
        continue
    print(f"  ✅ MinIO upload successful")
    
    # Step 2: Insert to database
    print(f"  💾 Creating database record...")
    doc_id = insert_document_to_db(filename, file_key, file_size)
    
    if doc_id:
        print(f"  ✅ Document created (ID: {doc_id})")
        successful += 1
    else:
        failed += 1

print(f"\n{'='*60}")
print(f"📊 Upload Summary:")
print(f"  ✅ Successful: {successful}/{len(csv_files)}")
print(f"  ❌ Failed: {failed}/{len(csv_files)}")
print(f"\n💡 The worker will automatically process these files.")
print(f"   Monitor progress with: docker logs -f privacy-aware-worker")
print(f"{'='*60}")
