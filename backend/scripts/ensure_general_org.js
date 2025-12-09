const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/privacy_rag'
});

async function ensureGeneralOrg() {
    try {
        const res = await pool.query("SELECT * FROM organizations WHERE name = 'General'");
        if (res.rows.length === 0) {
            console.log("Creating 'General' organization...");
            await pool.query("INSERT INTO organizations (name, type) VALUES ('General', 'general')");
            console.log("'General' organization created.");
        } else {
            console.log("'General' organization already exists.");
        }

        const allOrgs = await pool.query("SELECT * FROM organizations");
        console.log("All Organizations:", allOrgs.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

ensureGeneralOrg();
