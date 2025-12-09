// Minimal test auth routes
const express = require('express');
const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
    res.json({ message: 'Phase 4 auth routes working!' });
});

// Test with database
router.get('/test-db', async (req, res) => {
    try {
        const result = await req.db.query('SELECT COUNT(*) FROM users');
        res.json({ userCount: result.rows[0].count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
