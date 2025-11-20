const jwt = require('jsonwebtoken');
const jsonLogic = require('json-logic-js');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Simple in-memory cache for enabled policies to avoid DB roundtrips on every request.
// TTL in ms (default 5s to stay fresh during development). Increase in prod if you want.
const POLICY_CACHE_TTL = Number(process.env.ABAC_POLICY_CACHE_MS || 5000);
let policyCache = { ts: 0, policies: [] };

async function queryUserById(userId) {
  const uid = Number(userId);
  if (Number.isNaN(uid)) return null;

  // Try the full query first (application schema expected)
  const fullQuery = `
    SELECT u.id, u.username, u.email, u.department, u.organization, u.user_category, u.role_id, r.name as role_name
    FROM users u
    LEFT JOIN user_roles r ON u.role_id = r.id
    WHERE u.id = $1
    LIMIT 1;
  `;

  try {
    const res = await pool.query(fullQuery, [uid]);
    if (!res.rows.length) return null;
    const row = res.rows[0];
    const roles = row.role_name ? [row.role_name] : [];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      department: row.department,
      organization: row.organization,
      user_category: row.user_category,
      role_id: row.role_id,
      roles
    };
  } catch (err) {
    // If schema differs (missing column/table), fallback to a minimal safe query.
    console.warn('queryUserById: full query failed, retrying minimal select. Error:', err && err.message ? err.message : err);
    try {
      const safeQ = `SELECT id, username, email, role_id FROM users WHERE id = $1 LIMIT 1`;
      const r2 = await pool.query(safeQ, [uid]);
      if (!r2.rows.length) return null;
      const row = r2.rows[0];
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        department: null,
        organization: null,
        user_category: null,
        role_id: row.role_id,
        roles: []
      };
    } catch (e2) {
      console.error('queryUserById: minimal query failed too:', e2 && e2.message ? e2.message : e2);
      return null;
    }
  }
}

async function queryDocumentById(docId) {
  const did = Number(docId);
  if (Number.isNaN(did)) return null;
  const q = `SELECT id, file_key, filename, uploaded_by, metadata, sensitivity, department FROM documents WHERE id = $1 LIMIT 1`;
  try {
    const res = await pool.query(q, [did]);
    return res.rows[0] || null;
  } catch (err) {
    console.warn('queryDocumentById: DB query failed (returning null). Error:', err && err.message ? err.message : err);
    return null;
  }
}

/**
 * getEnabledPolicies(organization)
 * - Protected against missing table/column errors: returns [] on DB errors and logs.
 * - Caches results briefly for performance (per org).
 */
async function getEnabledPolicies(organization = 'default') {
  const now = Date.now();
  const cacheKey = organization || 'default';

  if (!policyCache[cacheKey]) {
    policyCache[cacheKey] = { ts: 0, policies: [] };
  }

  if (policyCache[cacheKey].policies.length && (now - policyCache[cacheKey].ts) < POLICY_CACHE_TTL) {
    return policyCache[cacheKey].policies;
  }

  try {
    // Fetch global policies (org='default' or org=NULL) AND org-specific policies
    const res = await pool.query(
      `SELECT id, effect, expression, priority 
         FROM abac_policies 
         WHERE enabled = true AND (organization = $1 OR organization = 'default') 
         ORDER BY priority ASC`,
      [organization]
    );

    const policies = res.rows.map(r => {
      let expr = r.expression;
      if (typeof expr === 'string') {
        try { expr = JSON.parse(expr); } catch (e) { /* leave as-is */ }
      }
      const effect = (r.effect && (String(r.effect).toLowerCase() === 'deny')) ? 'deny' : 'allow';
      return { id: r.id, effect: effect, expression: expr, priority: r.priority };
    });

    policyCache[cacheKey] = { ts: now, policies };
    return policies;
  } catch (err) {
    console.warn('ABAC: failed to load policies from DB (treating as no policies). Error:', err && err.message ? err.message : err);
    policyCache[cacheKey] = { ts: now, policies: [] };
    return [];
  }
}

function resolveResourceId(req) {
  let body = req.body;
  if (body && typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { /* ignore parse error */ }
  }

  return req.params?.id || req.params?.docId || (body && (body.document_id || body.file_id)) || req.query?.document_id || req.query?.file_id || null;
}

function normalizeRoles(r) {
  if (!r) return [];
  if (Array.isArray(r)) return r;
  if (typeof r === 'string') {
    try {
      const parsed = JSON.parse(r);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* ignore */ }
    return [r];
  }
  return [];
}

function safeJsonLogicApply(expression, data) {
  try {
    return jsonLogic.apply(expression, data);
  } catch (e) {
    console.error('json-logic apply error:', e);
    return false;
  }
}

// Factory: returns middleware that enforces `requiredAction`
function abacMiddleware(requiredAction) {
  return async (req, res, next) => {
    try {
      // Accept token from Authorization (Bearer), or common alternative headers
      const authHeader = req.headers.authorization || req.headers.Authorization || req.get && req.get('Authorization') || null;
      let token = authHeader ? String(authHeader).split(' ')[1] : null;
      if (!token) {
        // fallback header names some clients use
        token = req.get && (req.get('x-access-token') || req.get('x-auth-token') || req.get('x-token')) || null;
      }
      if (!token) {
        console.warn('ABAC: missing Authorization header/token');
        return res.status(401).json({ error: 'Missing token' });
      }

      let payload;
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          console.error('ABAC: JWT_SECRET not configured!');
          return res.status(500).json({ error: 'Authorization failure' });
        }
        // require HS256 to avoid algorithm confusion
        payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      } catch (e) {
        console.error('Token verification failed:', e && e.message ? e.message : e);
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Accept numeric sub OR numeric id from payload
      const numericSub = Number(payload.sub ?? payload.id);
      if (!payload || Number.isNaN(numericSub)) {
        console.error('Invalid token payload (missing or non-numeric sub/id). Payload:', payload);
        return res.status(401).json({ error: 'Invalid token payload (missing numeric sub/id)' });
      }

      const user = await queryUserById(numericSub);
      if (!user) {
        console.warn(`User not found for sub=${numericSub}`);
        return res.status(403).json({ error: 'User not found' });
      }

      const resourceId = resolveResourceId(req);
      const resource = resourceId ? await queryDocumentById(resourceId) : null;

      const attrs = {
        user: {
          id: user.id,
          username: user.username,
          roles: normalizeRoles(user.roles),
          department: user.department,
          clearance_level: user.clearance_level
        },
        resource: resource ? {
          id: resource.id,
          owner_id: resource.uploaded_by,
          department: resource.department,
          sensitivity: resource.sensitivity
        } : {},
        action: requiredAction,
        context: {
          ip: req.ip,
          time: new Date().toISOString(),
          user_agent: req.get('User-Agent') || ''
        }
      };

      const policies = await getEnabledPolicies(user.organization);

      let allowed = false;
      for (const p of policies) {
        if (!p.expression) continue;
        let matches = false;
        try {
          matches = safeJsonLogicApply(p.expression, attrs);
        } catch (e) {
          console.error('Policy evaluation error for', p.id, e);
          matches = false;
        }

        if (matches) {
          if (p.effect === 'deny') {
            req.abac = { decision: 'denied', policy_id: p.id, attrs };
            return res.status(403).json({ error: 'Access denied by policy' });
          }
          if (p.effect === 'allow') {
            allowed = true;
            req.abac = { decision: 'allowed', policy_id: p.id, attrs };
            break;
          }
        }
      }

      if (!allowed) {
        if (process.env.NODE_ENV === 'development') {
          // log attribute bag so you can see why policy evaluation failed
          try {
            console.warn('ABAC: decision=denied attrs=', JSON.stringify(attrs));
          } catch (e) { console.warn('ABAC: decision=denied (could not stringify attrs)'); }
        }
        req.abac = { decision: 'denied', policy_id: null, attrs };
        return res.status(403).json({ error: 'Access denied' });
      }

      req.user = user;
      req.tokenPayload = payload;
      return next();
    } catch (err) {
      console.error('ABAC middleware error', err && err.message ? err.message : err);
      return res.status(500).json({ error: 'Authorization failure' });
    }
  };
}

module.exports = { abacMiddleware };
