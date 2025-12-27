-- Phase 4 Enhancement: Application-Level Encryption (ALE)
-- Adds columns to track which documents are encrypted and store their unique envelope keys

BEGIN;

-- 1. Modify documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encrypted_dek TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encryption_iv TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encryption_tag TEXT;

-- 2. Audit Log for Encryption Events
-- (Ensures we track when sensitive operations occur)
INSERT INTO audit_log (action, success, metadata)
VALUES ('ale_schema_update', TRUE, '{"details": "ALE columns added to documents table"}');

-- 3. Comments for documentation
COMMENT ON COLUMN documents.is_encrypted IS 'Whether the file in storage is encrypted at the application level';
COMMENT ON COLUMN documents.encrypted_dek IS 'The Data Encryption Key (DEK) encrypted by the Master Key (KEK)';
COMMENT ON COLUMN documents.encryption_iv IS 'Initialization Vector for the data encryption';
COMMENT ON COLUMN documents.encryption_tag IS 'Authentication Tag for the data encryption (AES-GCM)';

COMMIT;
