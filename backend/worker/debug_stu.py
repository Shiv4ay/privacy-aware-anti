import psycopg2
import os
import json
import base64
from app import CryptoManager

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")

try:
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        # Check specifically for the student
        cur.execute("""
            SELECT id, file_key, metadata, encrypted_dek, encryption_iv, encryption_tag
            FROM documents 
            WHERE original_filename = 'students.csv' 
            AND org_id = 4
        """)
        rows = cur.fetchall()
        for r in rows:
            doc_id, file_key, metadata, encrypted_dek, encryption_iv, encryption_tag = r
            
            if isinstance(metadata, str):
                metadata_dict = json.loads(metadata)
            else:
                metadata_dict = metadata or {}
                
            encrypted_b64 = metadata_dict.get("encrypted_content")
            if encrypted_b64 and CryptoManager:
                try:
                    encrypted_bytes = base64.b64decode(encrypted_b64)
                    decrypted_bytes = CryptoManager.decrypt_envelope(
                        encrypted_bytes, 
                        encrypted_dek, 
                        encryption_iv, 
                        encryption_tag
                    )
                    decrypted_metadata = json.loads(decrypted_bytes.decode('utf-8'))
                    
                    # See if PES1PG24CA169 is in this row
                    text_content = str(decrypted_metadata)
                    if "PES1PG24CA169" in text_content:
                        print(f"--- MATCH FOUND in Doc ID: {doc_id} ---")
                        print("Decrypted Metadata:", decrypted_metadata)
                except Exception as e:
                    pass
except Exception as e:
    print(f"Error: {e}")
