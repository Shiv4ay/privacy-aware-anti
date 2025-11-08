// backend/api/middleware/abacMiddleware.js
const jwt = require('jsonwebtoken');
const jsonLogic = require('json-logic-js');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper: load user by numeric id (works with your integer PK)
async function queryUserById(userId) {
  const uid = Number(userId);
  const q = `
    SELECT u.id, u.username, u.email, u.department, u.clearance_level, u.role_id, r.name as role_name
    FROM users u
    LEFT JOIN user_roles r ON u.role_id = r.id
    WHERE u.id = $1
    LIMIT 1;
  `;
  const res = await pool.query(q, [uid]);
  if (!res.rows.length) return null;
  const row = res.rows[0];
  const roles = row.role_name ? [row.role_name] : [];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    department: row.department,
    clearance_level: row.clearance_level,
    role_id: row.role_id,
    roles
  };
}

async function queryDocumentById(docId) {
  const did = Number(docId);
  const q = `SELECT id, file_key, filename, uploaded_by, metadata, sensitivity, department FROM documents WHERE id = $1 LIMIT 1`;
  const res = await pool.query(q, [did]);
  return res.rows[0] || null;
}

async function getEnabledPolicies() {
  // abac_policies.expression stored as jsonb in DB
  const res = await pool.query(`SELECT id, effect, expression::text AS expression_text, priority FROM abac_policies WHERE enabled = true ORDER BY priority ASC`);
  return res.rows.map(r => ({ id: r.id, effect: r.effect, expression: JSON.parse(r.expression_text), priority: r.priority }));
}

// Factory: returns middleware that enforces `requiredAction`
function abacMiddleware(requiredAction) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const token = authHeader ? String(authHeader).split(' ')[1] : null;
      if (!token) return res.status(401).json({ error: 'Missing token' });

      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (!payload || !payload.sub) return res.status(401).json({ error: 'Invalid token payload' });

      const user = await queryUserById(payload.sub);
      if (!user) return res.status(403).json({ error: 'User not found' });

      const resourceId = req.params.id || req.params.docId || req.body.document_id || req.body.file_id || null;
      const resource = resourceId ? await queryDocumentById(resourceId) : null;

      const attrs = {
        user: {
          id: user.id,
          username: user.username,
          roles: user.roles,
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

      const policies = await getEnabledPolicies();

      let allowed = false;
      for (const p of policies) {
        try {
          const matches = jsonLogic.apply(p.expression, attrs);
          if (matches) {
            if (p.effect === 'deny') {
              req.abac = { decision: 'denied', policy_id: p.id, attrs };
              return res.status(403).json({ error: 'Access denied by policy' });
            } else if (p.effect === 'allow') {
              allowed = true;
              req.abac = { decision: 'allowed', policy_id: p.id, attrs };
              break;
            }
          }
        } catch (e) {
          console.error('Policy eval error', p.id, e);
          // skip this policy if eval fails
        }
      }

      if (!allowed) {
        req.abac = { decision: 'denied', policy_id: null, attrs };
        return res.status(403).json({ error: 'Access denied' });
      }

      // attach user to req for downstream use
      req.user = user;
      next();
    } catch (err) {
      console.error('ABAC middleware error', err);
      return res.status(500).json({ error: 'Authorization failure' });
    }
  };
}

module.exports = { abacMiddleware };