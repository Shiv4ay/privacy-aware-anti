# Fix index.js - Remove duplicates and conflicts
import re

file_path = r'C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

cleaned_lines = []
skip_until_line = -1
phase4_mounted = False

for i, line in enumerate(lines, 1):
    # Skip old basic auth endpoints (lines 271-500 approximately)
    if i >= 271 and i <= 500:
        if 'app.post(\'/api/auth/' in line or 'app.get(\'/api/auth/' in line:
            # Comment out old basic auth endpoints
            cleaned_lines.append('// [DISABLED - Replaced by Phase 4] ' + line)
            skip_until_line = i + 100  # Skip the entire function
            continue
    
    # Skip lines inside old auth endpoint functions
    if i < skip_until_line and i > 271:
        if line.strip().startswith('});') or line.strip() == '}':
            skip_until_line = -1
            cleaned_lines.append('// [END DISABLED ENDPOINT]\n')
        else:
            cleaned_lines.append('// ' + line)
        continue
    
    # Remove duplicate Phase 4 mount (keep only first one)
    if "app.use('/api/auth', phase4AuthRoutes)" in line:
        if not phase4_mounted:
            cleaned_lines.append(line)
            phase4_mounted = True
            print(f"✅ Kept Phase 4 mount at line {i}")
        else:
            cleaned_lines.append(f'// [REMOVED DUPLICATE] {line}')
            print(f"⚠️  Removed duplicate Phase 4 mount at line {i}")
        continue
    
    # Keep all other lines
    cleaned_lines.append(line)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(cleaned_lines)

print("\n✅ Fixed index.js:")
print("   - Removed duplicate Phase 4 route mounts")
print("   - Commented out old basic auth endpoints")
print("   - Phase 4 routes are now the only /api/auth handlers")
