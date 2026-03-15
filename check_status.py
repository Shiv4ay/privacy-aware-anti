import psycopg2
import chromadb

try:
    conn = psycopg2.connect('postgresql://postgres:postgres123@localhost:5432/privacy_docs')
    cur = conn.cursor()
    cur.execute("SELECT status, COUNT(*) as c FROM documents WHERE org_id=4 GROUP BY status")
    print("Database Status:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    conn.close()
    
    c = chromadb.HttpClient(host='localhost', port=8000)
    col = c.get_collection('privacy_documents_4')
    print(f"\nChromaDB Vector Count: {col.count()}")
except Exception as e:
    print(f"Error checking status: {e}")
