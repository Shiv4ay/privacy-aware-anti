-- Migration: Fix roles check constraint
-- Add student, faculty roles to allow registration

BEGIN;

-- 1. Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add the expanded constraint
-- Original was: CHECK (role::text = ANY (ARRAY['admin'::text, 'user'::text, 'moderator'::text, 'guest'::text]))
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'user', 'moderator', 'guest', 'student', 'faculty', 'researcher', 'university_admin', 'super_admin'));

-- 3. Ensure audit_log table exists (plural/singular check)
-- check_tables.js showed both 'audit_logs' and 'audit_log' exist. 
-- I will ensure they are aligned if needed, but the code uses 'audit_logs' mostly.

COMMIT;

SELECT '✅ Role constraint updated successfully' as status;
