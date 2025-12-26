import os
import re

def find_missing_useeffect(root_dir):
    print(f"Scanning {root_dir}...")
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in root:
            continue
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    # Check if usages exist
                    if 'useEffect' in content:
                        # Check if imported or fully qualified
                        has_import = re.search(r'import\s+.*useEffect', content)
                        has_react_dot = 'React.useEffect' in content
                        
                        if not has_import and not has_react_dot:
                            print(f"[MISSING IMPORT] {path}")
                            # Print context
                            lines = content.split('\n')
                            for i, line in enumerate(lines):
                                if 'useEffect' in line:
                                    print(f"  Line {i+1}: {line.strip()[:100]}")
                except Exception as e:
                    print(f"Error reading {path}: {e}")

find_missing_useeffect('c:\\project3\\AntiGravity\\PRIVACY-AWARE-RAG-GUIDE-CUR\\frontend\\src')
