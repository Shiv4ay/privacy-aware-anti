const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Use localhost connection string for running from host
const connectionString = 'postgresql://postgres:postgres123@localhost:5432/privacy_docs';

const pool = new Pool({
    connectionString: connectionString
});

async function resetAdminPassword() {
    const newPassword = process.argv[2];

    if (!newPassword) {
        console.error("Usage: node reset_admin_password.js <new_password>");
        process.exit(1);
    }

    try {
        console.log("Connecting to database...");
        const saltRounds = 10;
        const hash = await bcrypt.hash(newPassword, saltRounds);

        console.log(`Resetting password for user 'admin'...`);
        const res = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE username = 'admin' RETURNING id, username, email",
            [hash]
        );

        if (res.rows.length > 0) {
            console.log("✅ Success! Password updated for user:", res.rows[0].username);
            console.log("You can now login with:");
            console.log(`Email: ${res.rows[0].email}`);
            console.log(`Password: ${newPassword}`);
        } else {
            console.log("❌ Error: User 'admin' not found.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
