-- DPDP Act 2023 §6: explicit consent records per user per purpose.
CREATE TABLE IF NOT EXISTS consent_records (
    id           SERIAL PRIMARY KEY,
    user_id      VARCHAR(50)  NOT NULL,
    org_id       INTEGER      NOT NULL,
    purpose      VARCHAR(100) NOT NULL,
    granted      BOOLEAN      NOT NULL,
    granted_at   TIMESTAMP,
    withdrawn_at TIMESTAMP,
    ip_address   INET,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_consent_user_purpose UNIQUE (user_id, purpose)
);
CREATE INDEX IF NOT EXISTS idx_consent_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_org_id  ON consent_records(org_id);
INSERT INTO audit_logs (action, resource_type, details)
VALUES ('migration', 'database', '{"version": "012", "description": "DPDP consent_records table"}');
