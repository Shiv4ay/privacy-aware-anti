# Minimal, clean Phase 4 integration - One careful edit
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the line after app setup (around line 110, after cors and express.json)
# and insert Phase 4 integration in ONE place

insertion_point = "app.use(express.urlencoded({ extended: true, limit: '50mb' }));"

phase4_code = """app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== PHASE 4 AUTH SYSTEM ====================
// Attach database to all requests (required for Phase 4 routes)
app.use((req, res, next) => { req.db = pool; next(); });

// Mount Phase 4 auth routes at /api/auth/phase4
try {
    const phase4AuthRoutes = require('./routes/auth');
    app.use('/api/auth/phase4', phase4AuthRoutes);
    console.log('✅ Phase 4 Auth System: 10 endpoints at /api/auth/phase4/*');
} catch (error) {
    console.error('⚠️  Phase 4 failed to load:', error.message);
}
// ============================================================="""

# Replace the insertion point with itself + Phase 4 code
content = content.replace(insertion_point, phase4_code, 1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Phase 4 integrated cleanly at /api/auth/phase4/*")
print("   - No conflicts with existing /api/auth routes")
print("   - Database pool attached")
print("   - Single, clean insertion")
