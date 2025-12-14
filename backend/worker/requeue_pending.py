
import os
import json
import psycopg2
import redis
from psycopg2.extras import RealDictCursor

# Config from env (defaults match docker-compose)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@postgres:5432/privacy_docs")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

def requeue():
    print("Connecting to DB...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check connection actually works
        cur.execute("SELECT 1")
        print("DB Connected.")

        # Get pending documents
        print("Fetching pending documents...")
        cur.execute("SELECT id, file_key, filename, org_id FROM documents WHERE status = 'pending'")
        rows = cur.fetchall()
        
        if not rows:
            print("No pending documents found.")
            return

        print(f"Found {len(rows)} pending documents.")
        
        # Connect to Redis
        r = redis.from_url(REDIS_URL)
        print("Redis Connected.")
        
        count = 0
        for doc in rows:
            job = {
                "type": "file",
                "key": doc["file_key"],
                "filename": doc["filename"],
                "org_id": doc["org_id"],
                "document_id": doc["id"]
            }
            # Push to right side of list (queue)
            r.rpush("document_jobs", json.dumps(job))
            print(f"Re-queued: {doc['filename']}")
            count += 1
            
        print(f"Successfully re-queued {count} documents.")
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    requeue()
