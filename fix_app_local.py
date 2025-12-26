import os

file_path = r"c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\worker\app.py"

if not os.path.exists(file_path):
    print(f"Error: File not found at {file_path}")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '# @app.post("/search")' in line:
        start_idx = i
    if '# @app.post("/chat")' in line:
        end_idx = i
        break # Found the boundary

if start_idx != -1 and end_idx != -1:
    print(f"Found Search block from line {start_idx+1} to {end_idx+1}")
    
    # Process the block
    new_block = []
    # Lines before the block
    final_lines = lines[:start_idx]
    
    for i in range(start_idx, end_idx):
        line = lines[i]
        
        # Uncomment logic
        if line.startswith("# "):
            new_line = line[2:]
        elif line.startswith("#"):
            new_line = line[1:]
        else:
            new_line = line 
        
        # Apply Score Fix
        # Look for the specific line we tried to patch earlier or the original
        if "score = 1.0 - distance" in new_line:
            # Preserve 16 space indentation
            new_line = "                # Fixed score for L2 distance\n                score = 1.0 / (1.0 + distance)"
            
        new_block.append(new_line)
        
    final_lines.extend(new_block)
    final_lines.extend(lines[end_idx:])
    
    # Write back
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(final_lines) + "\n")
    print("✅ Successfully uncommented search logic and fixed score calculation.")
    
else:
    print(f"❌ Could not find block boundaries. Start: {start_idx}, End: {end_idx}")
