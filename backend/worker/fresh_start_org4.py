import chromadb
import psycopg2
import os
import json
from psycopg2.extras import Json as PGJson

# Config
org_id = 4
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@postgres:5432/privacy_docs")

print(f"--- INITIATING TARGETED FRESH START FOR ORG {org_id} ---")

# 1. Wipe ChromaDB Collection
print("1. Wiping ChromaDB vector data...")
client = chromadb.HttpClient(host='chromadb', port=8000)
collection_name = f"privacy_documents_{org_id}"
try:
    client.delete_collection(name=collection_name)
    print(f"Successfully deleted collection {collection_name}")
except Exception as e:
    print(f"Note: Collection {collection_name} deletion skipped or failed: {e}")

# 2. Reset Document Status in Postgres
print("2. Resetting document statuses in PostgreSQL to 'pending'...")
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # We set processed documents back to pending to trigger re-indexing
    # We include 'failed' just in case
    cur.execute("""
        UPDATE documents 
        SET status = 'pending', 
            processed_at = NULL,
            content_preview = NULL
        WHERE org_id = %s 
        AND (status = 'processed' OR status = 'failed')
    """, (org_id,))
    
    count = cur.rowcount
    conn.commit()
    print(f"Successfully reset {count} documents to 'pending' state.")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error resetting database: {e}")

print("\n--- FRESH START PREP COMPLETE ---")
print("Next Steps: Restart the worker and trigger /process-batch?org_id=4")
