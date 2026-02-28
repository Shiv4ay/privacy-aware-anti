const express = require('express');
const axios = require('axios');
const router = express.Router();

const { authenticateJWT } = require('../middleware/authMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

/**
 * Helper: Write audit log to audit_logs + broadcast via Redis for real-time UI
 *
 * CRITICAL: req.user.id  = integer PK  (matches audit_logs.user_id INTEGER)
 *           req.user.userId = UUID string  (DO NOT use for audit_logs)
 */
async function logAndBroadcast(req, { action, success, details }) {
  try {
    const db = req.db;
    if (!db) {
      console.warn('[Audit] req.db missing — skipping audit log');
      return;
    }

    // Use req.user.id (integer PK) — NOT req.user.userId (UUID)
    const userIdInt = req.user?.id || null;
    const username = req.user?.username || 'System';
    const email = req.user?.email || null;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const ua = req.get('User-Agent') || null;

    console.log(`[Audit] Logging ${action} for user ${username} (id=${userIdInt})`);

    // Write to audit_logs (the table SecurityDashboard reads from)
    const result = await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address, user_agent, created_at)
             VALUES ($1, $2, 'query', $3, $4, $5, NOW())
             RETURNING id, created_at`,
      [userIdInt, action, JSON.stringify(details), ip, ua]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`[Audit] ✅ Inserted audit_logs id=${row.id} at ${row.created_at}`);

      const event = {
        id: row.id,
        user_id: userIdInt,
        action,
        resource_type: 'query',
        success,
        metadata: details,
        created_at: row.created_at,
        username,
        email
      };

      // Publish to Redis → RealtimeService → Socket.IO
      if (req.redis && typeof req.redis.publish === 'function') {
        await req.redis.publish('system_activity', JSON.stringify(event));
      }

      // Direct Socket.IO emit (failsafe)
      const rt = req.app?.get('realtime');
      if (rt?.io) {
        rt.io.to('system_admins').emit('activity', event);
      }
    }
  } catch (err) {
    console.error('[Audit] ❌ FAILED:', err.message);
  }
}

/**
 * POST /chat (mounted at /api/chat)
 */
router.post('/chat', authenticateJWT, aiLimiter, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const org_id = req.user?.org_id || 1;

    const response = await axios.post(`${WORKER_URL}/chat`, {
      query: query.trim(),
      org_id,
      user_role: req.user?.role || 'student',
      department: req.user?.department || null,
      user_category: req.user?.user_category || null,
    }, { timeout: 300000 });

    // Audit log BEFORE sending response (await ensures it runs)
    await logAndBroadcast(req, {
      action: 'chat',
      success: true,
      details: {
        success: 'true',
        query_redacted: query.trim().substring(0, 200),
        pii_detected: response.data?.pii_detected ? 'true' : 'false',
        pii_types: response.data?.pii_types || [],
        org_id
      }
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Chat error:', error.message);

    await logAndBroadcast(req, {
      action: 'chat',
      success: false,
      details: {
        success: 'false',
        query_redacted: (req.body?.query || '').substring(0, 200),
        error: error.message
      }
    });

    return res.json({
      query: req.body?.query,
      response: "I'm initializing the AI model. This can take a moment on first use. Please try again in 30 seconds!",
      context_used: false,
      status: 'success'
    });
  }
});

/**
 * POST /search (mounted at /api/search)
 */
router.post('/search', authenticateJWT, aiLimiter, async (req, res) => {
  try {
    const { query, top_k } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const org_id = req.user?.org_id || 1;
    console.log(`[API Search] User: ${req.user?.username} (id=${req.user?.id}), OrgID: ${org_id}, Role: ${req.user?.role}`);

    const response = await axios.post(`${WORKER_URL}/search`, {
      query: query.trim(),
      top_k: top_k || 5,
      org_id: org_id || null,
      department: req.user?.department || null,
      user_category: req.user?.user_category || null
    }, { timeout: 300000 });

    // Audit log BEFORE sending response
    await logAndBroadcast(req, {
      action: 'search',
      success: true,
      details: {
        success: 'true',
        query_redacted: query.trim().substring(0, 200),
        pii_detected: response.data?.pii_detected ? 'true' : 'false',
        pii_types: response.data?.pii_types || [],
        results_count: response.data?.results?.length || 0,
        org_id
      }
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Search error:', error.message);

    await logAndBroadcast(req, {
      action: 'search',
      success: false,
      details: {
        success: 'false',
        query_redacted: (req.body?.query || '').substring(0, 200),
        error: error.message
      }
    });

    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || error.message || 'Search failed',
      status: 'error'
    });
  }
});

module.exports = router;
