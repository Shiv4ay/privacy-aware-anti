"""
Task 4: LangChain SQLDatabase connection — read-only, analytics tables only.

Exposes ONLY the `placements`, `internships`, and `companies` tables to the
NL2SQL agent. All other tables (users, audit_logs, documents, etc.) are hidden
— the agent cannot reference or join against them, enforcing "Zero Data Payload"
privacy.

The `companies` table allows the agent to JOIN on company_id and return real
company names (e.g. "Swiggy") instead of raw IDs (e.g. "COMP_MCA022").

Read-only is enforced at the PostgreSQL session level via:
  SET default_transaction_read_only = on

This means even if the LLM generates a rogue INSERT/UPDATE/DROP, the
connection will reject it before execution.
"""
import logging

from sqlalchemy import create_engine, event
from langchain_community.utilities import SQLDatabase

logger = logging.getLogger(__name__)

# Only these tables are visible to the NL2SQL agent.
# Extending this list requires an explicit code change — not a prompt.
ANALYTICS_TABLES = ["placements", "internships", "companies"]

# Module-level engine cache — one pool per db_url, reused across requests.
# Prevents connection exhaustion from creating a new pool on every query.
_engine_cache: dict = {}


def _make_engine(db_url: str):
    """
    Create a SQLAlchemy engine whose every connection is read-only
    at the PostgreSQL transaction level.
    """
    # Use psycopg2 driver; pool_pre_ping keeps stale connections from failing silently
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=0,
        connect_args={"options": "-c default_transaction_read_only=on"},
    )

    # Belt-and-suspenders: also set read-only on every new connection via event
    @event.listens_for(engine, "connect")
    def _set_readonly(dbapi_conn, _record):
        with dbapi_conn.cursor() as cur:
            cur.execute("SET default_transaction_read_only = on")

    return engine


def get_analytics_db(db_url: str) -> SQLDatabase:
    """
    Return a LangChain SQLDatabase instance scoped to analytics tables only,
    connected via a read-only SQLAlchemy engine.

    The engine is cached per db_url — subsequent calls reuse the same pool
    instead of creating a new one on every request.

    Args:
        db_url: PostgreSQL connection string.

    Returns:
        Configured SQLDatabase ready for use with create_sql_agent().
    """
    if db_url not in _engine_cache:
        _engine_cache[db_url] = _make_engine(db_url)
        logger.info(f"[SQL_DB] Created new engine pool for {db_url[:40]}...")
    engine = _engine_cache[db_url]

    db = SQLDatabase(
        engine=engine,
        include_tables=ANALYTICS_TABLES,
        sample_rows_in_table_info=2,   # show 2 example rows in schema context
    )

    logger.info(
        f"[SQL_DB] Analytics DB ready. Tables: {db.get_usable_table_names()}"
    )
    return db
