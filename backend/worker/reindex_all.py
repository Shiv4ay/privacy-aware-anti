import os
import time
import requests
import psycopg2
import chromadb

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")
CHROMA_HOST = os.getenv("CHROMADB_HOST", "chromadb")
CHROMA_PORT = int(os.getenv("CHROMADB_PORT", 8000))

def reset_and_reindex():
    print("--- 1. Resetting ChromaDB ---")
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        client.delete_collection("privacy_documents_1")
        print("Deleted collection 'privacy_documents_1' successfully.")
    except Exception as e:
        print(f"ChromaDB delete error (might not exist): {e}")

    print("\n--- 2. Resetting PostgreSQL Statuses ---")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute("UPDATE documents SET status = 'pending' WHERE status = 'processed';")
            updated = cur.rowcount
            print(f"Updated {updated} documents back to 'pending'.")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"PostgreSQL update error: {e}")
        return

    print("\n--- 3. Triggering Batch Processing API ---")
    try:
        # Pass force=true just in case
        resp = requests.post("http://localhost:8001/process-batch?org_id=1&batch_size=12000&force=true")
        print(f"API Response ({resp.status_code}): {resp.json()}")
    except Exception as e:
        print(f"API request error: {e}")

if __name__ == "__main__":
    reset_and_reindex()
