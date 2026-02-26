# backend/worker/utils/privacy.py
import re
import os
import hashlib

# ── PII Regex Patterns ─────────────────────────────────────────────────────────
EMAIL_RE   = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_RE   = re.compile(
    r'\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}(?:x\d+)?\b'
)
SSN_RE     = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
ADDRESS_RE = re.compile(
    r'\b\d{1,5}\s[\w\s.,-]{3,80},\s+[\w\s]{2,40},\s+[A-Z]{2}\s+\d{4,5}\b',
    re.IGNORECASE,
)

# ── Known Company Names (from companies.csv + alumni.csv) ─────────────────────
# These are redacted when they appear in AI responses because they are
# placement-sensitive personal data
KNOWN_COMPANIES = [
    "Panasonic","LG","AMD","Sony","Boston Consulting Group","Lyft","Infosys",
    "Spotify","TCS","Apple","HCL","Tech Mahindra","Bank of America","Accenture",
    "Goldman Sachs","Dell","Oracle","Meta","Tesla","Amazon","Samsung","Twitter",
    "Cisco","IBM","EY","Google","Hitachi","HP","Bain & Company","PwC","Toshiba",
    "NVIDIA","McKinsey","Airbnb","Deloitte","Cognizant","JP Morgan","Snap",
    "Adobe","Uber","Morgan Stanley","Wells Fargo","Citigroup","Netflix",
    "Pinterest","Intel","Microsoft","KPMG","Salesforce","Wipro",
    # common generic titles that appear in alumni current_company
    "Data Analyst","Business Analyst","Financial Analyst","Software Engineer",
    "Marketing Executive","Operations Manager","HR Associate","Product Manager",
    "Consultant","Senior Engineer",
]
# Build a case-sensitive alternation regex — longest match wins
_company_pattern = '|'.join(
    re.escape(c) for c in sorted(KNOWN_COMPANIES, key=len, reverse=True)
)
COMPANY_RE = re.compile(r'\b(?:' + _company_pattern + r')\b')


def redact_text(text: str) -> str:
    """Replace PII with structured tokens: [TYPE:original_value]"""
    if not text:
        return text

    out = text
    # Order matters: more specific patterns first
    out = EMAIL_RE.sub(lambda m: f'[EMAIL:{m.group()}]', out)
    out = SSN_RE.sub(lambda m: f'[SSN:{m.group()}]', out)
    out = PHONE_RE.sub(lambda m: f'[PHONE:{m.group()}]', out)
    out = ADDRESS_RE.sub(lambda m: f'[ADDRESS:{m.group()}]', out)
    out = COMPANY_RE.sub(lambda m: f'[COMPANY:{m.group()}]', out)

    return out


def hash_query(text: str) -> str:
    salt = os.environ.get('QUERY_HASH_SALT', 'change_me_query_salt')
    h = hashlib.sha256()
    h.update((salt + (text or '')).encode('utf-8'))
    return h.hexdigest()


# ── Backward-compat helpers (used by audit log PII detection) ─────────────────
def has_pii(text: str) -> bool:
    """Return True if redact_text would change anything."""
    return redact_text(text) != text


def pii_types_in(text: str) -> list:
    """Return which PII types are present in text."""
    found = []
    if EMAIL_RE.search(text):   found.append('email')
    if SSN_RE.search(text):     found.append('ssn')
    if PHONE_RE.search(text):   found.append('phone')
    if ADDRESS_RE.search(text): found.append('address')
    if COMPANY_RE.search(text): found.append('company')
    return found
