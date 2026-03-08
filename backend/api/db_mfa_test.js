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
        const users = await pool.query('SELECT id, email, is_mfa_enabled FROM users');
        console.log('Users MFA Status:', users.rows);
    } catch (err) {
        console.error(err);
    } finally { pool.end(); }
}
check();
