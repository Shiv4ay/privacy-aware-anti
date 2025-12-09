-- Phase 4: Authentication & ABAC Database Schema
-- Creates all necessary tables for JWT auth, ABAC, password management, MFA, and audit logging

-- 1. AUTH SESSIONS TABLE
-- Stores active JWT sessions with refresh tokens
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  access_token_hash TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_used TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_refresh_token ON auth_sessions(refresh_token);
CREATE INDEX idx_auth_sessions_is_active ON auth_sessions(is_active) WHERE is_active = TRUE;

-- 2. PASSWORD RESET TOKENS TABLE
-- Stores OTP codes for password reset via email
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  ip_address INET,
  CONSTRAINT fk_user_reset FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_otp ON password_reset_tokens(otp_code) WHERE used = FALSE;

-- 3. MFA SECRETS TABLE
-- Stores TOTP secrets and recovery codes for multi-factor authentication
CREATE TABLE IF NOT EXISTS mfa_secrets (
  user_id VARCHAR(50) PRIMARY KEY,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  recovery_codes TEXT[], -- Array of hashed recovery codes
  backup_codes_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,
  CONSTRAINT fk_user_mfa FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. PASSWORD HISTORY TABLE
-- Prevents password reuse (last 5 passwords)
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_user_password_history FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at DESC);

-- 5. AUDIT LOG TABLE
-- Security event logging for compliance and attack detection
CREATE TABLE IF NOT EXISTS audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(50),
  action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'access_denied', 'password_change', etc.
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_success ON audit_log(success) WHERE success = FALSE;

-- 6. MODIFY USERS TABLE
-- Add authentication and authorization fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = TRUE;

-- 7. FUNCTION: Update timestamp on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. TRIGGER: Auto-update updated_at on users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. VIEW: Active sessions per user
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT 
    user_id,
    COUNT(*) as active_session_count,
    MAX(last_used) as last_activity
FROM auth_sessions
WHERE is_active = TRUE AND expires_at > NOW()
GROUP BY user_id;

-- 10. VIEW: Recent security events (last 24 hours)
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

-- 11. FUNCTION: Clean expired sessions (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth_sessions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 12. FUNCTION: Clean old audit logs (retain 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- COMMENTS for documentation
COMMENT ON TABLE auth_sessions IS 'Active JWT sessions with refresh tokens';
COMMENT ON TABLE password_reset_tokens IS 'OTP tokens for password reset';
COMMENT ON TABLE mfa_secrets IS 'TOTP secrets for multi-factor authentication';
COMMENT ON TABLE password_history IS 'Password history to prevent reuse';
COMMENT ON TABLE audit_log IS 'Security audit log for compliance and attack detection';

COMMENT ON COLUMN users.organization_id IS 'Multi-tenancy: user belongs to this organization';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for account lockout after 5 failed attempts';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp';
COMMENT ON COLUMN users.last_password_change IS 'Last password change timestamp (for password expiry policies)';

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_api_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_api_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_api_user;

COMMIT;
