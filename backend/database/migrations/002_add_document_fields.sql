-- Migration: Add department and sensitivity to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sensitivity VARCHAR(50);
