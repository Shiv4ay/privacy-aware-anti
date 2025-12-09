const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: 'localhost',
    database: process.env.POSTGRES_DB || 'privacy_docs',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    port: process.env.POSTGRES_PORT || 5432,
});

const createOrganizationsTable = `
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT,
    domain TEXT,
    logo TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
`;

const updateUsersTable = `
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) CHECK (role IN ('super_admin', 'admin', 'user')),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS user_category VARCHAR(50);
`;

const updateDocumentsTable = `
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id);
`;

async function applyPhase2() {
    try {
        console.log('Creating organizations table...');
        await pool.query(createOrganizationsTable);

        console.log('Updating users table...');
        await pool.query(updateUsersTable);

        console.log('Updating documents table...');
        await pool.query(updateDocumentsTable);

        console.log('Phase 2 schema applied successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error applying Phase 2 schema:', err);
        process.exit(1);
    }
}

applyPhase2();
