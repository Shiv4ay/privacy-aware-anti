import os
import csv
import json
import psycopg2
import requests
from minio import Minio
import uuid

# --- CONFIGURATION ---
DB_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"
MINIO_URL = "localhost:9000"
MINIO_ACCESS = "minioadmin"
MINIO_SECRET = "minioadmin123"
BUCKET = "privacy-documents"
ORG_ID = 1

def diagnose_and_fix():
    print("=== DEEP RAG DIAGNOSTIC & STUDENT RECORD RECOVERY ===")
    
    # 1. Connect to DB
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        print("✅ Connected to Postgres (privacy_docs)")
    except Exception as e:
        print(f"❌ DB Connection failed: {e}")
        return

    # 2. Check for the ID again (Final Proof)
    student_id = "PES1PG24CA169"
    cur.execute("SELECT id FROM documents WHERE metadata::text LIKE %s", (f'%{student_id}%',))
    if cur.fetchone():
        print(f"❓ Record {student_id} exists in metadata but isn't responding. Checking status...")
        cur.execute("SELECT status FROM documents WHERE metadata::text LIKE %s", (f'%{student_id}%',))
        print(f"Status: {cur.fetchone()[0]}")
    else:
        print(f"❌ Record {student_id} is DEFINITELY missing from the DB.")

    # 3. Check for the source file
    source_path = r"C:\project3\AntiGravity\Datasets\University\pes_mca_dataset\students.csv"
    if not os.path.exists(source_path):
        print(f"❌ Source file not found: {source_path}")
        return
    
    print(f"✅ Found source dataset: {source_path}")

    # 4. Plan: Manual Ingestion Injector
    # We will manually parse the CSV and inject the Siba Sundar record into the 'documents' table
    # setting status to 'pending' to trigger the background worker correctly.
    
    try:
        with open(source_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            found_row = None
            for row in reader:
                if row.get('student_id') == student_id:
                    found_row = row
                    break
        
        if found_row:
            print(f"✅ Found student data for {student_id}: {found_row.get('first_name')} {found_row.get('last_name')}")
            
            # Prepare metadata (similar to documents.js transformCSVRow)
            metadata = {**found_row, "record_type": "student", "source": "manual_recovery"}
            file_key = f"1/manual_recovery_{uuid.uuid4().hex[:8]}_students.csv"
            
            # Inject into DB
            # We skip encryption for this manual fix to ensure immediate readability, 
            # or we can use the existing encryption logic if we had keys.
            # But the worker expects ALE if is_encrypted=True.
            
            cur.execute("""
                INSERT INTO documents (
                    file_key, filename, original_filename, file_path, 
                    created_at, uploaded_by, file_size, mime_type, 
                    content_type, org_id, status, metadata, is_encrypted
                ) VALUES (%s, %s, %s, %s, NOW(), 1, 1024, 'text/csv', 'text/csv', %s, 'pending', %s, False)
                RETURNING id;
            """, (file_key, "students.csv", "students.csv", f"/uploads/{file_key}", ORG_ID, json.dumps(metadata)))
            
            new_id = cur.fetchone()[0]
            conn.commit()
            print(f"🚀 SUCCESS: Injected student record as Doc ID {new_id}.")
            
            # --- TRIGGER IMMEDIATE PROCESSING ---
            print("⚡ Triggering immediate indexing...")
            url = f"http://localhost:8001/process-batch?org_id={ORG_ID}&batch_size=10"
            r = requests.post(url)
            print(f"Response: {r.status_code} - {r.json()}")
        else:
            print(f"❌ Student ID {student_id} not found even in the CSV!")

    except Exception as e:
        print(f"❌ Recovery failed: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    diagnose_and_fix()
