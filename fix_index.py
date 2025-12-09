# Fix index.js - Enable Phase 4 auth routes
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the commented-out Phase 4 auth routes section
old_pattern = r"// Import and mount Phase 4 auth routes.*?console\.log\('⚠️.*?schema compatibility.*?\);"
new_code = """// Import and mount Phase 4 auth routes (✅ Schema migration complete!)
    const phase4AuthRoutes = require('./routes/auth');
    app.use('/api/auth', phase4AuthRoutes);
    console.log('✅ Phase 4 Auth routes mounted at /api/auth (10 endpoints)');
    
    // Attach database pool to all requests
    app.use((req, res, next) => {
        req.db = pool;
        next();
    });
    console.log('✅ Database connection attached to requests');
    
    // Apply rate limiting to all API routes
    app.use('/api', apiLimiter);
    console.log('✅ Rate limiting enabled (100 req/min per user)');"""

content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed index.js - Phase 4 auth routes enabled")
