-- Add missing columns safely (no destructive changes)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS clearance_level TEXT;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sensitivity TEXT CHECK (sensitivity IN ('PUBLIC','INTERNAL','CONFIDENTIAL','PII')) DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb; -- optional alias if needed

-- Create document_acls matching integer PK type on documents.id
CREATE TABLE IF NOT EXISTS document_acls (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  subject_type TEXT CHECK (subject_type IN ('user','role','department')),
  subject_value TEXT,
  permission TEXT CHECK (permission IN ('read','search','download','edit')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Ensure abac_policies exists (you already have it; keep as-is)
-- Ensure audit_logs has columns expected by your app (it exists already)
