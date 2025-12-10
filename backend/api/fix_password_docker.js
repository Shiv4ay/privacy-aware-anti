const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Use the environment variable which Docker sets correctly
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function resetAdminPassword() {
    const newPassword = 'password'; // Hardcoded for simplicity/certainty

    try {
        console.log("Connecting to database at:", process.env.DATABASE_URL?.split('@')[1]); // Log safe part

        const saltRounds = 10;
        const hash = await bcrypt.hash(newPassword, saltRounds);

        // Update by EMAIL to be sure, as username might vary
        console.log(`Resetting password for 'admin@privacy-aware-rag.local'...`);
        const res = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE email = 'admin@privacy-aware-rag.local' RETURNING id, username, email",
            [hash]
        );

        if (res.rows.length > 0) {
            console.log("✅ Success! Password updated for:", res.rows[0].email);
            console.log("New Password: password");
        } else {
            console.log("❌ Error: User 'admin@privacy-aware-rag.local' not found.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
