'use strict';
const cron = require('node-cron');
const { Pool } = require('pg');

const RETENTION_DAYS = parseInt(process.env.SEARCH_QUERY_RETENTION_DAYS || '90', 10);

function startRetentionJob(db) {
    // Run at 02:00 AM every day
    cron.schedule('0 2 * * *', async () => {
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
