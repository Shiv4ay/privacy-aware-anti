# Run Compatible Phase 4 Database Migration
import psycopg2

migration_file = r"C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\database\migrations\004_auth_system_compatible.sql"

with open(migration_file, 'r', encoding='utf-8') as f:
    sql_script = f.read()

DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/privacy_docs"

try:
    print("🔄 Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("🔄 Running Phase 4 migration (compatible version)...")
    cursor.execute(sql_script)
    
    print("\n✅ Migration completed successfully!")
    
    # Verify tables
    cursor.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('auth_sessions', 'password_reset_tokens', 'mfa_secrets', 'password_history', 'audit_log')
        ORDER BY table_name;
    """)
    
    tables = cursor.fetchall()
    print(f"\n✅ Created {len(tables)} new tables:")
    for table in tables:
        print(f"   ✓ {table[0]}")
    
    # Check users table updates
    cursor.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('is_mfa_enabled', 'failed_login_attempts', 'locked_until', 'last_password_change', 'last_login');
    """)
    
    columns = cursor.fetchall()
    print(f"\n✅ Added {len(columns)} columns to users table:")
    for col in columns:
        print(f"   ✓ {col[0]}")
    
    cursor.close()
    conn.close()
    print("\n🎉 Phase 4 database migration complete! Ready for auth system integration.")
    
except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
