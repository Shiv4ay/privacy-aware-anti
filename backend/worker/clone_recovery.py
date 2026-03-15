import psycopg2
from psycopg2.extras import Json
import os
import json

DATABASE_URL = "postgresql://postgres:postgres123@postgres:5432/privacy_doc"
DB_NAME = "privacy_docs"

# Source: Org 1 student record for PES1PG24CA169
# Target: Org 4
SOURCE_DOC_ID = 11723
TARGET_ORG_ID = 4

def clone_record():
    print(f"Cloning Doc ID {SOURCE_DOC_ID} from Org 1 to Org {TARGET_ORG_ID}...")
    
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres123@postgres:5432/privacy_docs")
        with conn.cursor() as cur:
            # 1. Fetch the source record
            cur.execute("""
                SELECT file_key, filename, original_filename, file_path, uploaded_by, 
                       file_size, mime_type, content_type, metadata, 
                       is_encrypted, encrypted_dek, encryption_iv, encryption_tag
                FROM documents 
                WHERE id = %s
            """, (SOURCE_DOC_ID,))
            
            row = cur.fetchone()
            if not row:
                print(f"Error: Source Doc ID {SOURCE_DOC_ID} not found.")
                return

            (file_key, filename, original_filename, file_path, uploaded_by, 
             file_size, mime_type, content_type, metadata, 
             is_encrypted, encrypted_dek, encryption_iv, encryption_tag) = row

            # 2. Modify for Org 4
            # We generate a new file_key to avoid collisions
            new_file_key = f"4/recovery_{SOURCE_DOC_ID}_{file_key.split('/')[-1]}"
            
            # 3. Insert into Org 4
            cur.execute("""
                INSERT INTO documents 
                (file_key, filename, original_filename, file_path, uploaded_by, 
                 file_size, mime_type, content_type, org_id, status, metadata, 
                 is_encrypted, encrypted_dek, encryption_iv, encryption_tag)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (new_file_key, filename, original_filename, file_path, uploaded_by, 
                  file_size, mime_type, content_type, TARGET_ORG_ID, 'pending', Json(metadata),
                  is_encrypted, encrypted_dek, encryption_iv, encryption_tag))
            
            new_id = cur.fetchone()[0]
            conn.commit()
            print(f"Successfully cloned record to Org 4! New Doc ID: {new_id}")
            print(f"Status is set to 'pending' to trigger automatic processing.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    clone_record()
