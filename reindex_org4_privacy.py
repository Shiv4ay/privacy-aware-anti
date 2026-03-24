"""
Re-Index Script for Org 4 (PES University)
Wipes the existing ChromaDB collection and resets document statuses,
then triggers a re-process to rebuild the index with student_id metadata.

IMPORTANT: This does NOT delete your documents or data from Postgres.
It only resets the vector index so the new privacy-hardened metadata gets stored.
"""
import chromadb
import psycopg2
import requests
import os
import sys

# Configuration
CHROMADB_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", 8000))
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@localhost:5432/privacy_docs")
WORKER_URL = os.getenv("WORKER_URL", "http://localhost:8001")
ORG_ID = 4

print(f"=" * 60)
print(f"RE-INDEXING ORG {ORG_ID} WITH STUDENT_ID METADATA")
print(f"=" * 60)

# Step 1: Delete the ChromaDB collection
print(f"\n[1/3] Deleting ChromaDB collection 'privacy_documents_{ORG_ID}'...")
try:
    client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
    collection_name = f"privacy_documents_{ORG_ID}"
    try:
        client.delete_collection(name=collection_name)
        print(f"  ✅ Deleted collection '{collection_name}'")
    except Exception as e:
        if "does not exist" in str(e).lower():
            print(f"  ⚠️ Collection '{collection_name}' does not exist (already clean)")
        else:
            raise
except Exception as e:
    print(f"  ❌ ChromaDB error: {e}")
    sys.exit(1)

# Step 2: Reset document statuses in Postgres
print(f"\n[2/3] Resetting document statuses to 'pending' for Org {ORG_ID}...")
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        "UPDATE documents SET status = 'pending', processed_at = NULL WHERE org_id = %s AND status = 'processed'",
        (ORG_ID,)
    )
    count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    print(f"  ✅ Reset {count} documents to 'pending'")
except Exception as e:
    print(f"  ❌ Postgres error: {e}")
    sys.exit(1)

# Step 3: Trigger re-processing via worker
print(f"\n[3/3] Triggering batch re-processing for Org {ORG_ID}...")
try:
    resp = requests.post(f"{WORKER_URL}/process-batch?org_id={ORG_ID}&batch_size=500", timeout=600)
    if resp.status_code == 200:
        data = resp.json()
        print(f"  ✅ Re-indexing complete!")
        print(f"     Processed: {data.get('processed', 0)}")
        print(f"     Failed: {data.get('failed', 0)}")
        print(f"     Remaining: {data.get('remaining', 0)}")
    else:
        print(f"  ❌ Worker returned status {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    print(f"  ❌ Worker error: {e}")
    print(f"  ⚠️ The documents are reset to 'pending'. You can re-run processing later.")

print(f"\n{'=' * 60}")
print(f"RE-INDEXING COMPLETE")
print(f"All documents now have student_id metadata for Zero-Trust RLS.")
print(f"{'=' * 60}")
