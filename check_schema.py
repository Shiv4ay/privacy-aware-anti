# Check current database schema
import psycopg2

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Check users table structure
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
    """)
    
    print("Current 'users' table structure:")
    for row in cursor.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
