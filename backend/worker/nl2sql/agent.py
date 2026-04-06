"""
Task 5: NL2SQL Agent — gpt-4o-mini + strict system prompt + org_id injection.

Security guarantees:
  1. Only SELECT statements execute (read-only connection from Task 4).
  2. org_id is PHYSICALLY injected into the system prompt as a hard constraint —
     the LLM cannot generate a query that omits it.
  3. Only placements, internships, companies tables are visible (Task 4 include_tables).
  4. No DDL (DROP/CREATE/ALTER) can succeed — blocked by read-only connection.
"""
import logging
import os

from langchain_openai import ChatOpenAI
from langchain_community.agent_toolkits.sql.base import create_sql_agent
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit

from nl2sql.sql_database import get_analytics_db
from nl2sql.security import validate_sql, SQLSecurityError

logger = logging.getLogger(__name__)

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
_MODEL = os.getenv("PRIMARY_MODEL", "gpt-4o-mini")

# ---------------------------------------------------------------------------
# System prompt — injected with org_id at call time
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT_TEMPLATE = """You are a secure university analytics assistant.

## STRICT RULES (NEVER VIOLATE):
1. You MUST always include `WHERE org_id = {org_id}` (or `AND org_id = {org_id}`)
   in EVERY SQL query you generate. This is mandatory for tenant isolation.
2. You may ONLY generate SELECT statements. Never generate INSERT, UPDATE,
   DELETE, DROP, CREATE, ALTER, or TRUNCATE.
3. You may ONLY query the `placements`, `internships`, and `companies` tables.
4. For salary/CTC questions, use the `salary` column in `placements`.
5. For stipend questions, use the `stipend` column in `internships`.
6. Return a clean, concise conversational answer — not raw SQL.
7. If a query returns zero rows, say "No records found for this organization."
8. For list queries ("show all students in X", "who is placed at Y"), return a
   COMPACT summary: total count + a numbered list of AT MOST 10 entries.
   If there are more than 10, add "...and N more." at the end.
   Never return full profiles. Example format for 26 students:
     "26 students are placed in Bangalore:
      1. PES1PG24CA002 — Software Engineer @ Oracle India
      2. PES1PG24CA015 — Data Analyst @ HCL Technologies
      ...and 24 more."
   Use LIMIT 10 in your SQL for the numbered list part.

## AVAILABLE TABLES:
- placements  (placement_id, org_id, student_id, company_id, position, salary,
               placement_date, location, employment_type, status)
- internships (internship_id, org_id, student_id, company_id, position,
               start_date, end_date, stipend, location, status, supervisor)
- companies   (org_id, company_id, company_name, industry, location, website)

## COMPANY NAME RESOLUTION (IMPORTANT):
The `placements` and `internships` tables store `company_id` (e.g. COMP_MCA022).
You MUST NEVER show raw `company_id` values in any response.
ALWAYS JOIN the `companies` table to return the real `company_name` (e.g. "Swiggy").

Required JOIN for ANY query that involves company output:
  FROM placements p
  JOIN companies c ON p.company_id = c.company_id AND c.org_id = {org_id}
  WHERE p.org_id = {org_id}

For student list queries (e.g. "show all students in Bangalore"), use:
  SELECT p.student_id, p.position, c.company_name
  FROM placements p
  JOIN companies c ON p.company_id = c.company_id AND c.org_id = {org_id}
  WHERE p.org_id = {org_id} AND p.location = 'Bangalore'
  LIMIT 10

## TENANT ISOLATION REMINDER:
Every query MUST contain: WHERE org_id = {org_id}
Queries without this filter will be rejected by the security layer.
"""


def _wrap_db_run(db, org_id: int):
    """
    Patch db.run() so validate_sql fires before every SQL the agent executes.
    SQLSecurityError from the validator surfaces as a tool error, causing the
    agent to report failure rather than silently executing a bad query.
    """
    original_run = db.run

    def _secure_run(command: str, *args, **kwargs):
        validate_sql(command, org_id=org_id)           # raises SQLSecurityError if unsafe
        return original_run(command, *args, **kwargs)

    db.run = _secure_run
    return db


def _build_agent(db_url: str, org_id: int):
    """Build and return a configured LangChain SQL Agent Executor."""
    db = get_analytics_db(db_url)
    db = _wrap_db_run(db, org_id)   # intercept every SQL call

    llm = ChatOpenAI(
        model=_MODEL,
        temperature=0,
        api_key=_OPENAI_API_KEY,
    )

    toolkit = SQLDatabaseToolkit(db=db, llm=llm)

    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(org_id=org_id)

    agent = create_sql_agent(
        llm=llm,
        toolkit=toolkit,
        agent_type="openai-tools",
        prefix=system_prompt,
        verbose=False,
        handle_parsing_errors=True,
        max_iterations=6,
    )
    return agent


def run_analytics_query(query: str, org_id: int, db_url: str = None) -> str:
    """
    Execute a natural-language analytics query against the SQL agent.

    Args:
        query:  Natural language question (e.g., "What is the highest CTC?")
        org_id: Organization ID — physically injected into every SQL query.
        db_url: PostgreSQL connection string. Falls back to DATABASE_URL env var.

    Returns:
        Conversational string answer with the computed result.
    """
    if db_url is None:
        db_url = os.getenv("DATABASE_URL")

    try:
        agent = _build_agent(db_url, org_id)
        # Append org_id reminder to the user question as belt-and-suspenders
        augmented_query = f"{query} (organization: {org_id})"
        result = agent.invoke({"input": augmented_query})
        answer = result.get("output", str(result))
        logger.info(f"[NL2SQL] org={org_id} query={query!r} => {answer[:100]}")
        return answer

    except Exception as e:
        logger.error(f"[NL2SQL] Agent error for org={org_id}: {e}")
        return f"Analytics query failed: {e}"
