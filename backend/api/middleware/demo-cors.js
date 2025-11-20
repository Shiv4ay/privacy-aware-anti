// backend/api/middleware/demo-cors.js
// DEMO: Global permissive CORS override for local development.
// This echoes the request Origin back (so http://localhost:3002 works).
// Replace with a stricter policy for production.

module.exports = function demoCors(req, res, next) {
  try {
    const origin = req.headers.origin || '*'

    // Allow the exact origin that requested — this is safe for local dev
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-dev-auth, Accept, X-Requested-With'
    )
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    )

    // Preflight: short-circuit with 204
    if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }
  } catch (e) {
    // fall through to next — never break the app startup
  }
  next()
}
