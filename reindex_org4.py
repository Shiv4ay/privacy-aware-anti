"""
Reindex Org 4 documents into ChromaDB.
The batch processor queries: WHERE status = 'pending'
So we must set documents to 'pending', not 'uploaded'.
"""
import psycopg2
import requests
import time

DB_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"
WORKER_URL = "http://localhost:8001"
ORG_ID = 4

# Step 1: Check current status
print("=== STEP 1: Check current document status ===")
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("SELECT status, COUNT(*) FROM documents WHERE org_id=%s GROUP BY status", (ORG_ID,))
for status, count in cur.fetchall():
    print(f"  Status '{status}': {count} documents")

# Step 2: Reset ALL to 'pending' (the status the batch processor looks for)
print("\n=== STEP 2: Resetting document status to 'pending' ===")
cur.execute("UPDATE documents SET status='pending', processed_at=NULL WHERE org_id=%s", (ORG_ID,))
conn.commit()
print(f"  Reset {cur.rowcount} documents to 'pending'")

# Verify
cur.execute("SELECT status, COUNT(*) FROM documents WHERE org_id=%s GROUP BY status", (ORG_ID,))
for status, count in cur.fetchall():
    print(f"  Status '{status}': {count} documents")
cur.close()
conn.close()

# Step 3: Trigger worker to re-process
print("\n=== STEP 3: Triggering /process-batch ===")
try:
    resp = requests.post(f"{WORKER_URL}/process-batch?org_id={ORG_ID}&batch_size=500", timeout=30)
    print(f"  Worker response: {resp.status_code} - {resp.text[:300]}")
except Exception as e:
    print(f"  Worker trigger: {e}")

# Step 4: Monitor ChromaDB population
print("\n=== STEP 4: Monitoring ChromaDB indexing (this will take several minutes) ===")
import chromadb
client = chromadb.HttpClient(host='localhost', port=8000)

for i in range(30):  # Monitor for up to 5 minutes
    time.sleep(10)
    try:
        col = client.get_collection('privacy_documents_4')
        count = col.count()
        print(f"  [{(i+1)*10}s] ChromaDB vector count: {count}")
        if count >= 19000:
            print(f"  INDEXING COMPLETE! Final count: {count}")
            break
    except Exception as e:
        print(f"  [{(i+1)*10}s] Collection error: {e}")

print("\n=== DONE ===")
