"""
Direct CSV File Processor - Bypasses API and directly processes files through worker logic
This mimics what the upload system does but without needing authentication
"""
import os
import sys
import csv
import requests
import psycopg2
from datetime import datetime

# Configuration
DATASET_DIR = r"c:\project3\AntiGravity\Datasets\University\final"
EXCLUDE_FILES = ["attendance.csv"]

# Database connection
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "privacy_docs",
    "user": "postgres",
    "password": "postgres123"
}

# Worker URL
WORKER_URL = "http://localhost:8001"

def insert_document_to_db(filename, org_id=1):
    """Insert document record into PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Insert document
        query = """
        INSERT INTO documents (file_key, filename, original_filename, file_size, mime_type, org_id, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        
        filepath = os.path.join(DATASET_DIR, filename)
        file_size = os.path.getsize(filepath)
        file_key = f"uploads/{org_id}/{filename}"  # Unique key
        
        cur.execute(query, (
            file_key,
            filename,
            filename,  # original_filename
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

def trigger_worker_processing(doc_id):
    """Trigger worker to process document"""
    try:
        # The worker's background processor should pick this up automatically
        # We just need to ensure it's in the queue
        print(f"  📋 Document ID {doc_id} queued for processing")
        return True
    except Exception as e:
        print(f"  ❌ Worker trigger error: {e}")
        return False

# Get all CSV files
csv_files = [f for f in os.listdir(DATASET_DIR) if f.endswith('.csv') and f not in EXCLUDE_FILES]
csv_files.sort()

print(f"📁 Found {len(csv_files)} CSV files to process:")
for f in csv_files:
    size_mb = os.path.getsize(os.path.join(DATASET_DIR, f)) / (1024 * 1024)
    print(f"  - {f} ({size_mb:.2f} MB)")

print(f"\n🚀 Starting upload to database...")

successful = 0
failed = 0

for filename in csv_files:
    print(f"\n📤 Processing {filename}...")
    
    # Insert to database
    doc_id = insert_document_to_db(filename)
    
    if doc_id:
        print(f"  ✅ Added to database (ID: {doc_id})")
        
        # Trigger processing
        if trigger_worker_processing(doc_id):
            successful += 1
        else:
            failed += 1
    else:
        failed += 1

print(f"\n{'='*60}")
print(f"📊 Upload Summary:")
print(f"  ✅ Queued: {successful}/{len(csv_files)}")
print(f"  ❌ Failed: {failed}/{len(csv_files)}")
print(f"\n💡 The worker will process these files in the background.")
print(f"   Monitor progress with the monitor_chroma.ps1 script.")
print(f"{'='*60}")
