"""
TDD Test: Verify LangChain + SQLAlchemy dependencies are importable.

This test runs INSIDE the worker Docker container to confirm Task 3 is complete.

Run locally (will fail until packages added):
  python backend/worker/ingestion/test_langchain_deps.py

Run inside container (must pass after docker build):
  docker exec privacy-aware-worker python /app/ingestion/test_langchain_deps.py
"""
import sys


def test_langchain_core():
    try:
        import langchain
        print(f"  [PASS] langchain {langchain.__version__}")
    except ImportError as e:
        raise AssertionError(f"langchain not importable: {e}")


def test_langchain_openai():
    try:
        import langchain_openai
        ver = getattr(langchain_openai, '__version__', 'installed')
        print(f"  [PASS] langchain_openai {ver}")
    except ImportError as e:
        raise AssertionError(f"langchain_openai not importable: {e}")


def test_langchain_community_sql():
    try:
        from langchain_community.utilities import SQLDatabase
        print("  [PASS] langchain_community.utilities.SQLDatabase")
    except ImportError as e:
        raise AssertionError(f"langchain_community SQLDatabase not importable: {e}")


def test_sqlalchemy():
    try:
        import sqlalchemy
        print(f"  [PASS] sqlalchemy {sqlalchemy.__version__}")
    except ImportError as e:
        raise AssertionError(f"sqlalchemy not importable: {e}")


def test_langchain_agents():
    try:
        from langchain_community.agent_toolkits.sql.base import create_sql_agent
        print("  [PASS] langchain_community.agent_toolkits.sql.base.create_sql_agent")
    except ImportError as e:
        raise AssertionError(f"create_sql_agent not importable: {e}")


if __name__ == "__main__":
    print("Running LangChain dependency tests...")
    failed = 0
    for t in [
        test_langchain_core,
        test_langchain_openai,
        test_langchain_community_sql,
        test_sqlalchemy,
        test_langchain_agents,
    ]:
        try:
            t()
        except AssertionError as e:
            print(f"  [FAIL] {t.__name__}: {e}")
            failed += 1

    if failed:
        print(f"\n{failed} test(s) FAILED — add packages to requirements.txt and rebuild Docker.")
        sys.exit(1)
    else:
        print("\nAll tests PASSED.")
