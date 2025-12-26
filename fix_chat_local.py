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
    if '# @app.post("/chat")' in line:
        start_idx = i
    if '# Ingestion Logic' in line and i > start_idx and start_idx != -1:
        end_idx = i
        break 

if start_idx != -1 and end_idx != -1:
    # Adjust end_idx to include the blank lines before Ingestion Logic
    end_idx = end_idx - 1 
    print(f"Found Chat block from line {start_idx+1} to {end_idx+1}")
    
    # Process the block
    new_block = []
    # Lines before the block
    final_lines = lines[:start_idx]
    
    for i in range(start_idx, end_idx):
        line = lines[i]
         # Stop if we hit the divider unexpectedly
        if "# -----------------------------" in line and i > start_idx + 5:
             # Just keep this line as is (commented usually if part of structure, but here it is a divider)
             # actually the divider is usually active.
             pass

        # Uncomment logic
        if line.startswith("# "):
            new_line = line[2:]
        elif line.startswith("#"):
            new_line = line[1:]
        else:
            new_line = line 
        
        new_block.append(new_line)
        
    final_lines.extend(new_block)
    final_lines.extend(lines[end_idx:])
    
    # Write back
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(final_lines) + "\n")
    print("✅ Successfully uncommented Chat logic.")
    
else:
    print(f"❌ Could not find block boundaries. Start: {start_idx}, End: {end_idx}")
