-- Final UUID Consistency Sync
BEGIN;

-- 1. Drop constraints that might block the change
ALTER TABLE user_org_mapping DROP CONSTRAINT IF EXISTS user_org_mapping_user_id_fkey;

-- 2. Convert audit_logs
ALTER TABLE audit_logs ALTER COLUMN user_id TYPE UUID USING NULL;

-- 3. Convert user_org_mapping
ALTER TABLE user_org_mapping ALTER COLUMN user_id TYPE UUID USING NULL;

-- 4. Add the correct foreign key
ALTER TABLE user_org_mapping ADD CONSTRAINT user_org_mapping_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- 5. Ensure MFA secrets, Sessions, and Password History are UUID
-- (Adding explicit casts just in case they were stuck in some weird state)
ALTER TABLE auth_sessions ALTER COLUMN user_id TYPE UUID USING (user_id::uuid);
ALTER TABLE mfa_secrets ALTER COLUMN user_id TYPE UUID USING (user_id::uuid);
ALTER TABLE password_history ALTER COLUMN user_id TYPE UUID USING (user_id::uuid);

COMMIT;
