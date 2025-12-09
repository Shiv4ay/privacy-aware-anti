-- Phase 4: Authentication & ABAC Database Schema (Compatible with existing schema)
-- Creates auth tables that work with existing users table (uses `id` instead of `user_id`)

-- 1. AUTH SESSIONS TABLE
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  access_token_hash TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_used TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_token ON auth_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_is_active ON auth_sessions(is_active) WHERE is_active = TRUE;

-- 2. PASSWORD RESET TOKENS TABLE
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_code VARCHAR(6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otp ON password_reset_tokens(otp_code) WHERE used = FALSE;

-- 3. MFA SECRETS TABLE
CREATE TABLE IF NOT EXISTS mfa_secrets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  recovery_codes TEXT[],
  backup_codes_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);

-- 4. PASSWORD HISTORY TABLE
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at DESC);

-- 5. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_success ON audit_log(success) WHERE success = FALSE;

-- 6. ADD COLUMNS TO USERS TABLE (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- 7. VIEWS AND FUNCTIONS
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

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 4 migration completed successfully!';
  RAISE NOTICE 'Created tables: auth_sessions, password_reset_tokens, mfa_secrets, password_history, audit_log';
END $$;
