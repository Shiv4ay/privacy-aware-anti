
import os
import redis
import psycopg2
import json
import logging
from datetime import datetime, timedelta

# Redis Config
REDIS_HOST = os.getenv('REDIS_HOST', 'privacy-aware-redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_QUEUE = 'document_jobs'

# Postgres Configf
DB_HOST = os.getenv('DB_HOST', 'privacy-aware-postgres')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres123')
DB_NAME = os.getenv('DB_NAME', 'privacy_docs')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def requeue_recent():
    try:
        # Connect to Redis
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        
        # Connect to DB
        conn = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        cur = conn.cursor()
        
        # Find pending documents from last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        query = """
            SELECT id, filename, file_path, org_id, uploaded_by 
            FROM documents 
            WHERE status = 'pending' AND created_at > %s
        """
        cur.execute(query, (yesterday,))
        rows = cur.fetchall()
        
        logger.info(f"Found {len(rows)} pending documents from last 24h.")
        
        count = 0
        for row in rows:
            doc_id, filename, file_path, org_id, uploaded_by = row
            
            job = {
                "type": "process_document",
                "payload": {
                    "doc_id": doc_id,
                    "filename": filename,
                    "file_path": file_path,
                    "org_id": org_id,
                    "uploaded_by": uploaded_by
                }
            }
            
            r.rpush(REDIS_QUEUE, json.dumps(job))
            count += 1
            
        logger.info(f"Successfully requeued {count} jobs.")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    requeue_recent()
