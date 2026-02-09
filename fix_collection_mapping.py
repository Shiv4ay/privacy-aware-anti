#!/usr/bin/env python3
"""
Fix the get_org_collection function to return privacy_documents_1 for org_id=1
instead of privacy_documents_global.

ROOT CAUSE: The function maps org_id=1 to the wrong collection name.
FIX: Update the collection name selection logic to use privacy_documents_{org_id}
"""

import re

# Read app.py
with open('/app/app.py', 'r') as f:
    content = f.read()

# Backup
with open('/app/app.py.backup2', 'w') as f:
    f.write(content)

print("Created backup: /app/app.py.backup2")

# The issue is likely in get_org_collection function around line 312-345
# We need to ensure org_id=1 returns collection "privacy_documents_1"
# and NOT "privacy_documents_global"

# Find and replace the collection name logic
# Pattern: Look for where it sets collection_name based on org_id

# Strategy: Find "privacy_documents_global" and see if it should use org_id
lines = content.split('\n')

fixed = False
for i,  line in enumerate(lines):
    # Look for the get_org_collection function
    if 'def get_org_collection' in line:
        print(f"Found get_org_collection at line {i+1}")
        
        # Look ahead for collection name assignment
        for j in range(i, min(i+50, len(lines))):
            if 'privacy_documents_global' in lines[j] and 'collection_name' in lines[j]:
                print(f"  Found collection assignment at line {j+1}:")
                print(f"    BEFORE: {lines[j]}")
                
                # Replace with logic that uses org_id
                # If line is like: collection_name = "privacy_documents_global"
                # Change to: collection_name = f"privacy_documents_{org_id}" if org_id else "privacy_documents_global"
                
                indent = len(lines[j]) - len(lines[j].lstrip())
                lines[j] = ' ' * indent + f'collection_name = f"privacy_documents_{{org_id}}" if org_id else "privacy_documents_global"'
                print(f"    AFTER:  {lines[j]}")
                fixed = True
                break
        break

if not fixed:
    print("\n❌ Could not find the exact pattern. Trying alternative fix...")
    # Alternative: Just search and replace the literal string
    content = content.replace(
        'collection_name = "privacy_documents_global"',
        'collection_name = f"privacy_documents_{org_id}" if org_id else "privacy_documents_global"'
    )
    if 'f"privacy_documents_{org_id}"' in content:
        print("✅ Applied alternative fix!")
        fixed = True

# Write fixed version
if fixed:
    if isinstance(content, list):
        content = '\n'.join(lines)
    with open('/app/app.py', 'w') as f:
        f.write(content)
    
    print("\n✅ FIXED /app/app.py")
    print("Changed: privacy_documents_global")
    print("To:      privacy_documents_{org_id} (for org_id=1 → privacy_documents_1)")
    print("\n🔄 Restart worker to apply:")
    print("   docker restart privacy-aware-worker")
else:
    print("\n❌ Could not apply fix - manual intervention needed")

sys.exit(0 if fixed else 1)
