-- seed_users_and_doc.sql
-- Insert alice if not exists
INSERT INTO users (username, email, role_id, is_active, department, clearance_level)
SELECT 'alice','alice@example.com', ur.id, true, 'engineering','INTERNAL'
FROM user_roles ur
WHERE ur.name = 'user'
LIMIT 1
ON CONFLICT (username) DO UPDATE
  SET department = EXCLUDED.department, clearance_level = EXCLUDED.clearance_level;

-- Insert admin if not exists
INSERT INTO users (username, email, role_id, is_active, department, clearance_level)
SELECT 'admin','admin@example.com', ur.id, true, 'engineering','HIGH'
FROM user_roles ur
WHERE ur.name = 'admin'
LIMIT 1
ON CONFLICT (username) DO NOTHING;

-- Insert sample document with uploaded_by = alice's id
INSERT INTO documents (file_key, filename, original_filename, file_size, mime_type, status, uploaded_by)
VALUES ('sample-key-1','sample.pdf','sample.pdf',1234,'application/pdf','processed',
  (SELECT id FROM users WHERE username='alice' LIMIT 1)
)
ON CONFLICT (file_key) DO NOTHING;
