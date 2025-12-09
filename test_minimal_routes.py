# Test with minimal auth routes
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace auth routes import with test version
content = content.replace(
    "const phase4AuthRoutes = require('./routes/auth');",
    "const phase4AuthRoutes = require('./routes/auth_test');"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Using minimal test auth routes")
