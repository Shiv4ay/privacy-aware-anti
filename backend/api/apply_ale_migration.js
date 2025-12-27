const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: 'localhost',
    database: process.env.POSTGRES_DB || 'privacy_docs',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    port: process.env.POSTGRES_PORT || 5432,
});

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, '../database/migrations/006_add_ale_columns.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Applying ALE migration...');
        await pool.query(sql);
        console.log('ALE migration successful.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
