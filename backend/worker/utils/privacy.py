# backend/worker/utils/privacy.py
import re
import os
import hashlib

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_RE = re.compile(r'\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}(?:x\d+)?\b')
SSN_RE = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

PII_PATTERNS = [EMAIL_RE, PHONE_RE, SSN_RE]

def redact_text(text: str) -> str:
    if not text:
        return text
    
    out = text
    # Order matters: more specific patterns first
    out = EMAIL_RE.sub('[EMAIL_REDACTED]', out)
    out = SSN_RE.sub('[SSN_REDACTED]', out)
    out = PHONE_RE.sub('[PHONE_REDACTED]', out)
    
    return out

def hash_query(text: str) -> str:
    salt = os.environ.get('QUERY_HASH_SALT', 'change_me_query_salt')
    h = hashlib.sha256()
    h.update((salt + (text or '')).encode('utf-8'))
    return h.hexdigest()
