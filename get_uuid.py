import psycopg2

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("SELECT id, user_id, username FROM users WHERE id = 1")
    row = cur.fetchone()
    
    if row:
        print(f"User ID: {row[0]}")
        print(f"UUID: {row[1]}")
        print(f"Username: {row[2]}")
    else:
        print("User 1 not found")
        
    conn.close()

except Exception as e:
    print(f"Error: {e}")
