import requests
import json

system_prompt = "You are a helpful assistant. ONLY answer what is asked based on the Context."
context = "full_name: John Fritz | email: john.fritz@university.edu | company: Microsoft"
history = [
    {"role": "user", "content": "STU20240507 give me his name and company details"},
    {"role": "assistant", "content": "- Name: John Fritz\n- Company: Microsoft"}
]
current_query = "what his email id ?"

history_text = ""
for msg in history:
    role = msg.get("role", "user")
    content = msg.get("content", "")
    if role == "user":
        history_text += f"<|im_start|>user\n{content}<|im_end|>\n"
    elif role == "assistant":
        history_text += f"<|im_start|>assistant\n{content}<|im_end|>\n"

prompt = f"""<|im_start|>system
{system_prompt}
<|im_end|>
{history_text}<|im_start|>user
Context:
{context}

User Query: {current_query}<|im_end|>
<|im_start|>assistant
"""

print("PROMPT:")
print(prompt)

url = "http://localhost:11434/api/generate"
data = {
    "model": "phi3:mini",
    "prompt": prompt,
    "stream": False,
    "raw": True
}

try:
    response = requests.post(url, json=data)
    print("\nRESPONSE:")
    print(response.json().get("response"))
except Exception as e:
    print(f"Error: {e}")
