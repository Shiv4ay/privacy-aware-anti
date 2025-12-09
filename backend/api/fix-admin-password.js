const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function main() {
    // Use DATABASE_URL if present, else fallback
    const client = new Client({
        connectionString:
            process.env.DATABASE_URL ||
            'postgresql://postgres:postgres123@postgres:5432/privacy_docs',
    });

    await client.connect();

    const PASSWORD = 'password'; // desired admin password

    const hash = await bcrypt.hash(PASSWORD, 10);

    console.log('Generated bcrypt hash length:', hash.length); // MUST be 60

    // Correction: using 'password_hash' column as per schema, not 'password'
    const res = await client.query(
        `UPDATE users SET password_hash = $1 WHERE email = 'admin@privacy-aware-rag.local';`,
        [hash]
    );

    console.log(`Updated ${res.rowCount} row(s).`);
    console.log('✅ Admin password reset to "password" with a clean bcrypt hash.');

    await client.end();
}

main().catch((err) => {
    console.error('Error in fix-admin-password:', err);
    process.exit(1);
});
