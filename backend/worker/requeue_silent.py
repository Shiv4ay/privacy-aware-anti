
import os
import json
import psycopg2
import redis
from psycopg2.extras import RealDictCursor
import time

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@privacy-aware-postgres:5432/privacy_docs")
REDIS_URL = os.getenv("REDIS_URL", "redis://privacy-aware-redis:6379/0")

def requeue_silent():
    print(f"Connecting to DB at {DATABASE_URL}...")
    # Increase timeout? Standard is usually fine.
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor) # use server-side cursor if too large? 700k is ~100MB. Client side fine.
    
    # Debug check
    cur.execute("SELECT count(*) as c FROM documents")
    total = cur.fetchone()['c']
    cur.execute("SELECT count(*) as c FROM documents WHERE status='pending'")
    pending = cur.fetchone()['c']
    print(f"DEBUG: Total Docs: {total}, Pending Docs: {pending}")

    print("Fetching ALL pending documents...")
    # Process all documents
    cur.execute("SELECT id, file_key, filename, org_id FROM documents WHERE status = 'pending'")
    rows = cur.fetchall()
    
    if not rows:
        print("No pending documents found (in first 100k batch).")
        conn.close()
        return

    print(f"Found {len(rows)} pending documents. Pushing to Redis...")
    
    r = redis.from_url(REDIS_URL)
    pipe = r.pipeline()
    
    count = 0
    for i, doc in enumerate(rows):
        job = {
            "type": "file",
            "key": doc["file_key"],
            "filename": doc["filename"],
            "org_id": doc["org_id"],
            "document_id": doc["id"]
        }
        pipe.rpush("document_jobs", json.dumps(job))
        count += 1
        if count % 1000 == 0:
            pipe.execute()
            if count % 10000 == 0:
                print(f"Queued {count}...")
    
    pipe.execute() # flush remainder
    print(f"Successfully re-queued {count} documents.")
    conn.close()

if __name__ == "__main__":
    requeue_silent()
