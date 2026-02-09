#!/usr/bin/env python3
"""
Fix chat endpoint's ChromaDB query - add missing 'include' parameter.
This will make chat retrieve actual document chunks instead of empty metadata.
"""

import re

# Read the app.py file
with open('/app/app.py', 'r') as f:
    content = f.read()

# Backup original
with open('/app/app.py.backup', 'w') as f:
    f.write(content)

print("Created backup: /app/app.py.backup")

# Fix the query call - add include parameter
# Pattern: results = org_collection.query(
#            query_embeddings=query_embedding,
#            n_results=fetch_k,
# Should become:
#            query_embeddings=query_embedding,
#            n_results=fetch_k,
#            include=["documents", "metadatas", "distances"],

# Find the specific pattern around line 1355
pattern = r'(results = org_collection\.query\(\s+query_embeddings=query_embedding,\s+n_results=fetch_k,)'

replacement = r'\1\n                include=["documents", "metadatas", "distances"],'

content_fixed = re.sub(pattern, replacement, content, count=1)

if content_fixed == content:
    print("ERROR: Pattern not found! Trying alternative fix...")
    # Alternative: just add it after n_results line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'n_results=fetch_k,' in line and i > 1350 and i < 1365:
            print(f"Found n_results at line {i+1}")
            # Add include parameter on next line
            indent = ' ' * (len(line) - len(line.lstrip()))
            lines.insert(i+1, f'{indent}include=["documents", "metadatas", "distances"],')
            content_fixed = '\n'.join(lines)
            print("Added include parameter!")
            break

# Write fixed version
with open('/app/app.py', 'w') as f:
    f.write(content_fixed)

print("\n✅ Fixed /app/app.py")
print("Added: include=['documents', 'metadatas', 'distances']")
print("\nRestart worker container to apply changes:")
print("  docker restart privacy-aware-worker")
