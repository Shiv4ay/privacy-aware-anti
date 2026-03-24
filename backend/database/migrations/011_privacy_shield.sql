-- T9.4: Privacy Shield Toggle
-- Adds server-side per-user privacy shield flag.
-- When enabled, PII de-anonymization is suppressed so the LLM response
-- retains anonymized tokens ([PERSON:idx_0]) rather than being
-- substituted back to real values before returning to the client.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS privacy_shield_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Log migration
INSERT INTO audit_logs (action, resource_type, details)
VALUES ('migration', 'database', '{"version": "011", "description": "added privacy_shield_enabled for T9.4 Privacy Shield Toggle"}');
