# Run Schema Migration to add user_id column
import psycopg2

migration_file = r"C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\database\migrations\005_add_user_id_column.sql"

with open(migration_file, 'r', encoding='utf-8') as f:
    sql_script = f.read()

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"

try:
    print("🔄 Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False  # Use transaction
    cursor = conn.cursor()
    
    print("🔄 Running schema migration (adding user_id column)...")
    cursor.execute(sql_script)
    conn.commit()
    
    print("\n✅ Migration completed successfully!")
    
    # Verify the migration
    cursor.execute("SELECT user_id, id, username, email FROM users LIMIT 5;")
    users = cursor.fetchall()
    
    print(f"\n✅ Sample migrated users:")
    for user in users:
        print(f"   user_id={user[0]}, id={user[1]}, username={user[2]}")
    
    # Check Phase 4 tables
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'auth_sessions' AND column_name = 'user_id';
    """)
    result = cursor.fetchone()
    print(f"\n✅ auth_sessions.user_id type: {result[1]}")
    
    cursor.close()
    conn.close()
    print("\n🎉 Schema migration complete! Phase 4 is ready to use.")
    
except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    if conn:
        conn.rollback()
