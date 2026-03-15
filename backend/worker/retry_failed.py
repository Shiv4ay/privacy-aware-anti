import os
import requests
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")

def retry_failed():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute("UPDATE documents SET status = 'pending' WHERE status = 'failed'")
            print(f"Updated {cur.rowcount} failed documents back to 'pending'.")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

    try:
        resp = requests.post("http://localhost:8001/process-batch?org_id=1&batch_size=500&force=true")
        print(f"API Response: {resp.status_code}")
    except Exception as e:
        print(f"API Error: {e}")

if __name__ == "__main__":
    retry_failed()
