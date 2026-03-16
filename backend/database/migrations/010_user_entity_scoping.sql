-- Migration to add entity_id and user_category for Zero-Trust Scoping
-- This allows mapping users to student/faculty IDs from the dataset

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS user_category VARCHAR(50);

-- Create index for faster retrieval filtering
CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);

-- Update the users_role_check to ensure it includes all possible roles from users.csv
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'data_steward', 'user', 'auditor', 'guest', 'student', 'faculty', 'researcher', 'university_admin'));

-- Log migration
INSERT INTO audit_logs (action, resource_type, details) 
VALUES ('migration', 'database', '{"version": "010", "description": "added entity_id and user_category for scoping"}');
