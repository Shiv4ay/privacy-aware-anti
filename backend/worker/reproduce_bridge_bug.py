import re

def build_search_query(message: str, history: list) -> str:
    if not history or len(history) == 0:
        return message

    context_ids = set()
    context_names = set()
    
    recent_history = history[-6:]
    for h in recent_history:
        content = h.get("content", "") if isinstance(h, dict) else ""
        if not content: continue
        
        for m in re.finditer(r'\b(PES|STU|RES|INT|PLC|COMP|FAC|CRS|DEPT|MCA|ALU|USR)[A-Z0-9_\-]*\b', content, re.IGNORECASE):
            found_id = m.group(0).upper()
            context_ids.add(found_id)
            
    pronouns = ["he", "she", "him", "her", "they", "them", "his", "hers", "their", "it", "who", "where", "what", "which"]
    targets = ["score", "mark", "grade", "detail", "result", "address", "phone", "email", "internship", "placement", "placed", "teach", "study", "lives"]
    message_lower = message.lower()
    
    is_follow_up = (
        len(message.split()) < 12 or 
        any(f" {p} " in f" {message_lower} " for p in pronouns) or 
        any(t in message_lower for t in targets)
    )
    
    if is_follow_up and (context_ids or context_names):
        parts = [message]
        for cid in context_ids:
            if cid.lower() not in message_lower:
                parts.append(cid)
        return " ".join(parts)
    return message

# REPRODUCTION CASE
history = [{"role": "user", "content": "pes1pg24ca165 give details"}]
query = "pes1pg24ca001 give details"

bridged_query = build_search_query(query, history)
print(f"Original Query: {query}")
print(f"Bridged Query:  {bridged_query}")

if "CA165" in bridged_query.upper() and "CA001" in bridged_query.upper():
    print("❌ BUG CONFIRMED: Bridged old ID into new ID query.")
else:
    print("✅ Logic working as expected.")
