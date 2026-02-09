#!/usr/bin/env python3
import sys

with open('/app/app.py', 'r') as f:
    lines = f.readlines()
    
# Extract get_org_collection function (lines 312-345)
print("=== get_org_collection function ===")
for i in range(311, min(345, len(lines))):
    print(f"{i+1:4d}: {lines[i]}", end='')

print("\n\n=== Chat function collection selection (lines 1510-1545) ===")
for i in range(1509, min(1545, len(lines))):
    print(f"{i+1:4d}: {lines[i]}", end='')
