import os
import psycopg2

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT trigger_name, event_manipulation, event_object_table, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'documents';
    """)
    
    rows = cur.fetchall()
    
    with open('triggers_out.txt', 'w') as f:
        f.write("Triggers on documents table:\n")
        f.write("-" * 55 + "\n")
        for row in rows:
            f.write(f"Name: {row[0]}\n")
            f.write(f"Event: {row[1]}\n")
            f.write(f"Action: {row[3]}\n")
            f.write("-" * 30 + "\n")
            
    conn.close()
    print("Triggers written to triggers_out.txt")

except Exception as e:
    print(f"Error: {e}")
