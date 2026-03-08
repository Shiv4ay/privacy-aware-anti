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

# ── Strict Mode Patterns ───────────────────────────────────────────────────────
# Aggressively matches capitalized names (e.g., "John Doe", "Jane Smith")
STRICT_NAME_RE = re.compile(r'\b[A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}\b')


def redact_text(text: str, strictness: str = "standard", return_map: bool = False) -> str:
    """Replace PII with structured tokens: [TYPE:idx_N]"""
    if not text:
        return (text, {}) if return_map else text

    # Regex patterns mapped to display types
    # (Matches app.py Presidio mapping for consistency)
    PATTERNS = [
        (EMAIL_RE, "EMAIL"),
        (SSN_RE, "SSN"),
        (PHONE_RE, "PHONE"),
        (ADDRESS_RE, "ADDRESS"),
        (COMPANY_RE, "COMPANY"),
    ]

    pii_map = {}
    counters = {}
    out = text

    # Specific patterns first
    for pattern, display_type in PATTERNS:
        def replace(m):
            idx = counters.get(display_type, 0)
            counters[display_type] = idx + 1
            token = f"[{display_type}:idx_{idx}]"
            pii_map[token] = m.group()
            return token
        
        out = pattern.sub(replace, out)

    if strictness == "strict":
        def replace_name(m):
            idx = counters.get("PERSON", 0)
            counters["PERSON"] = idx + 1
            token = f"[PERSON:idx_{idx}]"
            pii_map[token] = m.group()
            return token
        out = STRICT_NAME_RE.sub(replace_name, out)

    if return_map:
        return out, pii_map
    return out


def hash_query(text: str) -> str:
    salt = os.environ.get('QUERY_HASH_SALT', 'change_me_query_salt')
    h = hashlib.sha256()
    h.update((salt + (text or '')).encode('utf-8'))
    return h.hexdigest()


# ── Backward-compat helpers (used by audit log PII detection) ─────────────────
def has_pii(text: str, strictness: str = "standard") -> bool:
    """Return True if redact_text would change anything."""
    return redact_text(text, strictness) != text


def pii_types_in(text: str) -> list:
    """Return which PII types are present in text."""
    found = []
    if EMAIL_RE.search(text):   found.append('email')
    if SSN_RE.search(text):     found.append('ssn')
    if PHONE_RE.search(text):   found.append('phone')
    if ADDRESS_RE.search(text): found.append('address')
    if COMPANY_RE.search(text): found.append('company')
    return found
