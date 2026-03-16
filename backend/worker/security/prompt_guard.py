import re
import logging

logger = logging.getLogger(__name__)

# Enterprise-grade heuristic jailbreak and PII probe detector
JAILBREAK_SIGNATURES = [
    r"(?i)\b(ignore|disregard|forget|forgot)\b.*\b(previous|instruction|prompt|direction|rule|query|history)\b", # Broad memory override
    r"(?i)\b(you\s+are\s+now|act\s+as)\s+(an\s+unfiltered|a\s+developer|a\s+system\s+admin|DAN|GPT)\b",
    r"(?i)\b(output|print)\s+(your\s+)?(system\s+)?(prompt|instruction)\b",
    r"(?i)\b(bypass|disable|byp@ss|dis@ble)\s+(security|filter|rule|guardrail)\b", # Char swap bypass
    r"(?i)\bwhat\s+are\s+your\s+(core\s+)?instructions\b",
    r"(?i)\bsimulat(e|ion)\b",
    r"(?i)\bgive\s+me\s+(all|every|sensitive)\s+(info|records|data|profiles|names|emails)\b" # Broad PII probe
]

def scan_prompt(query: str, user_role: str = "student") -> bool:
    """
    Layer 1: Semantic Guard
    Scans a user query for Prompt Injection/Jailbreak/PII Probing.
    Admins are trusted and bypass this check for advanced analysis.
    """
    if not query:
        return False
        
    # Layer 1.1: Role-Aware Bypass (Trusted Admins)
    if user_role in ['admin', 'super_admin']:
        return False

    query_lower = query.lower()
    
    for signature in JAILBREAK_SIGNATURES:
        if bool(re.search(signature, query_lower)):
            logger.warning(f"[SECURITY SHIELD: LAYER 1] Threat detected from Role={user_role}: {signature}")
            return True
            
    return False
