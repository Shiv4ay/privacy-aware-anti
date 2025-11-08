-- backend/database/2025_phase3_privacy.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users table (if not present)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  roles JSONB DEFAULT '[]'::jsonb,
  department TEXT,
  clearance_level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  owner_id UUID NOT NULL,
  department TEXT,
  sensitivity TEXT CHECK (sensitivity IN ('PUBLIC','INTERNAL','CONFIDENTIAL','PII')) DEFAULT 'PUBLIC',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- document_acls
CREATE TABLE IF NOT EXISTS document_acls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  subject_type TEXT CHECK (subject_type IN ('user','role','department')),
  subject_value TEXT,
  permission TEXT CHECK (permission IN ('read','search','download','edit')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- abac_policies
CREATE TABLE IF NOT EXISTS abac_policies (
  id TEXT PRIMARY KEY,
  description TEXT,
  effect TEXT CHECK (effect IN ('allow','deny')),
  expression JSONB,
  priority INT DEFAULT 100,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  username TEXT,
  action TEXT,
  resource_id UUID,
  query_hash TEXT,
  query_redacted TEXT,
  result_count INT,
  document_ids JSONB,
  client_ip TEXT,
  user_agent TEXT,
  decision TEXT,
  policy_id TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (timestamp);
