const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
// const { authMiddleware } = require('../middleware/authMiddleware');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// POST /api/user/setup
router.post('/setup', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId || req.user.id;
        const { organizationType, organizationName, roleCategory, department } = req.body;

        if (!organizationType || !roleCategory) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // 1. Handle Organization
        let orgId = req.user.org_id; // Default to current if not changing

        // If user selected a specific type and provided a name, we might need to find or create it
        // For simplicity in this phase, if they select "General" or a type, we update their metadata
        // In a real app, this might trigger a request to join an org or create one.
        // Here we will assume they are updating their profile within their CURRENT org, 
        // OR if they are in a default org, they might be "claiming" a new one.

        // For this specific requirement: "Popup shows dropdown... Automatically update backend"
        // We will update the user's profile fields.

        // Update User Profile
        const updateUserQuery = `
            UPDATE users 
            SET user_category = $1, 
                department = $2
            WHERE id = $3
            RETURNING id, username, email, role, org_id, department, user_category
        `;

        const result = await client.query(updateUserQuery, [
            roleCategory,
            department || 'General',
            userId
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('User setup error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        client.release();
    }
});

module.exports = router;
