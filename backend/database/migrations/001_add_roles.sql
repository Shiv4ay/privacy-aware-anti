-- Migration: Add new roles to users table check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'admin', 'data_steward', 'user', 'auditor', 'guest'));
