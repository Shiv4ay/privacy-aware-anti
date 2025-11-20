
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/privacy_rag'
});

const policies = [
    {
        organization: 'default',
        effect: 'allow',
        expression: JSON.stringify({ "==": [1, 1] }), // Allow everything for now for testing
        priority: 100,
        description: 'Default allow all for testing'
    },
    {
        organization: 'University',
        effect: 'allow',
        expression: JSON.stringify({ "==": [{ "var": "user.organization" }, "University"] }),
        priority: 10,
        description: 'Allow University users'
    },
    {
        organization: 'Hospital',
        effect: 'allow',
        expression: JSON.stringify({ "==": [{ "var": "user.organization" }, "Hospital"] }),
        priority: 10,
        description: 'Allow Hospital users'
    }
];

async function seed() {
    try {
        console.log('Ensuring table exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS abac_policies (
                id SERIAL PRIMARY KEY,
                organization VARCHAR(100) DEFAULT 'default',
                effect VARCHAR(10) CHECK (effect IN ('allow', 'deny')),
                expression TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                description TEXT,
                enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_abac_policies_org ON abac_policies(organization);
        `);

        console.log('Seeding policies...');
        for (const p of policies) {
            await pool.query(
                `INSERT INTO abac_policies (organization, effect, expression, priority, description) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [p.organization, p.effect, p.expression, p.priority, p.description]
            );
        }
        console.log('Policies seeded successfully.');
    } catch (err) {
        console.error('Error seeding policies:', err);
    } finally {
        await pool.end();
    }
}

seed();
