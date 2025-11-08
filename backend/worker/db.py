# backend/worker/db.py
import os
import json
import psycopg2
from psycopg2.extras import Json

_conn = None

def get_conn():
    global _conn
    if _conn is None:
        dsn = os.environ.get('WORKER_POSTGRES_URL') or os.environ.get('POSTGRES_URL') or os.environ.get('DATABASE_URL')
        if not dsn:
            raise RuntimeError("WORKER_POSTGRES_URL / DATABASE_URL not set in worker env")
        _conn = psycopg2.connect(dsn)
        _conn.autocommit = True
    return _conn

def insert_audit_log(user_id, action, resource_type, resource_id, details, ip_address=None, user_agent=None):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (user_id, action, resource_type, resource_id, Json(details), ip_address, user_agent))
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None
