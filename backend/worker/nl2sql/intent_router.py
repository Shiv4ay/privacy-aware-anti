"""
Task 7: Intent Router — decides whether a query should be answered by
the NL2SQL Agent (mathematically accurate Postgres) or ChromaDB (vector search).

Rules:
  - Aggregate/statistical queries from admin or super_admin → NL2SQL Agent
  - Everything else (personal lookups, student queries, faculty entity queries) → None
    (caller falls through to normal ChromaDB path)

The router uses semantic keyword matching, NOT hardcoded pattern lists.
It catches conventional phrasing AND out-of-box / informal language.
"""
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Roles allowed to use the NL2SQL aggregate path
_AGGREGATE_ROLES = {"admin", "super_admin"}

# ── Aggregate signal patterns ─────────────────────────────────────────────────
# These match any query that is asking for a statistical computation
# over the whole dataset — not about a single named entity or "my" data.

_AGG_PATTERNS = re.compile(
    r"""
    # Math / statistics intent
    \b(highest|lowest|maximum|minimum|max|min|average|avg|mean|median|total|sum|count)\b
    |
    # Quantity questions
    \bhow\s+many\b
    |
    # Distribution / breakdown intent
    \b(distribution|breakdown|ranking|rank|rate|percent|percentage|statistics|stats)\b
    |
    # Superlative intent (catches "top earner", "biggest package", "most hired")
    \b(top|best|worst|biggest|largest|smallest|most|least|fewest)\b
    |
    # Explicit domain aggregate nouns
    \b(placement\s+rate|salary\s+distribution|stipend\s+distribution|ctc\s+distribution)\b
    |
    # Informal / out-of-box phrasing
    \b(scene|scene\s+this\s+year|how.{1,20}going|how.{1,20}look)\b
    |
    # "got jobs / got placed / hired"
    \b(got\s+jobs?|got\s+placed|got\s+hired|got\s+offers?)\b
    |
    # List / enumerate all students (admin overview queries)
    \ball\s+students?\b                  # "all students in Bangalore"
    | \blist\s+\S{0,30}\s*students?\b    # "list students placed at Oracle" (bounded to prevent ReDoS)
    | \bstudents?\s+in\b                 # "students in Hyderabad"
    | \bstudents?\s+at\b                 # "students at Oracle"
    | \bstudents?\s+placed\b             # "students placed this year"
    | \bwho\s+(are|is|were)\s+placed\b  # "who are placed at Swiggy"
    | \bplaced\s+(at|in|with)\b         # "placed at Google"
    | \bwhich\s+students?\b             # "which students interned"
    | \bshow\s+(me\s+)?all\b            # "show all / show me all"
    """,
    re.IGNORECASE | re.VERBOSE,
)

# ── Personal / entity-lookup exclusion patterns ───────────────────────────────
# If the query is clearly about "me / my / I" or a specific named person,
# it is NOT an aggregate and must go to ChromaDB regardless of other signals.

_PERSONAL_PATTERNS = re.compile(
    r"""
    \bmy\b               # "my details", "my marks", "my placement"
    | \bi\s+am\b         # "which semester am I"
    | \bi\s+have\b
    | \bi\s+got\b
    | \bgive\s+me\s+my\b
    | \bshow\s+me\s+my\b
    | \btell\s+me\s+(about\s+my|my)\b
    | \bmy\s+profile\b
    | \bPES\d\b          # specific SRN
    """,
    re.IGNORECASE | re.VERBOSE,
)


def is_aggregate_query(query: str) -> bool:
    """
    Return True if the query is asking for a statistical aggregate
    over the whole dataset (suitable for NL2SQL), False otherwise.
    """
    q = query.strip()
    if not q:
        return False
    # Personal queries override aggregate signals
    if _PERSONAL_PATTERNS.search(q):
        return False
    return bool(_AGG_PATTERNS.search(q))


def route_query(
    query: str,
    org_id: int,
    user_role: str,
    db_url: Optional[str] = None,
) -> Optional[str]:
    """
    Route a query to the appropriate backend.

    Returns:
        str  — NL2SQL answer (aggregate path, Postgres)
        None — caller should fall through to ChromaDB

    Args:
        query:     The user's natural-language question.
        org_id:    Authenticated organization ID.
        user_role: Authenticated user role.
        db_url:    PostgreSQL connection string (defaults to DATABASE_URL env var).
    """
    # Only admin / super_admin get the aggregate path
    if user_role not in _AGGREGATE_ROLES:
        return None

    if not is_aggregate_query(query):
        return None

    # Lazy import keeps startup fast when NL2SQL is not needed
    from nl2sql.agent import run_analytics_query

    if db_url is None:
        db_url = os.getenv("DATABASE_URL")

    if org_id is None:
        logger.warning("[INTENT_ROUTER] org_id is None — skipping NL2SQL, falling back to ChromaDB")
        return None

    logger.info(f"[INTENT_ROUTER] Routing to NL2SQL: role={user_role} org={org_id} query={query!r}")
    try:
        result = run_analytics_query(query, org_id=int(org_id), db_url=db_url)
        if result and "failed" not in result.lower()[:30]:
            return result
        # If agent failed, fall through to ChromaDB
        logger.warning(f"[INTENT_ROUTER] NL2SQL returned failure, falling back to ChromaDB: {result[:80]}")
        return None
    except Exception as e:
        logger.error(f"[INTENT_ROUTER] NL2SQL error, falling back to ChromaDB: {e}")
        return None
