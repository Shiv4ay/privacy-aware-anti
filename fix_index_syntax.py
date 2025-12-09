# Fix the syntax error in index.js
with open(r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the problematic line
content = content.replace(
    """console.log('⚠️  Phase 4 full auth routes disabled (schema compatibility)\\");""",
    """console.log('⚠️  Phase 4 full auth routes disabled (schema compatibility)');"""
)

with open(r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed syntax error in index.js")
