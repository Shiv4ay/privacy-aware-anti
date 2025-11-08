# backend/worker/utils/privacy.py
import re
import os
import hashlib

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_RE = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){6,14}\b')
SSN_RE = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

PII_PATTERNS = [EMAIL_RE, PHONE_RE, SSN_RE]

def redact_text(text: str, replacement='[REDACTED]') -> str:
    if not text:
        return text
    out = text
    for p in PII_PATTERNS:
        out = p.sub(replacement, out)
    return out

def hash_query(text: str) -> str:
    salt = os.environ.get('QUERY_HASH_SALT', 'change_me_query_salt')
    h = hashlib.sha256()
    h.update((salt + (text or '')).encode('utf-8'))
    return h.hexdigest()
