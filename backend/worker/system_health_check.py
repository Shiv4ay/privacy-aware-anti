import os
import psycopg2
import chromadb
import redis
import requests
from minio import Minio

def check_postgres():
    try:
        url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@postgres:5432/privacy_docs")
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return "PASS"
    except Exception as e:
        return f"FAIL: {e}"

def check_chromadb():
    try:
        host = os.getenv("CHROMADB_HOST", "chromadb")
        port = int(os.getenv("CHROMADB_PORT", 8000))
        client = chromadb.HttpClient(host=host, port=port)
        client.heartbeat()
        return "PASS"
    except Exception as e:
        return f"FAIL: {e}"

def check_redis():
    try:
        url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        r = redis.from_url(url)
        r.ping()
        return "PASS"
    except Exception as e:
        return f"FAIL: {e}"

def check_minio():
    try:
        # Inside docker, endpoint should be minio:9000
        endpoint = "minio:9000"
        access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=False
        )
        client.bucket_exists("privacy-documents")
        return "PASS"
    except Exception as e:
        return f"FAIL: {e}"

def check_worker_api():
    try:
        # Increase timeout as worker is busy indexing
        r = requests.get("http://localhost:8001/health", timeout=15)
        if r.status_code == 200:
            return "PASS"
        else:
            return f"FAIL: HTTP {r.status_code}"
    except Exception as e:
        return f"FAIL: {e}"

if __name__ == "__main__":
    print("--- SYSTEM HEALTH CHECK ---")
    print(f"PostgreSQL: {check_postgres()}")
    print(f"ChromaDB:   {check_chromadb()}")
    print(f"Redis:      {check_redis()}")
    print(f"MinIO:      {check_minio()}")
    print(f"Worker API: {check_worker_api()}")
    print("---------------------------")
