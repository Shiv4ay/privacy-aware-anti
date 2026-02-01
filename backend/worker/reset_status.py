
import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@postgres:5432/privacy_docs")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Reset status to pending for some documents to force re-indexing
    # Targeting students.csv specifically
    cur.execute("UPDATE documents SET status = 'pending' WHERE filename = 'students.csv';")
    print(f"Updated {cur.rowcount} rows in documents table.")
    
    conn.commit()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
