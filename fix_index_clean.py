# Debug and fix index.js Phase 4 integration
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the Phase 4 section and replace it with a clean, working version
phase4_section = """// ========================================
// PHASE 4: AUTH SYSTEM INTEGRATION
// ========================================
console.log('🔐 Initializing Phase 4 Auth System...');

// 1. Import Phase 4 security middleware
try {
    const { configureSecurityHeaders } = require('./middleware/securityHeaders');
    const { apiLimiter } = require('./middleware/rateLimiter');
    const { sanitizeBody } = require('./middleware/validator');
    
    // Apply security headers
    configureSecurityHeaders(app);
    console.log('✅ Security headers configured (CSP, HSTS, XSS protection)');
    
    // Apply input sanitization
    app.use(sanitizeBody);
    console.log('✅ Input validation and sanitization enabled');
    
    // Attach database pool to all requests
    app.use((req, res, next) => {
        req.db = pool;
        next();
    });
    console.log('✅ Database connection attached to requests');
    
    // Import and mount Phase 4 auth routes
    const phase4AuthRoutes = require('./routes/auth');
    app.use('/api/auth', phase4AuthRoutes);
    console.log('✅ Phase 4 Auth routes mounted at /api/auth (10 endpoints)');
    
    // Apply rate limiting to all API routes
    app.use('/api', apiLimiter);
    console.log('✅ Rate limiting enabled (100 req/min per user)');
    
    console.log('🎉 Phase 4 Auth System initialized successfully!');
} catch (error) {
    console.error('⚠️  Phase 4 Auth System initialization failed:', error.message);
    console.error('   Continuing with basic auth endpoints only');
}
// ========================================"""

# Replace the entire Phase 4 section
pattern = r'// ========================================\s*\n// PHASE 4:.*?// ========================================'
content = re.sub(pattern, phase4_section, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed index.js with clean Phase 4 integration")
