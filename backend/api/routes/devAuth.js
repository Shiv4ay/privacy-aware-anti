// backend/api/routes/devAuth.js
// Dev-only token generation endpoint. ONLY enabled in development.
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Load from environment (fall back to obvious defaults for local dev only)
const DEV_AUTH_KEY = process.env.DEV_AUTH_KEY || 'dev-only-secret-change-me';
const TOKEN_EXPIRES_IN = process.env.DEV_TOKEN_EXPIRES_IN || '30d';
const JWT_SECRET = process.env.JWT_SECRET || 'jwtsecret123';

function extractProvidedKey(req) {
  // Prefer headers first (less prone to PowerShell quoting issues)
  const headerCandidates = [
    'x-dev-key',
    'x-dev-auth-key',
    'dev-key',
    'dev_auth_key',
    'dev-key'.toLowerCase(),
    'x-dev-auth-key'.toLowerCase(),
    'x-dev-key'.toLowerCase()
  ];

  for (const h of headerCandidates) {
    const val = req.get(h);
    if (val) return String(val);
  }

  // Then try common body properties
  if (req.body) {
    if (typeof req.body === 'object') {
      if (req.body.key) return String(req.body.key);
      if (req.body.dev_key) return String(req.body.dev_key);
      if (req.body.devKey) return String(req.body.devKey);
      if (req.body.dev) return String(req.body.dev);
    } else if (typeof req.body === 'string') {
      // in case body-parser couldn't parse JSON (shouldn't happen with express.json), return raw string
      return req.body;
    }
  }

  return '';
}

router.post('/dev/token', (req, res) => {
  console.log('[DEBUG] Inside devAuth handler');
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Dev token endpoint disabled in non-development environment' });
  }

  console.log('[DEBUG] Extracting key...');
  const providedKey = extractProvidedKey(req);
  console.log('[DEBUG] Key extracted:', providedKey ? 'FOUND' : 'NOT_FOUND');

  if (!providedKey || providedKey !== DEV_AUTH_KEY) {
    return res.status(401).json({ error: 'Missing or invalid dev auth key' });
  }

  console.log('[DEBUG] Parsing user data...');
  const requestedUser = (req.body && req.body.user) || {};
  const sub = requestedUser.id ? Number(requestedUser.id) : 1;
  const username = requestedUser.username || 'siba';

  console.log('[DEBUG] User data ready. Signing token...');
  const roles = Array.isArray(requestedUser.roles) ? requestedUser.roles : (requestedUser.role ? [requestedUser.role] : ['admin']);
  const role = roles[0] || 'admin';

  // Minimal payload compatible with your auth and ABAC middleware
  const payload = {
    sub,
    id: sub,
    userId: sub, // ✅ Fix: Match authMiddleware expectation
    username,
    roles,
    role,
    role,
    org_id: requestedUser.org_id || 1, // Default to Org 1 for dev
    organizationId: requestedUser.org_id || 1,
    type: 'access'
  };

  if (!JWT_SECRET) {
    console.error('devAuth: JWT_SECRET not configured in environment');
    return res.status(500).json({ error: 'Server misconfigured (missing JWT secret)' });
  }

  try {
    // Build sign options: include expiresIn only when a real expiry is requested.
    const signOptions = { algorithm: 'HS256' };
    if (TOKEN_EXPIRES_IN && String(TOKEN_EXPIRES_IN).toLowerCase() !== 'never') {
      signOptions.expiresIn = TOKEN_EXPIRES_IN;
    }

    const token = jwt.sign(payload, JWT_SECRET, signOptions);
    // Echo back what was used for clarity (expiresIn omitted when non-expiring)
    return res.json({ token, payload, expiresIn: signOptions.expiresIn || null });
  } catch (e) {
    console.error('devAuth error signing token', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Failed to sign token' });
  }
});

module.exports = router;
