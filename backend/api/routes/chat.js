const express = require('express');
const axios = require('axios');
const router = express.Router();

const { authenticateJWT } = require('../middleware/authMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

/**
 * Helper: Write audit log to audit_logs + broadcast via Redis for real-time UI
 *
 * CRITICAL: req.user.userId = UUID string (matches audit_logs.user_id UUID)
 *           req.user.id     = integer PK (DO NOT use for audit_logs as it is now UUID)
 */
async function logAndBroadcast(req, { action, success, details }) {
  try {
    const db = req.db;
    if (!db) {
      console.warn('[Audit] req.db missing — skipping audit log');
      return;
    }

    // Use req.user.userId (UUID) — NOT req.user.id (integer PK)
    const userId = req.user?.userId || req.user?.user_id || null;
    const username = req.user?.username || 'System';
    const email = req.user?.email || null;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const ua = req.get('User-Agent') || null;

    console.log(`[Audit] Logging ${action} for user ${username} (uuid=${userId})`);

    // Write to audit_logs (the table SecurityDashboard reads from)
    const result = await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address, user_agent, created_at)
             VALUES ($1, $2, 'query', $3, $4, $5, NOW())
             RETURNING id, created_at`,
      [userId, action, JSON.stringify(details), ip, ua]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`[Audit] ✅ Inserted audit_logs id=${row.id} at ${row.created_at}`);

      const event = {
        id: row.id,
        user_id: userId,
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

// H4-fix: shared helpers to eliminate duplicate DB lookups across /chat and /chat/stream
async function fetchOrgPrivacyLevel(db, org_id) {
  try {
    const res = await db.query('SELECT privacy_level FROM organizations WHERE id = $1', [org_id]);
    return (res.rows.length > 0 && res.rows[0].privacy_level) ? res.rows[0].privacy_level : 'standard';
  } catch {
    return 'standard';
  }
}

async function fetchUserPrivacyMode(db, userId) {
  if (!userId) return 'normal';
  try {
    const res = await db.query('SELECT privacy_shield_enabled FROM users WHERE user_id = $1', [userId]);
    return (res.rows.length > 0 && res.rows[0].privacy_shield_enabled) ? 'hidden' : 'normal';
  } catch {
    return 'normal';
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

    // H4-fix: use shared helpers (no more duplicate inline DB lookups)
    const privacy_level = await fetchOrgPrivacyLevel(req.db, org_id);
    const privacy_mode  = await fetchUserPrivacyMode(req.db, req.user?.userId);

    const response = await axios.post(`${WORKER_URL}/chat`, {
      query: query.trim(),
      privacy_level,
      privacy_mode,
      org_id,
      user_id: req.user?.userId || req.user?.user_id || req.user?.id,
      user_role: req.user?.role || 'student',
      department: req.user?.department || null,
      user_category: req.user?.user_category || req.user?.userCategory || null,
      entity_id: req.user?.entityId || req.user?.entity_id || null, // Zero-Trust ID
      user_email: req.user?.email || null,  // Identity anchoring
      username: req.user?.username || null,  // Identity anchoring
      conversation_history: req.body.conversation_history || [],
    }, { timeout: 300000 });

    // Universal security block detection: catch ANY status containing 'blocked'
    // Covers: blocked, security_blocked, security_blocked_ai, security_blocked_output, privacy_blocked, and any future *_blocked variants
    const workerStatus = response.data?.status || '';
    const isSecurityBlock = workerStatus !== 'success' && workerStatus.includes('blocked');

    if (isSecurityBlock && workerStatus === 'privacy_blocked') {
      // Privacy violation — cross-student access attempt
      await logAndBroadcast(req, {
        action: 'privacy_violation',
        success: false,
        details: {
          success: 'false',
          threat_type: 'cross_student_access',
          security_layer: workerStatus,
          query_redacted: query.trim().substring(0, 200),
          error_message: response.data?.response?.substring(0, 300) || 'Privacy Violation: Cross-student data access attempt blocked',
          org_id
        }
      });
      return res.json(response.data);
    }

    if (isSecurityBlock) {
      // All other security blocks — jailbreak, prompt injection, output audit, AI judge
      const threatType = workerStatus === 'security_blocked_ai' ? 'ai_intent_block'
                       : workerStatus === 'security_blocked_output' ? 'output_leak_blocked'
                       : 'jailbreak';
      await logAndBroadcast(req, {
        action: 'jailbreak_attempt',
        success: false,
        details: {
          success: 'false',
          threat_type: threatType,
          security_layer: workerStatus,
          query_redacted: query.trim().substring(0, 200),
          error_message: response.data?.response || 'Security Violation: Malicious Prompt Injection Detected',
          org_id
        }
      });
      return res.json(response.data);
    }

    // T10.2 Fallback: Check if the LLM response itself indicates a privacy refusal
    // (catches edge cases where name-based detector misses but LLM follows system prompt)
    const responseText = (response.data?.response || '').toLowerCase();
    const isLLMPrivacyRefusal = responseText.includes('i can only show your own records') ||
                                 responseText.includes('cannot retrieve or display another student') ||
                                 responseText.includes('privacy protection active') ||
                                 responseText.includes('cannot access another student');
    if (isLLMPrivacyRefusal) {
      await logAndBroadcast(req, {
        action: 'privacy_violation',
        success: false,
        details: {
          success: 'false',
          threat_type: 'cross_student_access',
          query_redacted: query.trim().substring(0, 200),
          error_message: 'Privacy Violation: Cross-student query detected by LLM guardrail',
          org_id
        }
      });
      return res.json(response.data);
    }

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

    if (error.response?.status === 403) {
      await logAndBroadcast(req, {
        action: 'jailbreak_attempt',
        success: false,
        details: {
          success: 'false',
          threat_type: 'jailbreak',
          query_redacted: (req.body?.query || '').substring(0, 200),
          error_message: error.response?.data?.detail || 'Security Violation: Malicious Prompt Injection Detected'
        }
      });
      // Send 403 back to frontend so "Simulate Attack" toast catches it
      return res.status(403).json({ error: error.response?.data?.detail || 'Forbidden' });
    }

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
 * POST /chat/stream (mounted at /api/chat/stream)
 * Phase 6.5: SSE streaming proxy — pipes token-by-token from Python worker
 */
router.post('/chat/stream', authenticateJWT, aiLimiter, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const org_id = req.user?.org_id || 1;

    // H4-fix: use shared helpers (no more duplicate inline DB lookups)
    const privacy_level = await fetchOrgPrivacyLevel(req.db, org_id);
    const privacy_mode  = await fetchUserPrivacyMode(req.db, req.user?.userId);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Forward to Python worker stream endpoint
    const workerRes = await axios.post(`${WORKER_URL}/chat/stream`, {
      query: query.trim(),
      privacy_level,
      privacy_mode,
      org_id,
      user_id: req.user?.userId || req.user?.user_id || req.user?.id,
      user_role: req.user?.role || 'student',
      department: req.user?.department || null,
      user_category: req.user?.user_category || req.user?.userCategory || null,
      entity_id: req.user?.entityId || req.user?.entity_id || null, // Zero-Trust ID
      user_email: req.user?.email || null,  // Identity anchoring
      username: req.user?.username || null,  // Identity anchoring
      conversation_history: req.body.conversation_history || [],
    }, {
      responseType: 'stream',
      timeout: 300000,
    });

    // Pipe the SSE stream directly to the client
    workerRes.data.pipe(res);

    workerRes.data.on('end', () => {
      // Audit log (best-effort, non-blocking)
      logAndBroadcast(req, {
        action: 'chat',
        success: true,
        details: {
          success: 'true',
          query_redacted: query.trim().substring(0, 200),
          streaming: true,
          org_id,
        },
      }).catch(() => { });
      res.end();
    });

    workerRes.data.on('error', (err) => {
      console.error('[ChatStream] Stream error:', err.message);
      res.end();
    });

  } catch (error) {
    console.error('[ChatStream] Error:', error.message);
    if (!res.headersSent) {
      return res.status(error.response?.status || 500).json({
        error: error.response?.data?.detail || error.message || 'Streaming failed',
      });
    }
    res.end();
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
      user_id: req.user?.userId || req.user?.user_id || req.user?.id,
      user_role: req.user?.role || 'student',
      department: req.user?.department || null,
      user_category: req.user?.user_category || req.user?.userCategory || null,
      entity_id: req.user?.entityId || req.user?.entity_id || null // Zero-Trust ID
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

    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail || '';
      const isPrivacyBlock = detail.toLowerCase().includes('privacy');
      await logAndBroadcast(req, {
        action: isPrivacyBlock ? 'privacy_violation' : 'jailbreak_attempt',
        success: false,
        details: {
          success: 'false',
          threat_type: isPrivacyBlock ? 'cross_student_access' : 'jailbreak',
          query_redacted: (req.body?.query || '').substring(0, 200),
          error_message: detail || 'Security Violation: Malicious Prompt Injection Detected'
        }
      });
      return res.status(403).json({ error: detail || 'Forbidden' });
    }

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
