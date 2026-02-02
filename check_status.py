import psycopg2
import requests
import os

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"
CHROMA_URL = "http://localhost:8000/api/v1/collections/privacy_documents_1"

def check_postgres():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT status, COUNT(*) FROM documents GROUP BY status")
        rows = cur.fetchall()
        print("\n--- Postgres Document Status ---")
        for row in rows:
            print(f"Status '{row[0]}': {row[1]}")
        conn.close()
    except Exception as e:
        print(f"Postgres Error: {e}")

def check_chroma():
    try:
        # First list collections to be sure of the name
        resp = requests.get("http://localhost:8000/api/v1/collections")
        if resp.status_code == 200:
            cols = resp.json()
            print("\n--- ChromaDB Collections ---")
            for c in cols:
                print(f"Name: {c['name']}, ID: {c['id']}")
                # Get count for each
                count_resp = requests.get(f"http://localhost:8000/api/v1/collections/{c['id']}/count")
                if count_resp.status_code == 200:
                    print(f"  Count: {count_resp.json()}")
        else:
            print(f"Chroma List Failed: {resp.status_code} - {resp.text}")

    except Exception as e:
        print(f"Chroma Error: {e}")

if __name__ == "__main__":
    check_postgres()
    check_chroma()
