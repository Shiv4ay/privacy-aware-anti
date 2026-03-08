const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'postgres',
    database: 'privacy_docs',
    password: 'postgres123',
    port: 5432,
});

async function check() {
    try {
        const orgs = await pool.query('SELECT * FROM organizations');
        console.log('Organizations:', orgs.rows);

        const users = await pool.query('SELECT id, user_id, email, org_id FROM users');
        console.log('Users:', users.rows);

        const mapping = await pool.query('SELECT * FROM user_org_mapping');
        console.log('Mappings:', mapping.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
check();
