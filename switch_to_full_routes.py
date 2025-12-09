# Switch back to full Phase 4 routes (not test version)
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Switch from test routes back to full routes
content = content.replace(
    "const phase4AuthRoutes = require('./routes/auth_test');",
    "const phase4AuthRoutes = require('./routes/auth');"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Switched back to full Phase 4 auth routes")
