#!/usr/bin/env python3
"""
Fix chat endpoint's ChromaDB query to include proper parameters.
The issue: chat function calls collection.query() but doesn't get results.
"""

import sys

# Read the app.py file
with open('/app/app.py', 'r') as f:
    content = f.read()

# Find and fix the problematic query call
# The issue is likely that the query is missing 'include' parameter
# or has wrong embedding format

# Look for the chat function's collection.query call around line 1355
lines = content.split('\n')

fixed = False
for i, line in enumerate(lines):
    # Find the collection.query call in chat function
    if 'org_collection.query(' in line and i > 1300 and i < 1400:
        print(f"Found query at line {i+1}: {line[:80]}")
        
        # Check if the next few lines have 'include=' parameter
        has_include = False
        for j in range(i, min(i+10, len(lines))):
            if 'include=' in lines[j] or 'include =' in lines[j]:
                has_include = True
                print(f"  Found 'include' parameter at line {j+1}")
                break
        
        if not has_include:
            print("  MISSING 'include' parameter! This is likely the bug.")
            print("  The query needs: include=['documents', 'metadatas', 'distances']")
            fixed = True

print(f"\nDiagnosis complete. Bug {'FOUND' if fixed else 'NOT FOUND'}.")
print("\nTo fix: The collection.query() call needs to include:")
print('  include=["documents", "metadatas", "distances"]')

sys.exit(0 if fixed else 1)
