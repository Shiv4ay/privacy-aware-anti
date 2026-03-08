const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: 'localhost',
    database: process.env.POSTGRES_DB || 'privacy_docs',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    port: process.env.POSTGRES_PORT || 5432,
});

async function applyPrivacySchema() {
    try {
        console.log('Adding privacy_level to organizations table...');
        await pool.query(`
            ALTER TABLE organizations 
            ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'standard';
        `);
        console.log('Schema update applied successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error applying privacy schema:', err);
        process.exit(1);
    }
}

applyPrivacySchema();
