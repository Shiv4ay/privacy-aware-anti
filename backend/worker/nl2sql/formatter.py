"""
Task 8: NL2SQL response formatter.

Wraps a direct NL2SQL answer into the standard /chat response envelope
so the caller can return it immediately without a second LLM pass.

The NL2SQL agent (gpt-4o-mini) already produced a clean conversational
answer — there is no need to re-process it through generate_chat_response().
Re-processing risks distorting the mathematically accurate number.
"""
from typing import Any, Dict


def format_nl2sql_response(query: str, nl2sql_answer: str) -> Dict[str, Any]:
    """
    Wrap an NL2SQL answer in the standard /chat response envelope.

    Args:
        query:         The original user question.
        nl2sql_answer: The answer produced by run_analytics_query().

    Returns:
        Dict matching the /chat response shape:
          {query, response, context_used, status, pii_detected, pii_types, pii_map}
    """
    response_text = nl2sql_answer.strip() if nl2sql_answer else (
        "No analytics data was found for that query."
    )

    return {
        "query": query,
        "response": response_text,
        "context_used": True,
        "status": "success",
        "pii_detected": False,   # Postgres aggregate answers contain no personal PII
        "pii_types": [],
        "pii_map": None,         # No PII tokens in aggregate math results
    }
