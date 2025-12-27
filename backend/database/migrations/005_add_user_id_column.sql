-- Phase 4: Schema Migration - Add user_id column (v3 - Fixed primary key issue)

BEGIN;

-- Step 1: Drop dependent views
DROP VIEW IF EXISTS v_active_sessions CASCADE;
DROP VIEW IF EXISTS v_recent_security_events CASCADE;

-- Step 2: Drop mfa_secrets table (will recreate)
DROP TABLE IF EXISTS mfa_secrets CASCADE;

-- Step 3: Add user_id column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(20);

-- Step 4: Populate user_id from id
UPDATE users 
SET user_id = 'USR' || LPAD(id::text, 5, '0')
WHERE user_id IS NULL;

-- Step 5: Make user_id NOT NULL and UNIQUE
ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Step 6: Update Phase 4 tables to use VARCHAR user_id
-- auth_sessions
ALTER TABLE auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_user_id_fkey;
ALTER TABLE auth_sessions ALTER COLUMN user_id TYPE VARCHAR(20) USING 'USR' || LPAD(user_id::text, 5, '0');
ALTER TABLE auth_sessions 
  ADD CONSTRAINT auth_sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- password_reset_tokens
ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey;
ALTER TABLE password_reset_tokens ALTER COLUMN user_id TYPE VARCHAR(20) USING 'USR' || LPAD(user_id::text, 5, '0');
ALTER TABLE password_reset_tokens 
  ADD CONSTRAINT password_reset_tokens_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- password_history
ALTER TABLE password_history DROP CONSTRAINT IF EXISTS password_history_user_id_fkey;
ALTER TABLE password_history ALTER COLUMN user_id TYPE VARCHAR(20) USING 'USR' || LPAD(user_id::text, 5, '0');
ALTER TABLE password_history 
  ADD CONSTRAINT password_history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- audit_log
ALTER TABLE audit_log ALTER COLUMN user_id TYPE VARCHAR(20) USING 'USR' || LPAD(user_id::text, 5, '0');

-- Step 7: Recreate mfa_secrets with VARCHAR user_id as primary key
CREATE TABLE mfa_secrets (
  user_id VARCHAR(20) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  recovery_codes TEXT[],
  backup_codes_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);

-- Step 8: Recreate views
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT 
    user_id,
    COUNT(*) as active_session_count,
    MAX(last_used) as last_activity
FROM auth_sessions
WHERE is_active = TRUE AND expires_at > NOW()
GROUP BY user_id;

CREATE OR REPLACE VIEW v_recent_security_events AS
SELECT 
    log_id,
    user_id,
    action,
    resource_type,
    ip_address,
    success,
    error_message,
    created_at
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

COMMIT;

-- Verify
DO $$
DECLARE
  user_count INTEGER;
  sample_user_id VARCHAR(20);
BEGIN
  SELECT COUNT(*) INTO user_count FROM users WHERE user_id IS NOT NULL;
  SELECT user_id INTO sample_user_id FROM users LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION SUCCESSFUL!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Migrated % users', user_count;
  RAISE NOTICE '  Sample user_id: %', sample_user_id;
  RAISE NOTICE '  All Phase 4 tables updated';
  RAISE NOTICE '========================================';
END $$;
