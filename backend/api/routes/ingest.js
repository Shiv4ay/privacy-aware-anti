const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../index').pool; // Access pool from index or require pg directly if exported? 
// Better to require pg here or use a shared db module. 
// index.js exports app, but maybe not pool. 
// Let's assume we can get pool from req or create new one, or better, require from a db module if it exists.
// index.js has the pool. Let's check if it exports it.
// If not, we'll create a new pool or rely on the worker URL.

// Actually, for triggering ingestion, we just need to call the worker.
// For logs, we need DB access.

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

// Trigger Dummy Ingestion
router.post('/dummy/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const org_id = req.user.org_id; // From authMiddleware

        if (!['university', 'hospital', 'finance'].includes(type)) {
            return res.status(400).json({ error: 'Invalid dummy type' });
        }

        // Call Worker
        await axios.post(`${WORKER_URL}/ingest`, {
            org_id,
            type: `dummy_${type}`
        });

        res.json({ success: true, message: `Ingestion started for dummy_${type}` });
    } catch (error) {
        console.error('Ingestion trigger error:', error.message);
        res.status(500).json({ error: 'Failed to trigger ingestion' });
    }
});

// Trigger Web Ingestion
router.post('/web', async (req, res) => {
    try {
        const { url } = req.body;
        const org_id = req.user.org_id;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Call Worker
        await axios.post(`${WORKER_URL}/ingest`, {
            org_id,
            type: 'web',
            url
        });

        res.json({ success: true, message: 'Web ingestion started' });
    } catch (error) {
        console.error('Ingestion trigger error:', error.message);
        res.status(500).json({ error: 'Failed to trigger ingestion' });
    }
});

// Get Ingestion Logs
router.get('/logs', async (req, res) => {
    try {
        const org_id = req.user.org_id;
        // We need DB access here. 
        // Let's assume we can import pool from parent or create new.
        // Since we are in routes/ingest.js, we can't easily import from ../index.js if it's circular.
        // Best practice: separate db.js. But for now, let's create a pool instance if needed or pass it.
        // Or use req.app.get('pool') if we set it.

        const pool = req.app.get('pool');
        if (!pool) {
            throw new Error('DB Pool not found in app');
        }

        const result = await pool.query(
            'SELECT * FROM ingestion_logs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50',
            [org_id]
        );

        res.json({ success: true, logs: result.rows });
    } catch (error) {
        console.error('Fetch logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;
