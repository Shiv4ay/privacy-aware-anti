const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'privacy_aware_db',
    password: process.env.POSTGRES_PASSWORD || 'secure_password',
    port: process.env.POSTGRES_PORT || 5432,
});

const createTableQuery = `
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organizations(id),
    url TEXT,
    type TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
`;

async function applyUpdate() {
    try {
        console.log('Connecting to database...');
        await pool.query(createTableQuery);
        console.log('Successfully created ingestion_logs table.');
        process.exit(0);
    } catch (err) {
        console.error('Error applying schema update:', err);
        process.exit(1);
    }
}

applyUpdate();
