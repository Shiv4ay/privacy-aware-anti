import psycopg2
import os
import json
import base64
from app import CryptoManager

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_docs")

SEARCH_SRN = "PES1PG24CA169"
ORG_ID = 4

print(f"Searching for {SEARCH_SRN} in Org {ORG_ID} (Decrying metadata)...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, metadata, encrypted_dek, encryption_iv, encryption_tag
            FROM documents 
            WHERE org_id = %s AND filename = 'students.csv'
        """, (ORG_ID,))
        
        rows = cur.fetchall()
        print(f"Fetched {len(rows)} records for students.csv in Org {ORG_ID}")
        
        found = False
        for r in rows:
            doc_id, metadata, encrypted_dek, encryption_iv, encryption_tag = r
            
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
                    
                    if SEARCH_SRN in str(decrypted_metadata):
                        print(f"\n--- MATCH FOUND: Doc ID {doc_id} ---")
                        # print(json.dumps(decrypted_metadata, indent=2))
                        # Specifically check demographics
                        print(f"Gender: {decrypted_metadata.get('gender')}")
                        print(f"Home State: {decrypted_metadata.get('home_state')}")
                        print(f"Full Metadata Keys: {list(decrypted_metadata.keys())}")
                        found = True
                        break
                except Exception as e:
                    # print(f"Decryption failed for Doc {doc_id}: {e}")
                    pass
            else:
                # Check unencrypted metadata just in case
                if SEARCH_SRN in str(metadata_dict):
                    print(f"\n--- MATCH FOUND (Unencrypted): Doc ID {doc_id} ---")
                    print(f"Gender: {metadata_dict.get('gender')}")
                    print(f"Home State: {metadata_dict.get('home_state')}")
                    found = True
                    break

        if not found:
            print(f"\nSRN {SEARCH_SRN} not found in Org {ORG_ID} records.")

except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
