# worker/lib/audit.py
import os
import json
import psycopg2
from contextlib import closing

DATABASE_URL = os.environ.get('DATABASE_URL')

def write_audit(user_id=None, action='search', details=None):
    details = details or {}
    q = """
    INSERT INTO audit_logs (user_id, action, details, created_at)
    VALUES (%s, %s, %s::jsonb, now())
    RETURNING id;
    """
    # psycopg2.connect accepts DATABASE_URL like postgres://...
    with closing(psycopg2.connect(DATABASE_URL)) as conn:
        with conn.cursor() as cur:
            cur.execute(q, (user_id, action, json.dumps(details)))
            conn.commit()
            try:
                return cur.fetchone()[0]
            except Exception:
                return None
