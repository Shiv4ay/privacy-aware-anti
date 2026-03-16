const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');

// Database configuration from .env
const pool = new Pool({
    connectionString: "postgresql://postgres:postgres123@localhost:5432/privacy_docs"
});

const CSV_PATH = 'c:/project3/AntiGravity/Datasets/University/pes_mca_dataset/users.csv';

async function importUsers() {
    console.log('--- Importing users from CSV to Database ---');
    
    // Create the table first
    const createTableQuery = `
        DROP TABLE IF EXISTS dataset_users;
        CREATE TABLE IF NOT EXISTS dataset_users (
            user_id VARCHAR(100),
            username VARCHAR(100),
            email VARCHAR(255) PRIMARY KEY,
            role VARCHAR(50),
            entity_id VARCHAR(100),
            department_id VARCHAR(50),
            login_email VARCHAR(255)
        );
        TRUNCATE TABLE dataset_users;
    `;
    
    try {
        await pool.query(createTableQuery);
        console.log('✅ table dataset_users prepared');
        
        const results = [];
        fs.createReadStream(CSV_PATH)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                console.log(`Parsed ${results.length} users from CSV`);
                
                for (const row of results) {
                    const query = `
                        INSERT INTO dataset_users (user_id, username, email, role, entity_id, department_id, login_email)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (email) DO UPDATE SET
                            user_id = EXCLUDED.user_id,
                            username = EXCLUDED.username,
                            role = EXCLUDED.role,
                            entity_id = EXCLUDED.entity_id,
                            department_id = EXCLUDED.department_id,
                            login_email = EXCLUDED.login_email;
                    `;
                    
                    const values = [
                        (row.user_id || '').trim(),
                        (row.username || '').trim(),
                        (row.email || '').trim(),
                        (row.role || '').trim(),
                        (row.entity_id || '').trim(),
                        (row.department_id || '').trim(),
                        (row.login_email || '').trim()
                    ];
                    
                    try {
                        await pool.query(query, values);
                    } catch (e) {
                        console.error(`Failed to insert ${row.email}:`, e.message);
                    }
                }
                
                console.log('✅ Import complete');
                process.exit(0);
            });
            
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

importUsers();
