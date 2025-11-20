// backend/api/middleware/attachUserId.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function attachUserId(req, res, next) {
  try {
    const user = req.user;
    if (!user) return next();

    // If user already has numeric id, normalize and continue
    if (user.id && !isNaN(Number(user.id))) {
      req.user.id = Number(user.id);
      return next();
    }

    // Prefer sub if numeric
    if (user.sub && !isNaN(Number(user.sub))) {
      user.id = Number(user.sub);
      req.user = user;
      return next();
    }

    // Fallback: lookup by username in DB
    if (user.username) {
      const result = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [user.username]);
      if (result.rows.length > 0) {
        user.id = result.rows[0].id;
        req.user = user;
      }
    }

    return next();
  } catch (err) {
    console.error('attachUserId error:', err.message || err);
    return next();
  }
}

module.exports = { attachUserId };
