# Temporarily disable security headers to isolate the issue
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Simplify Phase 4 section - comment out security headers
simple_phase4 = """// ========================================
// PHASE 4: AUTH SYSTEM INTEGRATION (Minimal for debugging)
// ========================================
console.log('🔐 Initializing Phase 4 Auth System...');

try {
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
    
    console.log('🎉 Phase 4 Auth System initialized!');
} catch (error) {
    console.error('⚠️  Phase 4 init failed:', error.message);
    console.error(error.stack);
}
// ========================================"""

pattern = r'// ========================================\s*\n// PHASE 4:.*?// ========================================'
content = re.sub(pattern, simple_phase4, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Simplified Phase 4 integration (no security headers for now)")
