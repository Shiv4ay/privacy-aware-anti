'use strict';
const cron = require('node-cron');

const RETENTION_DAYS = parseInt(process.env.SEARCH_QUERY_RETENTION_DAYS || '90', 10);
if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
    throw new Error(`[Retention] Invalid SEARCH_QUERY_RETENTION_DAYS: "${process.env.SEARCH_QUERY_RETENTION_DAYS}". Must be a positive integer.`);
}

let _task = null;

function startRetentionJob(db) {
    if (_task) {
        console.warn('[Retention] Job already registered; skipping duplicate registration.');
        return;
    }

    // Run at 02:00 AM every day
    _task = cron.schedule('0 2 * * *', async () => {
        if (!db) {
            console.error('[Retention] db pool is not available; skipping run.');
            return;
        }
        try {
            const result = await db.query(
                `DELETE FROM search_queries WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days' RETURNING id`
            );
            console.log(`[Retention] Deleted ${result.rowCount} search_queries older than ${RETENTION_DAYS} days`);
        } catch (err) {
            console.error('[Retention] Cleanup job failed:', err.message);
        }
    }, { timezone: 'Asia/Kolkata' });

    console.log(`[Retention] Cron job scheduled: delete search_queries older than ${RETENTION_DAYS} days at 02:00 IST`);
}

module.exports = { startRetentionJob };
