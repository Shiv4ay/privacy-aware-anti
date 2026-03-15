import psycopg2
import os
import json
import base64
from app import CryptoManager

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_docs")

SEARCH_SRNs = ["PES1PG24CA169", "PES1PG24CA001", "PES1PG24CA002"]
ORG_ID = 4

print(f"Auditing Org {ORG_ID} student records...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, metadata, encrypted_dek, encryption_iv, encryption_tag
            FROM documents 
            WHERE org_id = %s AND filename = 'students.csv'
        """, (ORG_ID,))
        
        rows = cur.fetchall()
        total_rows = len(rows)
        print(f"Total records in DB for students.csv (Org {ORG_ID}): {total_rows}")
        
        decrypted_srns = []
        found_targets = {srn: False for srn in SEARCH_SRNs}
        
        # Check first 50 rows for sample and search all rows for targets
        for i, r in enumerate(rows):
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
                    
                    srn = decrypted_metadata.get('srn') or decrypted_metadata.get('student_id')
                    if srn:
                        decrypted_srns.append(srn)
                        if srn in found_targets:
                            found_targets[srn] = True
                            print(f"FOUND TARGET {srn} in Doc ID {doc_id}")
                            
                except Exception as e:
                    pass

        print("\nTarget Check Results:")
        for srn, found in found_targets.items():
            print(f"- {srn}: {'FOUND' if found else 'NOT FOUND'}")

        if decrypted_srns:
            print(f"\nSample of first 10 decrypted SRNs (out of {len(decrypted_srns)} successfully decrypted):")
            print(decrypted_srns[:10])
        else:
            print("\nNo SRNs were successfully decrypted.")

except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
