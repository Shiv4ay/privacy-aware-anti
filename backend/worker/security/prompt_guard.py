import re
import logging

logger = logging.getLogger(__name__)

# Very lightweight heuristic jailbreak signature detector
JAILBREAK_SIGNATURES = [
    r"(?i)\bignore\s+(all\s+)?previous\s+(instructions|prompts|directions)\b",
    r"(?i)\bdisregard\s+(all\s+)?previous\s+(instructions|prompts|directions)\b",
    r"(?i)\b(you\s+are\s+now|act\s+as)\s+(an\s+unfiltered|a\s+developer|a\s+system\s+admin|DAN)\b",
    r"(?i)\bforget\s+(all\s+)?(previous\s+)?instructions\b",
    r"(?i)\bprint\s+(your\s+)?(system\s+)?prompt\b",
    r"(?i)\boutput\s+(your\s+)?(system\s+)?prompt\b",
    r"(?i)\b(bypass|disable)\s+(security|filters|rules|guardrails)\b",
    r"(?i)\bwhat\s+are\s+your\s+(core\s+)?instructions\b",
    r"(?i)\bsimulat(e|ion)\b"
]

def scan_prompt(query: str) -> bool:
    """
    Scans a user query for obvious Prompt Injection/Jailbreak attempts.
    Returns True if a threat is detected, False otherwise.
    """
    if not query:
        return False
        
    query_lower = query.lower()
    
    for signature in JAILBREAK_SIGNATURES:
        if bool(re.search(signature, query_lower)):
            logger.warning(f"[SECURITY] Jailbreak signature detected: {signature}")
            return True
            
    return False
