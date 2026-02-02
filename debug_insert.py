import psycopg2
import json

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    file_key = "debug_test_123"
    filename = "test.csv"
    
    # Try insertion
    try:
        cur.execute("""
            INSERT INTO documents 
            (file_key, filename, original_filename, file_path, created_at, uploaded_by, file_size, mime_type, content_type, org_id, status, metadata, is_encrypted, encrypted_dek, encryption_iv, encryption_tag)
            VALUES 
            (%s, %s, %s, %s, NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            file_key, "test.csv", "test.csv", "/uploads/test.csv",
            1, # uploaded_by (Integer)
            100, "text/csv", "text/csv",
            1, # org_id (Integer)
            "pending", json.dumps({"test": 1}), True, "dek", "iv", "tag"
        ))
        row = cur.fetchone()
        print(f"✅ Success! Inserted ID: {row[0]}")
        conn.rollback() # Don't actually save
        
    except Exception as e:
        print(f"❌ Insert Failed: {e}")
        conn.rollback()

    conn.close()

except Exception as e:
    print(f"Connection Error: {e}")
