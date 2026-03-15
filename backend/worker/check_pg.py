import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")

def check_db():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute("SELECT filename, status, count(*) FROM documents GROUP BY filename, status ORDER BY filename;")
            rows = cur.fetchall()
            print("Documents Status by Filename:")
            for r in rows:
                print(f"File: {r[0]:<20} | Status: {r[1]:<10} | Count: {r[2]}")
                
    except Exception as e:
        print(f"DB Error: {e}")

if __name__ == "__main__":
    check_db()
