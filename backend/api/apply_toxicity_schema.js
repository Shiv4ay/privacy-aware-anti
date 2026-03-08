const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: 'localhost',
    database: process.env.POSTGRES_DB || 'privacy_docs',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    port: process.env.POSTGRES_PORT || 5432,
});

async function applyToxicitySchema() {
    try {
        console.log('Adding toxicity fields to documents table...');
        await pool.query(`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS is_toxic BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS toxicity_score FLOAT;
        `);
        console.log('Toxicity schema update applied successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error applying toxicity schema:', err);
        process.exit(1);
    }
}

applyToxicitySchema();
