import os

file_path = r"c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\worker\app.py"

if not os.path.exists(file_path):
    print(f"Error: File not found at {file_path}")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

target_idx = -1

for i, line in enumerate(lines):
    if '@app.post("/chat")' in line:
        target_idx = i
        break

if target_idx != -1:
    print(f"Found Chat endpoint at line {target_idx+1}")
    
    # Check if function already exists (to avoid duplicate)
    exists = False
    for line in lines:
        if "def generate_chat_response" in line:
            exists = True
            break
            
    if exists:
        print("Function generate_chat_response already exists. Skipping insertion.")
    else:
        new_code = [
            "",
            "def generate_chat_response(query: str, context: str) -> str:",
            '    """Generate answer using Ollama with RAG context."""',
            "    if context:",
            '        prompt = f"Context:\\n{context}\\n\\nQuestion: {query}\\n\\nAnswer:"',
            "    else:",
            "        prompt = query",
            "",
            "    try:",
            "        # Use simple generation (not chat) for this basic RAG",
            "        payload = {",
            '            "model": OLLAMA_MODEL,',
            '            "prompt": prompt,',
            '            "stream": False',
            "        }",
            '        res = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=60)',
            "        res.raise_for_status()",
            '        return res.json().get("response", "")',
            "    except Exception as e:",
            '        logger.error(f"Ollama generation failed: {e}")',
            '        return "I\'m sorry, I encountered an error generating a response."',
            ""
        ]
        
        # Insert before the chat endpoint
        final_lines = lines[:target_idx] + new_code + lines[target_idx:]
        
        # Write back
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(final_lines) + "\n")
        print("✅ Successfully inserted generate_chat_response logic.")
    
else:
    print(f"❌ Could not find Chat endpoint target.")
