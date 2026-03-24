import re
import unicodedata
import logging

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# Enterprise-grade heuristic jailbreak and PII probe detector
# ALL roles are scanned — no admin bypass.  Prompt injection is NEVER safe.
# ────────────────────────────────────────────────────────────────────────────

JAILBREAK_SIGNATURES = [
    # Instruction override / memory wipe
    r"(?i)\b(ignore|disregard|forget|forgot|override|skip)\b.*\b(previous|prior|above|instruction|prompt|direction|rule|query|history|guidelines|policy|policies)\b",
    # Role / mode injection
    r"(?i)\b(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are)|switch\s+to|enter)\s+(an?\s+)?(unfiltered|developer|system\s*admin|superuser|root|debug|god|DAN|GPT|jailbreak|unrestricted|unlimited)\b",
    # System prompt exfiltration
    r"(?i)\b(output|print|show|reveal|display|dump|repeat|echo)\s+(your\s+)?(full\s+)?(system\s+)?(prompt|instruction|rules|configuration|config)\b",
    r"(?i)\bwhat\s+are\s+your\s+(core\s+|system\s+|internal\s+)?instructions\b",
    r"(?i)\b(show|give|tell)\s+me\s+(the\s+)?(system\s+)?prompt\b",
    # Security bypass
    r"(?i)\b(bypass|disable|byp@ss|dis@ble|turn\s+off|deactivate|remove)\s+(security|privacy|filter|rule|guardrail|restriction|redaction|pii|audit|logging)\b",
    # Privilege escalation
    r"(?i)\b(elevat|escalat|promot)\w*\s+(access|privilege|permission|role|level)\b",
    r"(?i)\baccess\s+level\s+(elevated|changed|set)\b",
    r"(?i)\b(i\s+am|i'm)\s+(an?\s+)?(admin|superadmin|super_admin|root|administrator)\b",
    # Debug / test mode injection
    r"(?i)\b(debug|test|maintenance|developer|dev)\s+mode\b",
    r"(?i)\b(enable|enter|activate|switch\s+to)\s+(debug|test|raw|verbose|unsafe)\b",
    # Bulk data harvesting
    r"(?i)\b(give|show|list|get|fetch|export|dump|extract)\s+me\s+(all|every|complete|entire|full)\s+(student|user|record|data|profile|name|email|phone|salary|pii|info|information|detail)\b",
    r"(?i)\b(all|every)\s+(student|user)s?\s+(data|record|email|phone|info|detail|name)\b",
    # SQL / code injection probes
    r"(?i)\b(execute|run|eval)\s+(this\s+)?(sql|query|code|script|command)\b",
    r"(?i)\bSELECT\s+\*\s+FROM\b",
    r"(?i)\bDROP\s+TABLE\b",
    r"(?i)\b(union\s+select|or\s+1\s*=\s*1|'\s*or\s*')\b",
    # Exfiltration / external communication
    r"(?i)\b(send|post|upload|transmit|exfiltrate|forward)\s+(this\s+)?(data|info|record|result)\s+(to|via)\b",
    r"(?i)\b(call|invoke|fetch|curl|wget)\s+(an?\s+)?(external|outside|remote)\s+(api|url|endpoint|server)\b",
    # Credential harvesting
    r"(?i)\b(password|secret|key|token|credential|api.?key|jwt)\b.*\b(what|show|give|tell|reveal)\b",
    r"(?i)\b(what|show|give|tell|reveal)\b.*\b(password|secret|key|token|credential|api.?key|jwt)\b",
    # Audit/logging sabotage
    r"(?i)\b(disable|stop|pause|delete|clear|remove)\s+(audit|log|logging|monitoring|tracking)\b",
    # Cross-student impersonation
    r"(?i)\b(pretend|act|behave)\s+(to\s+be|as\s+if|like)\s+(i\s+am|i'm|another|different)\b",
    # Backdoor / persistence
    r"(?i)\b(create|add|insert)\s+(a\s+)?(backdoor|hidden|secret)\s+(user|account|admin|access)\b",
    # T9.6: Indirect jailbreak patterns ──────────────────────────────────────
    # Legal / authority pretext — fake court orders, warrants, compliance demands
    # M2-fix: use .{0,40} gap so 2+ filler words between keyword and verb are caught
    r"(?i)\b(court\s+order|legal\s+order|law\s+enforcement|warrant|subpoena|fbi|cia|government\s+order).{0,40}\b(require|request|demand|mandate|need)\w*\b",
    r"(?i)\b(compliance|regulatory|gdpr|hipaa|legal)\b.{0,30}\b(require|demand|mandate)\w*\s+(unredact|raw|full|unrestrict|bypass)\b",
    # Hypothetical / "what if" filter bypass framing
    r"(?i)\b(what\s+if|imagine|suppose|hypothetically|theoretically|in\s+a\s+hypothetical)\s+.{0,60}(privacy|filter|redact|guardrail|security|restriction|rule)\s+(was\s+)?(removed|disabled|off|gone|not\s+exist)\b",
    r"(?i)\bif\s+(there\s+was\s+no|without\s+(any\s+)?|no)\s+(privacy|filter|redact|guardrail|security|restriction)\b",
    # Pen-test / security audit pretext — claimed authorization to bypass
    r"(?i)\b(penetration\s+test|pentest|pen\s+test|security\s+audit|red\s+team|authorized\s+test)\b.{0,80}(bypass|ignore|skip|disable|override)\b",
    r"(?i)\b(bypass|override|ignore)\b.{0,80}\b(penetration\s+test|pentest|pen\s+test|security\s+audit|authorized)\b",
    # Research / thesis excuse — requesting raw PII under academic pretext
    r"(?i)\b(for\s+(my\s+)?(thesis|research|paper|study|dissertation|academic\s+work))\b.{0,80}(raw|unredact|full|real|actual)\s+(pii|data|record|information|name|phone|email)\b",
    r"(?i)\b(research\s+purpose|academic\s+purpose|educational\s+purpose)\b.{0,80}(show|give|provide|expose|reveal)\b.{0,40}(pii|personal|private|sensitive|student)\b",
]

def scan_prompt(query: str, user_role: str = "student") -> bool:
    """
    Layer 1: Semantic Guard — applies to ALL roles (admin included).
    Prompt injection attacks are dangerous regardless of the user's role.
    A compromised admin account is the highest-risk scenario.
    """
    if not query:
        return False

    # MED-1: Normalize Unicode to defeat homoglyph / zero-width char bypass attempts.
    # NFKC collapses visually similar characters (e.g., ａｃｔ → act, ﬁ → fi).
    # Strip zero-width and invisible control characters used to split keywords.
    query = unicodedata.normalize("NFKC", query)
    query = re.sub(r"[\u200b-\u200f\u2060-\u2064\ufeff\u00ad]", "", query)

    for signature in JAILBREAK_SIGNATURES:
        if re.search(signature, query):
            logger.warning(
                f"[SECURITY SHIELD: LAYER 1] Threat detected | Role={user_role} | Pattern={signature[:60]}"
            )
            return True

    return False
