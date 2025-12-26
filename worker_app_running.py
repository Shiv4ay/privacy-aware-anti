

import os
import time
import json
import uuid
import asyncio
import logging
import re
import hashlib
from typing import List, Optional, Dict, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2
from psycopg2.extras import Json as PGJson
from psycopg2.pool import SimpleConnectionPool
import redis
import requests
from minio import Minio
from pypdf import PdfReader
from threading import Thread
import chromadb

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
import uvicorn
import openai
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tiktoken
from ingestion.web_scraper import WebScraper

# Initialize Scraper
scraper = WebScraper()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------
# Configuration
# -----------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio")
MINIO_PORT = int(os.getenv("MINIO_PORT", 9000))
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "secure_password")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "privacy-documents")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "gpt-4o-mini")
PRIMARY_EMBED = os.getenv("PRIMARY_EMBED", "text-embedding-3-small")
LOCAL_CHAT_MODEL = os.getenv("LOCAL_CHAT_MODEL", "phi3:mini")
LOCAL_EMBED_MODEL = os.getenv("LOCAL_EMBED_MODEL", "nomic-embed-text")

if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
# Accept comma-separated list of embedding models
OLLAMA_EMBED_MODELS_RAW = os.getenv("OLLAMA_EMBED_MODEL", "mxbai-embed-large")
# parse into list, strip whitespace and ignore empties
OLLAMA_EMBED_MODELS = [m.strip() for m in OLLAMA_EMBED_MODELS_RAW.split(",") if m.strip()]

CHROMADB_HOST = os.getenv("CHROMADB_HOST", "chromadb")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", 8000))
CHROMADB_COLLECTION = os.getenv("CHROMADB_COLLECTION", "privacy_documents")

TOP_K = int(os.getenv("TOP_K", 5))
QUERY_HASH_SALT = os.getenv("QUERY_HASH_SALT", "change_me_query_salt")

# DB pool settings
DB_MIN_CONN = int(os.getenv("DB_MIN_CONN", 1))
DB_MAX_CONN = int(os.getenv("DB_MAX_CONN", 6))

# -----------------------------
# Ollama embed model resolver (minimal, non-invasive)
# -----------------------------
def _parse_env_model_list(raw_list: Optional[str]) -> List[str]:
    """Return deduplicated list preserving order from env string"""
    if not raw_list:
        return []
    parts = []
    for p in [x.strip() for x in raw_list.replace(";", ",").split(",")]:
        if p and p not in parts:
            parts.append(p)
    return parts

def _query_ollama_available_models(ollama_url: str) -> Optional[set]:
    """
    Try to query Ollama for available models. Returns a set of model 'names' (without tags)
    or None if unable to query.
    """
    try:
        endpoints = ["/api/tags", "/api/models"]
        for path in endpoints:
            try:
                r = requests.get(f"{ollama_url.rstrip('/')}{path}", timeout=4)
                if r.status_code != 200:
                    continue
                j = r.json()
                names = set()
                # different Ollama versions return different shapes
                if isinstance(j, dict) and "models" in j and isinstance(j["models"], list):
                    models = j["models"]
                elif isinstance(j, list):
                    models = j
                elif isinstance(j, dict):
                    # sometimes tags endpoint returns {'tags':[...]} or similar
                    models = j.get("models") or j.get("tags") or []
                else:
                    models = []
                for m in models:
                    if isinstance(m, dict):
                        name = m.get("name") or m.get("model")
                    else:
                        name = m
                    if name:
                        # strip possible :latest suffix for matching
                        names.add(str(name).split(":")[0])
                if names:
                    return names
            except Exception:
                continue
    except Exception:
        pass
    return None

def resolve_single_embed_model(ollama_url: str, env_raw: Optional[str]) -> str:
    """
    Resolve a single embed model to use:
      - prefer the first candidate from env that Ollama reports as available
      - try a short embedding test call at startup to ensure the chosen model actually returns a non-empty embedding
      - if can't query Ollama, return the first env candidate
      - fallback to common defaults if env candidates not present
    """
    candidates = _parse_env_model_list(env_raw)
    if not candidates:
        logger.info("No embed-model env found; defaulting to ['nomic-embed-text']")
        return "nomic-embed-text"

    available = _query_ollama_available_models(ollama_url)
    if available is None:
        logger.warning("Could not query Ollama at %s; using first env candidate: %s", ollama_url, candidates[0])
        return candidates[0]

    # Filter env candidates by availability (match prefix)
    matched_candidates = []
    for c in candidates:
        if c in available or any(a.startswith(c) for a in available):
            matched_candidates.append(c)

    # If we have matched candidates, prefer to pick one that passes a quick embedding test
    test_text = "hello from startup"
    def test_model_returns_embedding(model_name: str) -> bool:
        # Try both plain name and :latest tag variants
        variants = [model_name]
        if ":" not in model_name:
            variants.append(f"{model_name}:latest")
        for v in variants:
            try:
                resp = requests.post(f"{ollama_url.rstrip('/')}/api/embeddings", json={"model": v, "input": test_text}, timeout=6)
                if resp.status_code != 200:
                    continue
                j = resp.json()
                # check common shapes
                emb = None
                if isinstance(j, dict) and "embedding" in j:
                    if isinstance(j["embedding"], list) and len(j["embedding"]) > 0 and isinstance(j["embedding"][0], (int, float)):
                        emb = j["embedding"]
                elif isinstance(j, dict) and "embeddings" in j:
                    if isinstance(j["embeddings"], list) and len(j["embeddings"]) > 0:
                        first = j["embeddings"][0]
                        if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
                            emb = first
                elif isinstance(j, dict) and "data" in j and isinstance(j["data"], list) and len(j["data"]) > 0:
                    first = j["data"][0]
                    if isinstance(first, dict) and "embedding" in first and isinstance(first["embedding"], list) and len(first["embedding"]) > 0:
                        emb = first["embedding"]
                elif isinstance(j, list) and len(j) > 0:
                    first = j[0]
                    if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
                        emb = first
                    elif all(isinstance(x, (int, float)) for x in j):
                        emb = j

                if emb and isinstance(emb, list) and len(emb) > 0:
                    logger.info("Embed test succeeded for model variant '%s' (len=%d)", v, len(emb))
                    return True
            except Exception as e:
                logger.debug("Embed test failed for %s: %s", v, e)
                continue
        return False

    # Try matched candidates first (in order)
    for c in matched_candidates:
        if test_model_returns_embedding(c):
            logger.info("Resolved embed model from env candidates (tested OK): %s", c)
            return c

    # If no matched candidate passed the test, try preferred fallbacks among available models
    preferred = ["nomic-embed-text", "mxbai-embed-large"]
    for p in preferred:
        if p in available:
            if test_model_returns_embedding(p):
                logger.warning("Selecting preferred available model (tested OK): %s", p)
                return p

    # If no test succeeded, but matched candidates exist, return first matched candidate (best-effort)
    if matched_candidates:
        logger.warning("No embed test passed; falling back to first matched env candidate: %s", matched_candidates[0])
        return matched_candidates[0]

    # If still nothing, pick first available preferred or any available
    for p in preferred:
        if p in available:
            logger.warning("Env candidates not found; selecting available preferred model: %s", p)
            return p

    pick = sorted(list(available))[0]
    logger.warning("Falling back to available Ollama model: %s", pick)
    return pick

# Enforce a single embed model to avoid mixed vector dimensions being written to one Chroma collection
SELECTED_EMBED_MODEL = resolve_single_embed_model(OLLAMA_URL, OLLAMA_EMBED_MODELS_RAW)
OLLAMA_EMBED_MODELS = [SELECTED_EMBED_MODEL]
logger.info("Configured Ollama embed model (enforced single): %s", SELECTED_EMBED_MODEL)

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="Privacy-Aware RAG Worker", version="1.0.0")

# -----------------------------
# ChromaDB client
# -----------------------------
# Note: chromadb client usage depends on installed client version; adapt if required.
chroma_client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
chroma_collection = chroma_client.get_or_create_collection(name=CHROMADB_COLLECTION)

# -----------------------------
# Pydantic models
# -----------------------------
class EmbedRequest(BaseModel):
    id: Optional[str] = None
    text: str

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = TOP_K
    organization: Optional[str] = "default"
    org_id: Optional[int] = None
    department: Optional[str] = None
    user_category: Optional[str] = None
    model_preference: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    query: str
    context: Optional[str] = None
    organization: Optional[str] = "default"
    org_id: Optional[int] = None
    department: Optional[str] = None
    user_category: Optional[str] = None
    model_preference: Optional[Dict[str, Any]] = None

def get_org_collection(org_id: Optional[int] = None, org_name: str = "default"):
    """Get or create a ChromaDB collection for a specific organization"""
    if org_id:
        collection_name = f"privacy_documents_{org_id}"
    else:
        # Fallback to name-based if ID not provided (legacy/default)
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', org_name).lower()
        collection_name = f"privacy_documents_{safe_name}"
    
    return chroma_client.get_or_create_collection(name=collection_name)

class DocumentChunk(BaseModel):
    id: str
    text: str
    score: float

# -----------------------------
# Privacy helpers (redaction + hashing)
# -----------------------------
EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_RE = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){6,14}\b')
SSN_RE = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

PII_PATTERNS = [EMAIL_RE, PHONE_RE, SSN_RE]

def redact_text(text: str, replacement='[REDACTED]') -> str:
    if not text:
        return text
    out = text
    for p in PII_PATTERNS:
        out = p.sub(replacement, out)
    return out

def hash_query(text: str) -> str:
    salt = QUERY_HASH_SALT or "change_me_query_salt"
    h = hashlib.sha256()
    h.update((salt + (text or '')).encode('utf-8'))
    return h.hexdigest()

# -----------------------------
# DB / Audit helpers (pool-based)
# -----------------------------
db_pool: Optional[SimpleConnectionPool] = None

def init_db_pool():
    """Initialize the psycopg2 SimpleConnectionPool."""
    global db_pool
    if db_pool:
        return db_pool
    try:
        # psycopg2.connect accepts a DSN or connection string
        db_pool = SimpleConnectionPool(
            DB_MIN_CONN,
            DB_MAX_CONN,
            dsn=DATABASE_URL
        )
        logger.info("Initialized DB connection pool (min=%d max=%d)", DB_MIN_CONN, DB_MAX_CONN)
    except Exception as e:
        logger.exception("Failed to initialize DB pool: %s", e)
        db_pool = None
    return db_pool

def get_conn(timeout=5):
    """Get a connection from the pool; raise HTTPException if unavailable."""
    global db_pool
    if not db_pool:
        init_db_pool()
    if not db_pool:
        raise RuntimeError("DB pool not available")
    try:
        return db_pool.getconn()
    except Exception as e:
        logger.exception("Failed to acquire DB connection from pool: %s", e)
        raise

def put_conn(conn):
    """Return a connection to the pool (if pool exists)."""
    global db_pool
    try:
        if db_pool and conn:
            db_pool.putconn(conn)
    except Exception as e:
        logger.exception("Failed to return DB connection to pool: %s", e)

def close_db_pool():
    global db_pool
    try:
        if db_pool:
            db_pool.closeall()
            db_pool = None
            logger.info("Closed DB pool")
    except Exception as e:
        logger.exception("Error closing DB pool: %s", e)

def insert_audit_log(user_id, action, resource_type, resource_id, details, ip_address=None, user_agent=None):
    """
    Insert an audit log into audit_logs table.
    details should be a JSON-serializable dict (will be stored as jsonb).
    Uses pooled connections.
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (user_id, action, resource_type, resource_id, PGJson(details), ip_address, user_agent))
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
    except Exception as e:
        logger.exception("Failed to insert audit log: %s", e)
        # don't propagate to callers (best-effort audit)
        return None
    finally:
        if conn:
            put_conn(conn)

# -----------------------------
# Utility functions (embeddings, chat, chroma)
# -----------------------------
def _call_ollama_embeddings(model_name: str, text: str, timeout: int = 30) -> Optional[List[float]]:
    """
    Call Ollama embeddings endpoint with several payload shapes and fallbacks.
    Returns embedding list or None.

    Tries candidate model strings:
      - model_name
      - model_name:latest (if not already tagged)

    Tries payload shapes in order:
      - {"model": model, "input": text}
      - {"model": model, "prompt": text}
      - {"model": model, "inputs": [text]}

    Parses response shapes:
      - {"embedding": [...]}
      - {"embeddings": [[...], ...]} -> first
      - {"data":[{"embedding":[...]}]}
      - top-level list -> first element if it's a list of numbers
    Treats empty arrays as failure to allow trying other fallbacks.
    """
    if not model_name or not text:
        return None

    candidate_models = []
    if ":" in model_name:
        candidate_models.append(model_name)
    else:
        candidate_models.append(model_name)
        candidate_models.append(f"{model_name}:latest")

    payload_variants = [
        ("input", lambda m, t: {"model": m, "input": t}),
        ("prompt", lambda m, t: {"model": m, "prompt": t}),
        ("inputs", lambda m, t: {"model": m, "inputs": [t]}),
    ]

    for cand in candidate_models:
        for field_name, payload_fn in payload_variants:
            payload = payload_fn(cand, text)
            try:
                r = requests.post(f"{OLLAMA_URL.rstrip('/')}/api/embeddings", json=payload, timeout=timeout)
            except Exception as e:
                logger.debug("HTTP error calling Ollama for model=%s field=%s: %s", cand, field_name, e)
                continue

            if r.status_code != 200:
                # log response text (shortened) for debugging
                logger.debug("Ollama non-200 response model=%s field=%s status=%s body=%s", cand, field_name, r.status_code, (r.text or "")[:800])
                continue

            try:
                data = r.json()
            except Exception as e:
                logger.debug("Failed to parse JSON from Ollama response model=%s field=%s: %s", cand, field_name, e)
                continue

            emb = None

            # shape: {"embedding": [...]}
            if isinstance(data, dict) and "embedding" in data and isinstance(data["embedding"], list):
                if len(data["embedding"]) > 0 and isinstance(data["embedding"][0], (int, float)):
                    emb = data["embedding"]
                else:
                    logger.debug("Ollama returned empty 'embedding' for model=%s field=%s", cand, field_name)

            # shape: {"embeddings": [...]}
            elif isinstance(data, dict) and "embeddings" in data and isinstance(data["embeddings"], list):
                if len(data["embeddings"]) == 0:
                    logger.debug("Ollama returned empty 'embeddings' list for model=%s field=%s", cand, field_name)
                else:
                    first = data["embeddings"][0]
                    if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
                        emb = first
                    elif all(isinstance(x, (int, float)) for x in data["embeddings"]):
                        emb = data["embeddings"]

            # shape: {"data":[{"embedding": [...]}]}
            elif isinstance(data, dict) and "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
                first = data["data"][0]
                if isinstance(first, dict) and "embedding" in first and isinstance(first["embedding"], list) and len(first["embedding"]) > 0:
                    emb = first["embedding"]
                elif isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
                    emb = first

            # shape: top-level list: [[...], ...] or [...]
            elif isinstance(data, list) and len(data) > 0:
                first = data[0]
                if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
                    emb = first
                elif all(isinstance(x, (int, float)) for x in data):
                    emb = data

            # final validation
            if emb and isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], (int, float)):
                logger.info("Ollama embedding success model=%s field=%s len=%d", cand, field_name, len(emb))
                return emb
            else:
                logger.debug("Ollama returned no usable embedding for model=%s field=%s response=%s", cand, field_name, json.dumps(data)[:800])

    logger.warning("Ollama embeddings: no embedding available from candidates: %s", candidate_models)
    return None

def get_embedding(text: str, model_name: Optional[str] = None, timeout_per_call: int = 20) -> Optional[List[float]]:
    """
    Get embedding with fallback strategy:
    1. Try OpenAI if configured and preferred/available.
    2. Fallback to Local (Ollama).
    """
    # Check if OpenAI is configured
    use_openai = False
    if OPENAI_API_KEY:
        # If model_name is passed and matches OpenAI model, use it
        if model_name == PRIMARY_EMBED:
            use_openai = True
        # If no model_name passed, default to OpenAI if configured
        elif not model_name:
            use_openai = True

    if use_openai:
        try:
            response = openai.embeddings.create(
                input=text,
                model=PRIMARY_EMBED
            )
            logger.info(f"Generated embedding using OpenAI {PRIMARY_EMBED}")
            return response.data[0].embedding
        except Exception as e:
            logger.warning(f"OpenAI embedding failed: {e}. Falling back to local.")
            # Fallback to local
    
    # Local Fallback
    local_model = model_name if (model_name and model_name != PRIMARY_EMBED) else LOCAL_EMBED_MODEL
    # If local_model is still None or empty, use the resolved one
    if not local_model:
        local_model = SELECTED_EMBED_MODEL

    return _call_ollama_embeddings(local_model, text, timeout=timeout_per_call)

def generate_chat_response(query: str, context: str = "", model_preference: Optional[Dict[str, Any]] = None) -> str:
    """Generate chat response using OpenAI or Ollama with fallback"""
    
    use_openai = False
    if OPENAI_API_KEY:
        if model_preference and model_preference.get('openai_available'):
            use_openai = True
        elif not model_preference: # Default to OpenAI if no preference but key exists
             use_openai = True

    if use_openai:
        try:
            messages = [
                {"role": "system", "content": "You are a helpful AI assistant for a privacy-aware document search system."},
                {"role": "user", "content": f"Context from documents:\n{context}\n\nUser question: {query}\n\nPlease provide a helpful and accurate response based on the context provided."}
            ]
            
            response = openai.chat.completions.create(
                model=PRIMARY_MODEL,
                messages=messages,
                temperature=0.7
            )
            logger.info(f"Generated chat response using OpenAI {PRIMARY_MODEL}")
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI chat failed: {e}. Falling back to local.")
            # Fallback to local
    
    # Local Fallback
    try:
        prompt = f"""You are a helpful AI assistant for a privacy-aware document search system.

Context from documents:
{context}

User question: {query}

Please provide a helpful and accurate response based on the context provided. If the context doesn't contain relevant information, say so politely."""

        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": LOCAL_CHAT_MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=180  # Increased timeout for initial model loading
        )
        response.raise_for_status()
        # Many Ollama responses contain structured data — try multiple shapes
        j = response.json()
        if isinstance(j, dict):
            # first check for 'response' key
            if "response" in j and isinstance(j["response"], str):
                return j["response"]
            # some versions return 'output' or similar
            if "output" in j and isinstance(j["output"], str):
                return j["output"]
            # if 'choices' like OpenAI, try to extract text
            if "choices" in j and isinstance(j["choices"], list) and j["choices"]:
                c = j["choices"][0]
                if isinstance(c, dict) and "message" in c and isinstance(c["message"], str):
                    return c["message"]
        return json.dumps(j)  # fallback: return raw json as string
    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        return "I'm sorry, I encountered an error generating a response."

def chromadb_add(ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[Dict] = None, collection=None):
    """Add documents to ChromaDB using Python client"""
    target_collection = collection or chroma_collection
    target_collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

def chromadb_query(query_embeddings: List[List[float]], n_results: int = TOP_K, collection=None):
    """Query ChromaDB for most relevant documents using Python client"""
    target_collection = collection or chroma_collection
    results = target_collection.query(
        query_embeddings=query_embeddings,
        n_results=n_results
    )
    return results

# -----------------------------
# Ensure database tables (documents, processing_jobs, audit_logs)
# -----------------------------
def ensure_database_tables():
    """Create database tables if they don't exist"""
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            # Documents table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id SERIAL PRIMARY KEY,
                    file_key TEXT NOT NULL UNIQUE,
                    filename TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    content_preview TEXT,
                    uploaded_by INTEGER,
                    department TEXT,
                    sensitivity TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    processed_at TIMESTAMP
                );
            """)

            # Processing jobs table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS processing_jobs (
                    id SERIAL PRIMARY KEY,
                    job_data TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW(),
                    processed_at TIMESTAMP
                );
            """)

            # Audit logs table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action VARCHAR(100) NOT NULL,
                    resource_type VARCHAR(50),
                    resource_id INTEGER,
                    details JSONB,
                    ip_address INET,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)

            conn.commit()
            logger.info("Database tables ensured")
    except Exception as e:
        logger.exception("Failed to ensure database tables: %s", e)
        # If DB creation fails, bubble up so startup can handle it (or worker will keep retrying)
        raise
    finally:
        if conn:
            put_conn(conn)

# -----------------------------
# MinIO operations (robust endpoint normalization)
# -----------------------------
from urllib.parse import urlparse

def _normalize_minio_endpoint(raw_endpoint: str, raw_port: Optional[int]):
    """
    Normalize MINIO_ENDPOINT or MINIO_HOST + MINIO_PORT into (endpoint_hostport, secure_bool)
    Accepts:
      - raw_endpoint like "minio:9000" or "http://minio:9000" or "https://minio:9000/anypath"
      - raw_port as integer (optional)
    Returns:
      - endpoint (str) in form "host:port" or "host"
      - secure (bool) indicating if TLS (https) should be used
    Raises ValueError if it cannot normalize.
    """
    if not raw_endpoint and not raw_port:
        raise ValueError("MINIO_ENDPOINT or MINIO_PORT (with host) must be set")

    endpoint = (raw_endpoint or "").strip()

    # If endpoint starts with scheme, parse it
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        host = parsed.hostname
        port = parsed.port
        secure = parsed.scheme == "https"
        if not host:
            raise ValueError(f"Could not parse host from MINIO_ENDPOINT='{raw_endpoint}'")
        if port:
            return f"{host}:{port}", secure
        return host, secure

    # If endpoint contains a slash (but no scheme), try to prefix http:// then parse
    if "/" in endpoint and not endpoint.startswith("http"):
        try:
            parsed = urlparse("http://" + endpoint)
            host = parsed.hostname
            port = parsed.port
            secure = False
            if not host:
                raise ValueError(f"Could not parse host from MINIO_ENDPOINT='{raw_endpoint}'")
            if port:
                return f"{host}:{port}", secure
            return host, secure
        except Exception:
            pass

    # If endpoint looks like host:port
    if ":" in endpoint and not endpoint.startswith(":"):
        parts = endpoint.split(":")
        host = parts[0]
        port_part = parts[1] if len(parts) > 1 else None
        if port_part:
            return f"{host}:{port_part}", False
        return host, False

    # if no port in endpoint but raw_port provided, combine
    if endpoint and raw_port:
        return f"{endpoint}:{raw_port}", False

    # fallback: single hostname (no port)
    if endpoint:
        return endpoint, False

    raise ValueError(f"Could not normalize MINIO_ENDPOINT='{raw_endpoint}' with port='{raw_port}'")


def get_minio_client(retries=10, delay=3):
    """
    Create and return a Minio client.
    Accepts MINIO_ENDPOINT (with or without scheme), or MINIO_PORT with MINIO_ENDPOINT/host.
    Uses MINIO_ACCESS_KEY / MINIO_SECRET_KEY (falls back to MINIO_ROOT_USER / MINIO_ROOT_PASSWORD).
    """
    raw_endpoint = os.getenv("MINIO_ENDPOINT", "")    # expected like "minio:9000" or "http://minio:9000"
    raw_port_env = os.getenv("MINIO_PORT", "")
    raw_port = int(raw_port_env) if raw_port_env and raw_port_env.isdigit() else None

    access_key = os.getenv("MINIO_ACCESS_KEY") or os.getenv("MINIO_ROOT_USER")
    secret_key = os.getenv("MINIO_SECRET_KEY") or os.getenv("MINIO_ROOT_PASSWORD")
    bucket = os.getenv("MINIO_BUCKET", MINIO_BUCKET)

    if not access_key or not secret_key:
        raise RuntimeError("Missing MinIO credentials: set MINIO_ACCESS_KEY and MINIO_SECRET_KEY (or MINIO_ROOT_USER/MINIO_ROOT_PASSWORD)")

    # Normalize endpoint and secure flag
    endpoint_hostport, secure = _normalize_minio_endpoint(raw_endpoint, raw_port)

    # allow override to force insecure mode (dev)
    insecure_override = os.getenv("MINIO_INSECURE", "").lower() in ("1", "true", "yes")
    if insecure_override:
        secure = False

    last_err = None
    for attempt in range(retries):
        try:
            client = Minio(
                endpoint_hostport,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure
            )
            # test and create bucket if needed
            if client.bucket_exists(bucket):
                return client
            else:
                client.make_bucket(bucket)
                return client
        except Exception as e:
            last_err = e
            logger.warning("MinIO connection attempt %d failed: %s", attempt + 1, e)
            if attempt == retries - 1:
                # raise a clearer error
                raise RuntimeError(f"Failed to create Minio client for endpoint '{endpoint_hostport}' (secure={secure}): {e}") from e
            time.sleep(delay)


# -----------------------------
# Document processing
# -----------------------------
def extract_text_from_file(file_path: str) -> str:
    """Extract text from various file formats"""
    try:
        if file_path.lower().endswith('.pdf'):
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        else:
            # Handle text files
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}")
        return ""

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks using RecursiveCharacterTextSplitter"""
    if not text:
        return []

    try:
        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            encoding_name="cl100k_base" # OpenAI encoding
        )
        return text_splitter.split_text(text)
    except Exception as e:
        logger.warning(f"Advanced chunking failed: {e}. Falling back to simple splitter.")
        # Fallback to simple splitter
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size * 4, len(text)) # Approx char count
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= len(text):
                break
            start = max(start + chunk_size * 4 - overlap * 4, start + 1)
        return chunks

def process_document_job(job_data: Dict[str, Any]):
    """Process a document job (file or web)"""
    job_type = job_data.get("type", "file")
    file_key = job_data.get("key")
    
    text_content = ""
    source_info = ""

    try:
        if job_type == "web":
            url = job_data.get("url")
            if not url:
                logger.error("No URL provided for web ingestion")
                return
            result = scraper.scrape_url(url)
            if result["status"] == "failed":
                logger.error(f"Web scraping failed: {result.get('error')}")
                return
            text_content = result["content"]
            source_info = url
            # Use URL as file_key for tracking if not present
            if not file_key:
                file_key = url

        elif job_type.startswith("dummy_"):
            try:
                result = scraper.scrape_dummy_site(job_type)
                if result["status"] == "failed":
                    logger.error(f"Dummy scraping failed: {result.get('error')}")
                    return
                text_content = result["content"]
                source_info = result["url"]
                if not file_key:
                    file_key = f"{job_type}_{int(time.time())}"
            except ValueError as e:
                logger.error(str(e))
                return

        else: # Default to file
            if not file_key:
                logger.error("No file key in job data")
                return

            temp_file_path = f"/tmp/{os.path.basename(file_key)}"
            
            try:
                # Download file from MinIO
                minio_client.fget_object(MINIO_BUCKET, file_key, temp_file_path)
                logger.info(f"Downloaded {file_key} for processing")

                # Extract text
                text_content = extract_text_from_file(temp_file_path)
                source_info = file_key
                
                # Clean up temp file immediately after extraction
                try:
                    os.remove(temp_file_path)
                except:
                    pass
            except Exception as e:
                # Fallback: check if metadata exists in DB (for CSV rows that are metadata-only)
                logger.warning(f"MinIO download failed for {file_key}: {e}. Checking DB metadata...")
                try:
                    # Try to use document_id if available for faster lookup
                    doc_id = job_data.get("document_id")
                    conn = get_conn()
                    with conn.cursor() as cur:
                        if doc_id:
                            cur.execute("SELECT metadata, filename FROM documents WHERE id = %s", (doc_id,))
                        else:
                            cur.execute("SELECT metadata, filename FROM documents WHERE file_key = %s", (file_key,))
                        
                        row = cur.fetchone()
                        
                        if row and row[0]:
                            metadata = row[0]
                            filename = row[1]
                            logger.info(f"Found metadata for {file_key}, reconstructing content")
                            
                            if isinstance(metadata, str):
                                import json
                                metadata_dict = json.loads(metadata)
                            else:
                                metadata_dict = metadata
                            
                            # Construct meaningful text from metadata
                            text_parts = [f"{k}: {v}" for k, v in metadata_dict.items() if v and k not in ['record_type', 'source', 'row_index']]
                            text_content = " | ".join(text_parts)
                            if not text_content:
                                text_content = f"Document entry for {filename}"
                            source_info = f"DB Metadata: {filename}"
                        else:
                            logger.error(f"No metadata found for {file_key}, cannot recover")
                            return
                except Exception as db_e:
                    logger.error(f"Failed to fetch metadata fallback: {db_e}")
                    # If we can't get metadata, we can't process
                    return
                finally:
                    if conn:
                        put_conn(conn)

        if not text_content:
            logger.warning(f"No text extracted from {source_info}")
            return

        # Split into chunks
        chunks = chunk_text(text_content)
        logger.info(f"Split {file_key} into {len(chunks)} chunks")

        # Process chunks in batches
        batch_size = 10
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i + batch_size]
            batch_ids = [str(uuid.uuid4()) for _ in batch_chunks]
            batch_embeddings = []

            # Get embeddings for batch
            for chunk in batch_chunks:
                embedding = get_embedding(chunk)
                if embedding:
                    batch_embeddings.append(embedding)
                else:
                    raise Exception(f"Failed to get embedding for chunk from {file_key}")

            # Store in ChromaDB if we have embeddings
            if batch_embeddings and len(batch_embeddings) == len(batch_chunks):
                try:
                    # Get organization-specific collection
                    org_name = job_data.get("organization", "default")
                    org_id = job_data.get("org_id")
                    org_collection = get_org_collection(org_id=org_id, org_name=org_name)
                    
                    # Prepare metadata
                    metadatas = []
                    for _ in batch_chunks:
                        metadatas.append({
                            "org_id": str(org_id) if org_id else "",
                            "organization": org_name,
                            "department": job_data.get("department", ""),
                            "user_category": job_data.get("user_category", ""),
                            "document_id": str(job_data.get("document_id", "")),
                            "filename": job_data.get("filename", "")
                        })

                    chromadb_add(batch_ids[:len(batch_embeddings)],
                                 batch_chunks[:len(batch_embeddings)],
                                 batch_embeddings,
                                 metadatas=metadatas,
                                 collection=org_collection)
                    logger.info(f"Stored batch of {len(batch_embeddings)} chunks from {file_key} in org='{org_name}' (id={org_id})")
                except Exception as e:
                    logger.error(f"Failed to store batch in ChromaDB: {e}")

        # Update database - use pooled connection safely
        conn = None
        try:
            conn = get_conn()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE documents SET status = 'processed', processed_at = NOW(), content_preview = %s WHERE file_key = %s",
                    (text_content[:500], file_key)
                )
            conn.commit()
        except Exception as e:
            logger.exception(f"Failed to update document status for {file_key}: {e}")
        finally:
            if conn:
                put_conn(conn)

        logger.info(f"Successfully processed {file_key}")

    except Exception as e:
        logger.error(f"Error processing {file_key}: {e}")
    finally:
        # Clean up temp file
        try:
            os.remove(temp_file_path)
        except:
            pass

# -----------------------------
# Background worker
# -----------------------------
def background_worker():
    """Background worker to process jobs from Redis queue"""
    # ensure DB tables exist
    try:
        ensure_database_tables()
    except Exception as e:
        logger.exception("ensure_database_tables failed at worker start: %s", e)

    redis_client = redis.from_url(REDIS_URL)

    logger.info("Background worker started")

    while True:
        try:
            # Wait for job from Redis queue
            result = redis_client.brpop("document_jobs", timeout=10)
            if not result:
                continue

            _, job_data_raw = result
            job_data_str = job_data_raw.decode() if isinstance(job_data_raw, bytes) else str(job_data_raw)

            try:
                job_data = json.loads(job_data_str)
            except json.JSONDecodeError:
                job_data = {"key": job_data_str}

            logger.info(f"Processing job: {job_data}")
            process_document_job(job_data)

        except Exception as e:
            logger.error(f"Worker error: {e}")
            time.sleep(5)

def start_background_worker():
    """Start background worker threads"""
    # Start 4 concurrent workers to speed up processing
    for i in range(4):
        logger.info(f"Starting background worker thread {i+1}")
        worker_thread = Thread(target=background_worker, daemon=True)
        worker_thread.start()

# -----------------------------
# API Endpoints
# -----------------------------
@app.get("/health")
def health_check():
    """Health check endpoint"""
    checks = {
        "ollama": False,
        "chromadb": True,
        "postgres": False,
        "redis": False,
        "minio": False
    }

    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        checks["ollama"] = response.status_code == 200
    except Exception:
        checks["ollama"] = False

    try:
        # Check DB by acquiring a pooled connection briefly
        conn = None
        try:
            conn = get_conn()
            checks["postgres"] = True
        except Exception:
            checks["postgres"] = False
        finally:
            if conn:
                put_conn(conn)
    except Exception:
        checks["postgres"] = False

    try:
        redis_client = redis.from_url(REDIS_URL)
        checks["redis"] = redis_client.ping()
    except Exception:
        checks["redis"] = False

    try:
        minio_client.bucket_exists(MINIO_BUCKET)
        checks["minio"] = True
    except Exception:
        checks["minio"] = False

    status = "healthy" if all(checks.values()) else "degraded"
    return {"status": status, "checks": checks, "timestamp": datetime.now().isoformat()}

@app.post("/embed")
def embed_text(request: EmbedRequest):
    """Embed text and store in ChromaDB via Python client"""
    try:
        embedding = get_embedding(request.text)
        if not embedding:
            raise HTTPException(status_code=500, detail="Failed to generate embedding")

        doc_id = request.id or str(uuid.uuid4())
        chromadb_add([doc_id], [request.text], [embedding])

        return {
            "id": doc_id,
            "embedding": embedding,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search")
def search_documents(request: SearchRequest):
    """Search for similar documents using ChromaDB client and record audit logs"""
    user = {}  # default empty user if caller didn't provide user context
    # In your real flow, the API gateway populates user info in payload.
    # If you forward user object from api -> worker, use it. Here we check request context.
    # For compatibility, attempt to read a 'user' field if present in request (if using raw dict).
    try:
        # Redact and hash query for audit
        raw_query = request.query or ""
        query_redacted = redact_text(raw_query)
        query_hash = hash_query(raw_query)

        # Generate embedding
        query_embedding = get_embedding(raw_query)
        if not query_embedding:
            # audit with error and return failure
            details = {
                "query_hash": query_hash,
                "query_redacted": query_redacted,
                "error": "Failed to generate query embedding",
                "result_count": 0,
                "document_ids": []
            }
            try:
                insert_audit_log(user.get("id"), "search", "document", None, details)
            except Exception:
                pass
            raise HTTPException(status_code=500, detail="Failed to generate query embedding")


        # Query ChromaDB
        logger.info(f"SEARCH DEBUG: org_id={request.org_id} org_name={request.organization} query='{request.query}' top_k={request.top_k}")
        org_collection = get_org_collection(org_id=request.org_id, org_name=request.organization)
        results = chromadb_query([query_embedding], request.top_k, collection=org_collection)
        documents = []
        doc_ids = []
        if results and results.get("documents") and results["documents"][0]:
            for (doc_text, doc_id, distance) in zip(
                results["documents"][0],
                results["ids"][0],
                results["distances"][0]
            ):
                # ChromaDB returns L2 (Euclidean) distance, not similarity
                # Lower distance = higher similarity
                # Convert to a similarity score (higher is better)
                score = 1.0 / (1.0 + distance)  # Ranges from 0 to 1
                documents.append(DocumentChunk(id=doc_id, text=doc_text, score=score))
                doc_ids.append(doc_id)

        # NOTE: you should apply document-level access filtering here (use your ABAC logic)
        # For now we assume the caller has already passed allowed docs, or ABAC is enforced before worker.
        filtered = documents  # keep as-is; replace with filtering if you implement it

        # Build audit details
        details = {
            "query_hash": query_hash,
            "query_redacted": query_redacted,
            "result_count": len(filtered),
            "document_ids": doc_ids
        }

        # Insert audit log (best-effort)
        try:
            insert_audit_log(user.get("id"), "search", "document", None, details)
        except Exception as e:
            logger.exception("Audit insert failed: %s", e)

        return {
            "query": raw_query,
            "query_redacted": query_redacted,  # Privacy: redacted query for display
            "query_hash": query_hash,  # Privacy: hashed query for audit reference
            "results": filtered,
            "total_found": len(filtered)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Search error: %s", e)
        # attempt best-effort audit
        try:
            insert_audit_log(user.get("id"), "search", "document", None, {
                "query_hash": hash_query(request.query if hasattr(request, 'query') else ""),
                "query_redacted": redact_text(request.query if hasattr(request, 'query') else ""),
                "error": str(e),
                "result_count": 0,
                "document_ids": []
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_with_documents(req: Request):
    """
    Robust chat endpoint:
    - Accepts JSON bodies with keys: query OR message OR prompt (case-sensitive).
    - Accepts an optional 'context' key.
    - Logs the raw body for debugging and returns clear 400/500 messages.
    """
    try:
        # Try to parse JSON body (FastAPI Request.json is tolerant)
        try:
            body = await req.json()
        except Exception as e:
            # Log for diagnostics and return a 400 with clear message
            logger.warning("Chat endpoint: failed to parse JSON body: %s", e)
            raise HTTPException(status_code=400, detail="Invalid JSON body for /chat")

        # Log raw body (safe: avoid logging secrets). Useful until issue resolved.
        logger.info("CHAT /chat received raw body keys: %s", list(body.keys()) if isinstance(body, dict) else str(body)[:200])

        # Accept multiple common property names
        query = None
        if isinstance(body, dict):
            query = body.get("query") or body.get("message") or body.get("prompt") or None
            context = body.get("context", None)
        else:
            query = None
            context = None

        if not query or not isinstance(query, str) or not query.strip():
            # Differentiate missing vs malformed
            raise HTTPException(status_code=400, detail="Missing required 'query' (also accepts 'message' or 'prompt'). The request body must be JSON.")

        query = query.strip()

        # Build context if not provided using your search_documents function
        if not context:
            try:
                # use your existing SearchRequest and search_documents logic
                sr = SearchRequest(query=query, top_k=3)
                search_results = search_documents(sr)
                # search_documents returns {"results": [...]} or returns DocumentChunk objects depending on your version
                contexts = []
                # handle both shaped result (dict) and direct list
                if isinstance(search_results, dict) and "results" in search_results:
                    for r in search_results["results"]:
                        # r might be a DocumentChunk or a dict
                        if hasattr(r, "text"):
                            contexts.append(r.text)
                        elif isinstance(r, dict):
                            contexts.append(r.get("text", ""))
                elif isinstance(search_results, list):
                    for r in search_results:
                        if hasattr(r, "text"):
                            contexts.append(r.text)
                        elif isinstance(r, dict):
                            contexts.append(r.get("text", ""))
                context = "\n\n".join([c for c in contexts if c])
            except HTTPException as he:
                logger.warning("Chat: search for context returned HTTPException: %s", he.detail)
                context = ""
            except Exception as e:
                logger.exception("Chat: unexpected error while building context: %s", e)
                context = ""

        # Generate response using existing generate_chat_response
        response_text = generate_chat_response(query, context or "")

        return {
            "query": query,
            "response": response_text,
            "context_used": bool(context),
            "status": "success"
        }

    except HTTPException:
        # re-raise to let FastAPI send the right HTTP status & detail
        raise
    except Exception as e:
        logger.exception("Chat endpoint unexpected error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error in /chat")

# -----------------------------
# Startup
# -----------------------------
@app.on_event("startup")
def startup():
    global minio_client
    logger.info("Privacy-Aware RAG Worker starting...")

    # initialize the DB pool
    init_db_pool()

    # ensure DB tables exist
    try:
        ensure_database_tables()
    except Exception as e:
        # If DB isn't ready yet, log and continue; background_worker will also call ensure_database_tables()
        logger.exception("ensure_database_tables failed during startup: %s", e)

    minio_client = get_minio_client()
    start_background_worker()

    # Log which embed models were configured
    logger.info("Configured Ollama embed models (in preference order): %s", OLLAMA_EMBED_MODELS)
    logger.info("Worker service initialized successfully")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)





# #!/usr/bin/env python3

# import os
# import time
# import json
# import uuid
# import asyncio
# import logging
# import re
# import hashlib
# from typing import List, Optional, Dict, Any
# from datetime import datetime
# from concurrent.futures import ThreadPoolExecutor, as_completed

# import psycopg2
# from psycopg2.extras import Json as PGJson
# from psycopg2.pool import SimpleConnectionPool
# import redis
# import requests
# from minio import Minio
# from pypdf import PdfReader
# from threading import Thread
# import chromadb

# from fastapi import FastAPI, HTTPException, BackgroundTasks, Request  # <-- added Request import
# from pydantic import BaseModel
# import uvicorn

# # Configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # -----------------------------
# # Configuration
# # -----------------------------
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_rag_db")
# REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
# MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio")
# MINIO_PORT = int(os.getenv("MINIO_PORT", 9000))
# MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "admin")
# MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "secure_password")
# MINIO_BUCKET = os.getenv("MINIO_BUCKET", "privacy-documents")

# OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
# OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
# # Accept comma-separated list of embedding models
# OLLAMA_EMBED_MODELS_RAW = os.getenv("OLLAMA_EMBED_MODEL", "mxbai-embed-large")
# # parse into list, strip whitespace and ignore empties
# OLLAMA_EMBED_MODELS = [m.strip() for m in OLLAMA_EMBED_MODELS_RAW.split(",") if m.strip()]

# CHROMADB_HOST = os.getenv("CHROMADB_HOST", "chromadb")
# CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", 8000))
# CHROMADB_COLLECTION = os.getenv("CHROMADB_COLLECTION", "privacy_documents")

# TOP_K = int(os.getenv("TOP_K", 5))
# QUERY_HASH_SALT = os.getenv("QUERY_HASH_SALT", "change_me_query_salt")

# # DB pool settings
# DB_MIN_CONN = int(os.getenv("DB_MIN_CONN", 1))
# DB_MAX_CONN = int(os.getenv("DB_MAX_CONN", 6))

# # -----------------------------
# # Ollama embed model resolver (minimal, non-invasive)
# # -----------------------------
# def _parse_env_model_list(raw_list: Optional[str]) -> List[str]:
#     """Return deduplicated list preserving order from env string"""
#     if not raw_list:
#         return []
#     parts = []
#     for p in [x.strip() for x in raw_list.replace(";", ",").split(",")]:
#         if p and p not in parts:
#             parts.append(p)
#     return parts

# def _query_ollama_available_models(ollama_url: str) -> Optional[set]:
#     """
#     Try to query Ollama for available models. Returns a set of model 'names' (without tags)
#     or None if unable to query.
#     """
#     try:
#         endpoints = ["/api/tags", "/api/models"]
#         for path in endpoints:
#             try:
#                 r = requests.get(f"{ollama_url.rstrip('/')}{path}", timeout=4)
#                 if r.status_code != 200:
#                     continue
#                 j = r.json()
#                 names = set()
#                 # different Ollama versions return different shapes
#                 if isinstance(j, dict) and "models" in j and isinstance(j["models"], list):
#                     models = j["models"]
#                 elif isinstance(j, list):
#                     models = j
#                 elif isinstance(j, dict):
#                     # sometimes tags endpoint returns {'tags':[...]} or similar
#                     models = j.get("models") or j.get("tags") or []
#                 else:
#                     models = []
#                 for m in models:
#                     if isinstance(m, dict):
#                         name = m.get("name") or m.get("model")
#                     else:
#                         name = m
#                     if name:
#                         # strip possible :latest suffix for matching
#                         names.add(str(name).split(":")[0])
#                 if names:
#                     return names
#             except Exception:
#                 continue
#     except Exception:
#         pass
#     return None

# def resolve_single_embed_model(ollama_url: str, env_raw: Optional[str]) -> str:
#     """
#     Resolve a single embed model to use:
#       - prefer the first candidate from env that Ollama reports as available
#       - try a short embedding test call at startup to ensure the chosen model actually returns a non-empty embedding
#       - if can't query Ollama, return the first env candidate
#       - fallback to common defaults if env candidates not present
#     """
#     candidates = _parse_env_model_list(env_raw)
#     if not candidates:
#         logger.info("No embed-model env found; defaulting to ['nomic-embed-text']")
#         return "nomic-embed-text"

#     available = _query_ollama_available_models(ollama_url)
#     if available is None:
#         logger.warning("Could not query Ollama at %s; using first env candidate: %s", ollama_url, candidates[0])
#         return candidates[0]

#     # Filter env candidates by availability (match prefix)
#     matched_candidates = []
#     for c in candidates:
#         if c in available or any(a.startswith(c) for a in available):
#             matched_candidates.append(c)

#     # If we have matched candidates, prefer to pick one that passes a quick embedding test
#     test_text = "hello from startup"
#     def test_model_returns_embedding(model_name: str) -> bool:
#         # Try both plain name and :latest tag variants
#         variants = [model_name]
#         if ":" not in model_name:
#             variants.append(f"{model_name}:latest")
#         for v in variants:
#             try:
#                 resp = requests.post(f"{ollama_url.rstrip('/')}/api/embeddings", json={"model": v, "input": test_text}, timeout=6)
#                 if resp.status_code != 200:
#                     continue
#                 j = resp.json()
#                 # check common shapes
#                 emb = None
#                 if isinstance(j, dict) and "embedding" in j:
#                     if isinstance(j["embedding"], list) and len(j["embedding"]) > 0 and isinstance(j["embedding"][0], (int, float)):
#                         emb = j["embedding"]
#                 elif isinstance(j, dict) and "embeddings" in j:
#                     if isinstance(j["embeddings"], list) and len(j["embeddings"]) > 0:
#                         first = j["embeddings"][0]
#                         if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
#                             emb = first
#                 elif isinstance(j, dict) and "data" in j and isinstance(j["data"], list) and len(j["data"]) > 0:
#                     first = j["data"][0]
#                     if isinstance(first, dict) and "embedding" in first and isinstance(first["embedding"], list) and len(first["embedding"]) > 0:
#                         emb = first["embedding"]
#                 elif isinstance(j, list) and len(j) > 0:
#                     first = j[0]
#                     if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
#                         emb = first
#                     elif all(isinstance(x, (int, float)) for x in j):
#                         emb = j

#                 if emb and isinstance(emb, list) and len(emb) > 0:
#                     logger.info("Embed test succeeded for model variant '%s' (len=%d)", v, len(emb))
#                     return True
#             except Exception as e:
#                 logger.debug("Embed test failed for %s: %s", v, e)
#                 continue
#         return False

#     # Try matched candidates first (in order)
#     for c in matched_candidates:
#         if test_model_returns_embedding(c):
#             logger.info("Resolved embed model from env candidates (tested OK): %s", c)
#             return c

#     # If no matched candidate passed the test, try preferred fallbacks among available models
#     preferred = ["nomic-embed-text", "mxbai-embed-large"]
#     for p in preferred:
#         if p in available:
#             if test_model_returns_embedding(p):
#                 logger.warning("Selecting preferred available model (tested OK): %s", p)
#                 return p

#     # If no test succeeded, but matched candidates exist, return first matched candidate (best-effort)
#     if matched_candidates:
#         logger.warning("No embed test passed; falling back to first matched env candidate: %s", matched_candidates[0])
#         return matched_candidates[0]

#     # If still nothing, pick first available preferred or any available
#     for p in preferred:
#         if p in available:
#             logger.warning("Env candidates not found; selecting available preferred model: %s", p)
#             return p

#     pick = sorted(list(available))[0]
#     logger.warning("Falling back to available Ollama model: %s", pick)
#     return pick

# # Enforce a single embed model to avoid mixed vector dimensions being written to one Chroma collection
# SELECTED_EMBED_MODEL = resolve_single_embed_model(OLLAMA_URL, OLLAMA_EMBED_MODELS_RAW)
# OLLAMA_EMBED_MODELS = [SELECTED_EMBED_MODEL]
# logger.info("Configured Ollama embed model (enforced single): %s", SELECTED_EMBED_MODEL)

# # -----------------------------
# # FastAPI app
# # -----------------------------
# app = FastAPI(title="Privacy-Aware RAG Worker", version="1.0.0")

# # -----------------------------
# # ChromaDB client
# # -----------------------------
# # Note: chromadb client usage depends on installed client version; adapt if required.
# chroma_client = chromadb.HttpClient(host=CHROMADB_HOST, port=CHROMADB_PORT)
# chroma_collection = chroma_client.get_or_create_collection(name=CHROMADB_COLLECTION)

# # -----------------------------
# # Pydantic models
# # -----------------------------
# class EmbedRequest(BaseModel):
#     id: Optional[str] = None
#     text: str

# class SearchRequest(BaseModel):
#     query: str
#     top_k: Optional[int] = TOP_K

# class ChatRequest(BaseModel):
#     # Keep the model for compatibility, but make query optional so FastAPI/Pydantic doesn't auto-422.
#     query: Optional[str] = None
#     context: Optional[str] = None

# class DocumentChunk(BaseModel):
#     id: str
#     text: str
#     score: float

# # -----------------------------
# # Privacy helpers (redaction + hashing)
# # -----------------------------
# EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
# PHONE_RE = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){6,14}\b')
# SSN_RE = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

# PII_PATTERNS = [EMAIL_RE, PHONE_RE, SSN_RE]

# def redact_text(text: str, replacement='[REDACTED]') -> str:
#     if not text:
#         return text
#     out = text
#     for p in PII_PATTERNS:
#         out = p.sub(replacement, out)
#     return out

# def hash_query(text: str) -> str:
#     salt = QUERY_HASH_SALT or "change_me_query_salt"
#     h = hashlib.sha256()
#     h.update((salt + (text or '')).encode('utf-8'))
#     return h.hexdigest()

# # -----------------------------
# # DB / Audit helpers (pool-based)
# # -----------------------------
# db_pool: Optional[SimpleConnectionPool] = None

# def init_db_pool():
#     """Initialize the psycopg2 SimpleConnectionPool."""
#     global db_pool
#     if db_pool:
#         return db_pool
#     try:
#         # psycopg2.connect accepts a DSN or connection string
#         db_pool = SimpleConnectionPool(
#             DB_MIN_CONN,
#             DB_MAX_CONN,
#             dsn=DATABASE_URL
#         )
#         logger.info("Initialized DB connection pool (min=%d max=%d)", DB_MIN_CONN, DB_MAX_CONN)
#     except Exception as e:
#         logger.exception("Failed to initialize DB pool: %s", e)
#         db_pool = None
#     return db_pool

# def get_conn(timeout=5):
#     """Get a connection from the pool; raise HTTPException if unavailable."""
#     global db_pool
#     if not db_pool:
#         init_db_pool()
#     if not db_pool:
#         raise RuntimeError("DB pool not available")
#     try:
#         return db_pool.getconn()
#     except Exception as e:
#         logger.exception("Failed to acquire DB connection from pool: %s", e)
#         raise

# def put_conn(conn):
#     """Return a connection to the pool (if pool exists)."""
#     global db_pool
#     try:
#         if db_pool and conn:
#             db_pool.putconn(conn)
#     except Exception as e:
#         logger.exception("Failed to return DB connection to pool: %s", e)

# def close_db_pool():
#     global db_pool
#     try:
#         if db_pool:
#             db_pool.closeall()
#             db_pool = None
#             logger.info("Closed DB pool")
#     except Exception as e:
#         logger.exception("Error closing DB pool: %s", e)

# def insert_audit_log(user_id, action, resource_type, resource_id, details, ip_address=None, user_agent=None):
#     """
#     Insert an audit log into audit_logs table.
#     details should be a JSON-serializable dict (will be stored as jsonb).
#     Uses pooled connections.
#     """
#     conn = None
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             cur.execute("""
#                 INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
#                 VALUES (%s, %s, %s, %s, %s, %s, %s)
#                 RETURNING id;
#             """, (user_id, action, resource_type, resource_id, PGJson(details), ip_address, user_agent))
#             row = cur.fetchone()
#             conn.commit()
#             return row[0] if row else None
#     except Exception as e:
#         logger.exception("Failed to insert audit log: %s", e)
#         # don't propagate to callers (best-effort audit)
#         return None
#     finally:
#         if conn:
#             put_conn(conn)

# # -----------------------------
# # Utility functions (embeddings, chat, chroma)
# # -----------------------------
# def _call_ollama_embeddings(model_name: str, text: str, timeout: int = 30) -> Optional[List[float]]:
#     """
#     Call Ollama embeddings endpoint with several payload shapes and fallbacks.
#     Returns embedding list or None.

#     Tries candidate model strings:
#       - model_name
#       - model_name:latest (if not already tagged)

#     Tries payload shapes in order:
#       - {"model": model, "input": text}
#       - {"model": model, "prompt": text}
#       - {"model": model, "inputs": [text]}

#     Parses response shapes:
#       - {"embedding": [...]}
#       - {"embeddings": [[...], ...]} -> first
#       - {"data":[{"embedding":[...]}]}
#       - top-level list -> first element if it's a list of numbers
#     Treats empty arrays as failure to allow trying other fallbacks.
#     """
#     if not model_name or not text:
#         return None

#     candidate_models = []
#     if ":" in model_name:
#         candidate_models.append(model_name)
#     else:
#         candidate_models.append(model_name)
#         candidate_models.append(f"{model_name}:latest")

#     payload_variants = [
#         ("input", lambda m, t: {"model": m, "input": t}),
#         ("prompt", lambda m, t: {"model": m, "prompt": t}),
#         ("inputs", lambda m, t: {"model": m, "inputs": [t]}),
#     ]

#     for cand in candidate_models:
#         for field_name, payload_fn in payload_variants:
#             payload = payload_fn(cand, text)
#             try:
#                 r = requests.post(f"{OLLAMA_URL.rstrip('/')}/api/embeddings", json=payload, timeout=timeout)
#             except Exception as e:
#                 logger.debug("HTTP error calling Ollama for model=%s field=%s: %s", cand, field_name, e)
#                 continue

#             if r.status_code != 200:
#                 # log response text (shortened) for debugging
#                 logger.debug("Ollama non-200 response model=%s field=%s status=%s body=%s", cand, field_name, r.status_code, (r.text or "")[:800])
#                 continue

#             try:
#                 data = r.json()
#             except Exception as e:
#                 logger.debug("Failed to parse JSON from Ollama response model=%s field=%s: %s", cand, field_name, e)
#                 continue

#             emb = None

#             # shape: {"embedding": [...]}
#             if isinstance(data, dict) and "embedding" in data and isinstance(data["embedding"], list):
#                 if len(data["embedding"]) > 0 and isinstance(data["embedding"][0], (int, float)):
#                     emb = data["embedding"]
#                 else:
#                     logger.debug("Ollama returned empty 'embedding' for model=%s field=%s", cand, field_name)

#             # shape: {"embeddings": [...]}
#             elif isinstance(data, dict) and "embeddings" in data and isinstance(data["embeddings"], list):
#                 if len(data["embeddings"]) == 0:
#                     logger.debug("Ollama returned empty 'embeddings' list for model=%s field=%s", cand, field_name)
#                 else:
#                     first = data["embeddings"][0]
#                     if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
#                         emb = first
#                     elif all(isinstance(x, (int, float)) for x in data["embeddings"]):
#                         emb = data["embeddings"]

#             # shape: {"data":[{"embedding": [...]}]}
#             elif isinstance(data, dict) and "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
#                 first = data["data"][0]
#                 if isinstance(first, dict) and "embedding" in first and isinstance(first["embedding"], list) and len(first["embedding"]) > 0:
#                     emb = first["embedding"]
#                 elif isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
#                     emb = first

#             # shape: top-level list: [[...], ...] or [...]
#             elif isinstance(data, list) and len(data) > 0:
#                 first = data[0]
#                 if isinstance(first, list) and len(first) > 0 and isinstance(first[0], (int, float)):
#                     emb = first
#                 elif all(isinstance(x, (int, float)) for x in data):
#                     emb = data

#             # final validation
#             if emb and isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], (int, float)):
#                 logger.info("Ollama embedding success model=%s field=%s len=%d", cand, field_name, len(emb))
#                 return emb
#             else:
#                 logger.debug("Ollama returned no usable embedding for model=%s field=%s response=%s", cand, field_name, json.dumps(data)[:800])

#     logger.warning("Ollama embeddings: no embedding available from candidates: %s", candidate_models)
#     return None

# def get_embedding(text: str, model_name: Optional[str] = None, timeout_per_call: int = 20) -> Optional[List[float]]:
#     """
#     Multi-model embedding strategy:
#       - If model_name provided: try that model
#       - If not provided: try the single resolved model from env (SELECTED_EMBED_MODEL)
#       - Parallel attempts supported but we keep single-resolved model to avoid mixed dims.
#     """
#     models_to_try = []
#     if model_name:
#         models_to_try = [model_name]
#     else:
#         models_to_try = OLLAMA_EMBED_MODELS if OLLAMA_EMBED_MODELS else [None]

#     # helper wrapper calling the robust _call_ollama_embeddings
#     def try_model(m):
#         if not m:
#             return None
#         return _call_ollama_embeddings(m, text, timeout=timeout_per_call)

#     # If only one model requested, try it directly
#     if len(models_to_try) <= 1:
#         if models_to_try[0] is None:
#             return None
#         return try_model(models_to_try[0])

#     # Parallel attempts (rare because we enforce single model earlier, but keep logic)
#     with ThreadPoolExecutor(max_workers=min(6, len(models_to_try))) as ex:
#         futures = {ex.submit(try_model, m): m for m in models_to_try}
#         try:
#             for future in as_completed(futures, timeout=timeout_per_call):
#                 try:
#                     result = future.result(timeout=0)
#                     if result:
#                         chosen = futures[future]
#                         logger.info("Embedding returned by model '%s' (len=%d)", chosen, len(result))
#                         return result
#                 except Exception as fe:
#                     logger.debug("Parallel embedding future failed: %s", fe)
#         except Exception as e:
#             logger.debug("Parallel embedding attempts timed out or failed: %s", e)

#     # Sequential fallback
#     for m in models_to_try:
#         try:
#             emb = try_model(m)
#             if emb:
#                 logger.info("Embedding returned by model '%s' (sequential fallback)", m)
#                 return emb
#         except Exception as e:
#             logger.debug("Sequential fallback failed for model %s: %s", m, e)

#     logger.warning("No embedding available from any configured model: %s", OLLAMA_EMBED_MODELS)
#     return None

# def generate_chat_response(query: str, context: str = "") -> str:
#     """Generate chat response using Ollama"""
#     try:
#         prompt = f"""You are a helpful AI assistant for a privacy-aware document search system.

# Context from documents:
# {context}

# User question: {query}

# Please provide a helpful and accurate response based on the context provided. If the context doesn't contain relevant information, say so politely."""

#         response = requests.post(
#             f"{OLLAMA_URL}/api/generate",
#             json={
#                 "model": OLLAMA_MODEL,
#                 "prompt": prompt,
#                 "stream": False
#             },
#             timeout=120
#         )
#         response.raise_for_status()
#         # Many Ollama responses contain structured data — try multiple shapes
#         j = response.json()
#         if isinstance(j, dict):
#             # first check for 'response' key
#             if "response" in j and isinstance(j["response"], str):
#                 return j["response"]
#             # some versions return 'output' or similar
#             if "output" in j and isinstance(j["output"], str):
#                 return j["output"]
#             # if 'choices' like OpenAI, try to extract text
#             if "choices" in j and isinstance(j["choices"], list) and j["choices"]:
#                 c = j["choices"][0]
#                 if isinstance(c, dict) and "message" in c and isinstance(c["message"], str):
#                     return c["message"]
#         return json.dumps(j)  # fallback: return raw json as string
#     except Exception as e:
#         logger.error(f"Chat generation failed: {e}")
#         return "I'm sorry, I encountered an error generating a response."

# def chromadb_add(ids: List[str], documents: List[str], embeddings: List[List[float]]):
#     """Add documents to ChromaDB using Python client"""
#     chroma_collection.add(
#         ids=ids,
#         documents=documents,
#         embeddings=embeddings
#     )

# def chromadb_query(query_embeddings: List[List[float]], n_results: int = TOP_K):
#     """Query ChromaDB for most relevant documents using Python client"""
#     results = chroma_collection.query(
#         query_embeddings=query_embeddings,
#         n_results=n_results
#     )
#     return results

# # -----------------------------
# # Ensure database tables (documents, processing_jobs, audit_logs)
# # -----------------------------
# def ensure_database_tables():
#     """Create database tables if they don't exist"""
#     conn = None
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             # Documents table
#             cur.execute("""
#                 CREATE TABLE IF NOT EXISTS documents (
#                     id SERIAL PRIMARY KEY,
#                     file_key TEXT NOT NULL UNIQUE,
#                     filename TEXT NOT NULL,
#                     status TEXT DEFAULT 'pending',
#                     content_preview TEXT,
#                     uploaded_by INTEGER,
#                     department TEXT,
#                     sensitivity TEXT,
#                     created_at TIMESTAMP DEFAULT NOW(),
#                     processed_at TIMESTAMP
#                 );
#             """)

#             # Processing jobs table
#             cur.execute("""
#                 CREATE TABLE IF NOT EXISTS processing_jobs (
#                     id SERIAL PRIMARY KEY,
#                     job_data TEXT NOT NULL,
#                     status TEXT DEFAULT 'pending',
#                     created_at TIMESTAMP DEFAULT NOW(),
#                     processed_at TIMESTAMP
#                 );
#             """)

#             # Audit logs table
#             cur.execute("""
#                 CREATE TABLE IF NOT EXISTS audit_logs (
#                     id SERIAL PRIMARY KEY,
#                     user_id INTEGER,
#                     action VARCHAR(100) NOT NULL,
#                     resource_type VARCHAR(50),
#                     resource_id INTEGER,
#                     details JSONB,
#                     ip_address INET,
#                     user_agent TEXT,
#                     created_at TIMESTAMP DEFAULT NOW()
#                 );
#             """)

#             conn.commit()
#             logger.info("Database tables ensured")
#     except Exception as e:
#         logger.exception("Failed to ensure database tables: %s", e)
#         # If DB creation fails, bubble up so startup can handle it (or worker will keep retrying)
#         raise
#     finally:
#         if conn:
#             put_conn(conn)

# # -----------------------------
# # MinIO operations (robust endpoint normalization)
# # -----------------------------
# from urllib.parse import urlparse

# def _normalize_minio_endpoint(raw_endpoint: str, raw_port: Optional[int]):
#     """
#     Normalize MINIO_ENDPOINT or MINIO_HOST + MINIO_PORT into (endpoint_hostport, secure_bool)
#     Accepts:
#       - raw_endpoint like "minio:9000" or "http://minio:9000" or "https://minio:9000/anypath"
#       - raw_port as integer (optional)
#     Returns:
#       - endpoint (str) in form "host:port" or "host"
#       - secure (bool) indicating if TLS (https) should be used
#     Raises ValueError if it cannot normalize.
#     """
#     if not raw_endpoint and not raw_port:
#         raise ValueError("MINIO_ENDPOINT or MINIO_PORT (with host) must be set")

#     endpoint = (raw_endpoint or "").strip()

#     # If endpoint starts with scheme, parse it
#     if endpoint.startswith("http://") or endpoint.startswith("https://"):
#         parsed = urlparse(endpoint)
#         host = parsed.hostname
#         port = parsed.port
#         secure = parsed.scheme == "https"
#         if not host:
#             raise ValueError(f"Could not parse host from MINIO_ENDPOINT='{raw_endpoint}'")
#         if port:
#             return f"{host}:{port}", secure
#         return host, secure

#     # If endpoint contains a slash (but no scheme), try to prefix http:// then parse
#     if "/" in endpoint and not endpoint.startswith("http"):
#         try:
#             parsed = urlparse("http://" + endpoint)
#             host = parsed.hostname
#             port = parsed.port
#             secure = False
#             if not host:
#                 raise ValueError(f"Could not parse host from MINIO_ENDPOINT='{raw_endpoint}'")
#             if port:
#                 return f"{host}:{port}", secure
#             return host, secure
#         except Exception:
#             pass

#     # If endpoint looks like host:port
#     if ":" in endpoint and not endpoint.startswith(":"):
#         parts = endpoint.split(":")
#         host = parts[0]
#         port_part = parts[1] if len(parts) > 1 else None
#         if port_part:
#             return f"{host}:{port_part}", False
#         return host, False

#     # if no port in endpoint but raw_port provided, combine
#     if endpoint and raw_port:
#         return f"{endpoint}:{raw_port}", False

#     # fallback: single hostname (no port)
#     if endpoint:
#         return endpoint, False

#     raise ValueError(f"Could not normalize MINIO_ENDPOINT='{raw_endpoint}' with port='{raw_port}'")


# def get_minio_client(retries=10, delay=3):
#     """
#     Create and return a Minio client.
#     Accepts MINIO_ENDPOINT (with or without scheme), or MINIO_PORT with MINIO_ENDPOINT/host.
#     Uses MINIO_ACCESS_KEY / MINIO_SECRET_KEY (falls back to MINIO_ROOT_USER / MINIO_ROOT_PASSWORD).
#     """
#     raw_endpoint = os.getenv("MINIO_ENDPOINT", "")    # expected like "minio:9000" or "http://minio:9000"
#     raw_port_env = os.getenv("MINIO_PORT", "")
#     raw_port = int(raw_port_env) if raw_port_env and raw_port_env.isdigit() else None

#     access_key = os.getenv("MINIO_ACCESS_KEY") or os.getenv("MINIO_ROOT_USER")
#     secret_key = os.getenv("MINIO_SECRET_KEY") or os.getenv("MINIO_ROOT_PASSWORD")
#     bucket = os.getenv("MINIO_BUCKET", MINIO_BUCKET)

#     if not access_key or not secret_key:
#         raise RuntimeError("Missing MinIO credentials: set MINIO_ACCESS_KEY and MINIO_SECRET_KEY (or MINIO_ROOT_USER/MINIO_ROOT_PASSWORD)")

#     # Normalize endpoint and secure flag
#     endpoint_hostport, secure = _normalize_minio_endpoint(raw_endpoint, raw_port)

#     # allow override to force insecure mode (dev)
#     insecure_override = os.getenv("MINIO_INSECURE", "").lower() in ("1", "true", "yes")
#     if insecure_override:
#         secure = False

#     last_err = None
#     for attempt in range(retries):
#         try:
#             client = Minio(
#                 endpoint_hostport,
#                 access_key=access_key,
#                 secret_key=secret_key,
#                 secure=secure
#             )
#             # test and create bucket if needed
#             if client.bucket_exists(bucket):
#                 return client
#             else:
#                 client.make_bucket(bucket)
#                 return client
#         except Exception as e:
#             last_err = e
#             logger.warning("MinIO connection attempt %d failed: %s", attempt + 1, e)
#             if attempt == retries - 1:
#                 # raise a clearer error
#                 raise RuntimeError(f"Failed to create Minio client for endpoint '{endpoint_hostport}' (secure={secure}): {e}") from e
#             time.sleep(delay)


# # -----------------------------
# # Document processing
# # -----------------------------
# def extract_text_from_file(file_path: str) -> str:
#     """Extract text from various file formats"""
#     try:
#         if file_path.lower().endswith('.pdf'):
#             reader = PdfReader(file_path)
#             text = ""
#             for page in reader.pages:
#                 text += page.extract_text() or ""
#             return text
#         else:
#             # Handle text files
#             with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
#                 return f.read()
#     except Exception as e:
#         logger.error(f"Text extraction failed for {file_path}: {e}")
#         return ""

# def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
#     """Split text into overlapping chunks"""
#     if not text:
#         return []

#     chunks = []
#     start = 0

#     while start < len(text):
#         end = min(start + chunk_size, len(text))
#         chunk = text[start:end].strip()

#         if chunk:
#             chunks.append(chunk)

#         if end >= len(text):
#             break

#         start = max(start + chunk_size - overlap, start + 1)

#     return chunks

# def process_document_job(job_data: Dict[str, Any]):
#     """Process a document from MinIO"""
#     file_key = job_data.get("key")
#     if not file_key:
#         logger.error("No file key in job data")
#         return

#     temp_file_path = f"/tmp/{os.path.basename(file_key)}"

#     try:
#         # Download file from MinIO
#         minio_client.fget_object(MINIO_BUCKET, file_key, temp_file_path)
#         logger.info(f"Downloaded {file_key} for processing")

#         # Extract text
#         text_content = extract_text_from_file(temp_file_path)
#         if not text_content:
#             logger.warning(f"No text extracted from {file_key}")
#             return

#         # Split into chunks
#         chunks = chunk_text(text_content)
#         logger.info(f"Split {file_key} into {len(chunks)} chunks")

#         # Process chunks in batches
#         batch_size = 10
#         for i in range(0, len(chunks), batch_size):
#             batch_chunks = chunks[i:i + batch_size]
#             batch_ids = [str(uuid.uuid4()) for _ in batch_chunks]
#             batch_embeddings = []

#             # Get embeddings for batch
#             for chunk in batch_chunks:
#                 embedding = get_embedding(chunk)
#                 if embedding:
#                     batch_embeddings.append(embedding)
#                 else:
#                     logger.warning(f"Failed to get embedding for chunk from {file_key}")

#             # Store in ChromaDB if we have embeddings
#             if batch_embeddings and len(batch_embeddings) == len(batch_chunks):
#                 try:
#                     chromadb_add(batch_ids[:len(batch_embeddings)],
#                                  batch_chunks[:len(batch_embeddings)],
#                                  batch_embeddings)
#                     logger.info(f"Stored batch of {len(batch_embeddings)} chunks from {file_key}")
#                 except Exception as e:
#                     logger.error(f"Failed to store batch in ChromaDB: {e}")

#         # Update database - use pooled connection safely
#         conn = None
#         try:
#             conn = get_conn()
#             with conn.cursor() as cur:
#                 cur.execute(
#                     "UPDATE documents SET status = 'processed', processed_at = NOW(), content_preview = %s WHERE file_key = %s",
#                     (text_content[:500], file_key)
#                 )
#             conn.commit()
#         except Exception as e:
#             logger.exception(f"Failed to update document status for {file_key}: {e}")
#         finally:
#             if conn:
#                 put_conn(conn)

#         logger.info(f"Successfully processed {file_key}")

#     except Exception as e:
#         logger.error(f"Error processing {file_key}: {e}")
#     finally:
#         # Clean up temp file
#         try:
#             os.remove(temp_file_path)
#         except:
#             pass

# # -----------------------------
# # Background worker
# # -----------------------------
# def background_worker():
#     """Background worker to process jobs from Redis queue"""
#     # ensure DB tables exist
#     try:
#         ensure_database_tables()
#     except Exception as e:
#         logger.exception("ensure_database_tables failed at worker start: %s", e)

#     redis_client = redis.from_url(REDIS_URL)

#     logger.info("Background worker started")

#     while True:
#         try:
#             # Wait for job from Redis queue
#             result = redis_client.brpop("document_jobs", timeout=10)
#             if not result:
#                 continue

#             _, job_data_raw = result
#             job_data_str = job_data_raw.decode() if isinstance(job_data_raw, bytes) else str(job_data_raw)

#             try:
#                 job_data = json.loads(job_data_str)
#             except json.JSONDecodeError:
#                 job_data = {"key": job_data_str}

#             logger.info(f"Processing job: {job_data}")
#             process_document_job(job_data)

#         except Exception as e:
#             logger.error(f"Worker error: {e}")
#             time.sleep(5)

# def start_background_worker():
#     """Start background worker thread"""
#     worker_thread = Thread(target=background_worker, daemon=True)
#     worker_thread.start()

# # -----------------------------
# # API Endpoints
# # -----------------------------
# @app.get("/health")
# def health_check():
#     """Health check endpoint"""
#     checks = {
#         "ollama": False,
#         "chromadb": True,
#         "postgres": False,
#         "redis": False,
#         "minio": False
#     }

#     try:
#         response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
#         checks["ollama"] = response.status_code == 200
#     except Exception:
#         checks["ollama"] = False

#     try:
#         # Check DB by acquiring a pooled connection briefly
#         conn = None
#         try:
#             conn = get_conn()
#             checks["postgres"] = True
#         except Exception:
#             checks["postgres"] = False
#         finally:
#             if conn:
#                 put_conn(conn)
#     except Exception:
#         checks["postgres"] = False

#     try:
#         redis_client = redis.from_url(REDIS_URL)
#         checks["redis"] = redis_client.ping()
#     except Exception:
#         checks["redis"] = False

#     try:
#         minio_client.bucket_exists(MINIO_BUCKET)
#         checks["minio"] = True
#     except Exception:
#         checks["minio"] = False

#     status = "healthy" if all(checks.values()) else "degraded"
#     return {"status": status, "checks": checks, "timestamp": datetime.now().isoformat()}

# @app.post("/embed")
# def embed_text(request: EmbedRequest):
#     """Embed text and store in ChromaDB via Python client"""
#     try:
#         embedding = get_embedding(request.text)
#         if not embedding:
#             raise HTTPException(status_code=500, detail="Failed to generate embedding")

#         doc_id = request.id or str(uuid.uuid4())
#         chromadb_add([doc_id], [request.text], [embedding])

#         return {
#             "id": doc_id,
#             "embedding": embedding,
#             "status": "success"
#         }
#     except Exception as e:
#         logger.error(f"Embedding error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/search")
# def search_documents(request: SearchRequest):
#     """Search for similar documents using ChromaDB client and record audit logs"""
#     user = {}  # default empty user if caller didn't provide user context
#     # In your real flow, the API gateway populates user info in payload.
#     # If you forward user object from api -> worker, use it. Here we check request context.
#     # For compatibility, attempt to read a 'user' field if present in request (if using raw dict).
#     try:
#         # Redact and hash query for audit
#         raw_query = request.query or ""
#         query_redacted = redact_text(raw_query)
#         query_hash = hash_query(raw_query)

#         # Generate embedding
#         query_embedding = get_embedding(raw_query)
#         if not query_embedding:
#             # audit with error and return failure
#             details = {
#                 "query_hash": query_hash,
#                 "query_redacted": query_redacted,
#                 "error": "Failed to generate query embedding",
#                 "result_count": 0,
#                 "document_ids": []
#             }
#             try:
#                 insert_audit_log(user.get("id"), "search", "document", None, details)
#             except Exception:
#                 pass
#             raise HTTPException(status_code=500, detail="Failed to generate query embedding")

#         # Query ChromaDB
#         results = chromadb_query([query_embedding], request.top_k)
#         documents = []
#         doc_ids = []
#         if results and results.get("documents") and results["documents"][0]:
#             for (doc_text, doc_id, distance) in zip(
#                 results["documents"][0],
#                 results["ids"][0],
#                 results["distances"][0]
#             ):
#                 score = 1.0 - distance
#                 documents.append(DocumentChunk(id=doc_id, text=doc_text, score=score))
#                 doc_ids.append(doc_id)

#         # NOTE: you should apply document-level access filtering here (use your ABAC logic)
#         # For now we assume the caller has already passed allowed docs, or ABAC is enforced before worker.
#         filtered = documents  # keep as-is; replace with filtering if you implement it

#         # Build audit details
#         details = {
#             "query_hash": query_hash,
#             "query_redacted": query_redacted,
#             "result_count": len(filtered),
#             "document_ids": doc_ids
#         }

#         # Insert audit log (best-effort)
#         try:
#             insert_audit_log(user.get("id"), "search", "document", None, details)
#         except Exception as e:
#             logger.exception("Audit insert failed: %s", e)

#         return {
#             "query": raw_query,
#             "results": filtered,
#             "total_found": len(filtered)
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.exception("Search error: %s", e)
#         # attempt best-effort audit
#         try:
#             insert_audit_log(user.get("id"), "search", "document", None, {
#                 "query_hash": hash_query(request.query if hasattr(request, 'query') else ""),
#                 "query_redacted": redact_text(request.query if hasattr(request, 'query') else ""),
#                 "error": str(e),
#                 "result_count": 0,
#                 "document_ids": []
#             })
#         except Exception:
#             pass
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/chat")
# async def chat_with_documents(req: Request):
#     """
#     Chat interface with document context — made robust to incoming payload shape issues.

#     Reason for change:
#       - Pydantic model validation produced 422 when the gateway forwarded payloads
#         that didn't precisely match the model. To avoid 422 and provide clearer errors,
#         we read the raw JSON, extract query/context conservatively, validate, then proceed.
#     """
#     try:
#         # Attempt to parse JSON body; if parsing fails FastAPI will have already rejected non-JSON,
#         # but we catch and provide clearer message.
#         try:
#             body = await req.json()
#         except Exception as e:
#             logger.debug("Failed to parse JSON body for /chat: %s", e)
#             raise HTTPException(status_code=400, detail="Invalid JSON body for /chat")

#         # Log incoming body for easier debugging (remove or reduce later)
#         logger.debug("Incoming /chat body: %s", json.dumps(body)[:2000])

#         # Accept multiple possible field names for query for compatibility:
#         # prefer 'query', then 'q', then 'message'
#         query = None
#         if isinstance(body, dict):
#             query = body.get("query") or body.get("q") or body.get("message")
#             context = body.get("context") if "context" in body else None
#         else:
#             # in case the body isn't a dict, coerce to string
#             query = str(body)

#         # Validate the query
#         if not query or not isinstance(query, str) or query.strip() == "":
#             # Return 400 with a helpful message so callers/gateway know what's wrong
#             raise HTTPException(status_code=400, detail="Missing or invalid 'query' in request body. Provide JSON like {\"query\":\"your question\",\"context\":\"optional\"}")

#         query = query.strip()
#         context = (context.strip() if isinstance(context, str) and context.strip() else None)

#         # If no context provided, run a short search to assemble context
#         if not context:
#             # create a SearchRequest instance and call internal search
#             search_req = SearchRequest(query=query, top_k=3)
#             search_results = search_documents(search_req)
#             contexts = []
#             for doc in search_results["results"]:
#                 contexts.append(doc.text)
#             context = "\n\n".join(contexts)

#         # Generate chat response
#         response_text = generate_chat_response(query, context or "")

#         return {
#             "query": query,
#             "response": response_text,
#             "context_used": bool(context),
#             "status": "success"
#         }

#     except HTTPException:
#         # re-raise HTTPExceptions (400 etc.)
#         raise
#     except Exception as e:
#         logger.exception(f"Chat error: {e}")
#         # Return 500 with message
#         raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Ingestion Logic
# -----------------------------
from ingestion.dummy_modules import DummyUniversityIngestion, DummyHospitalIngestion, DummyFinanceIngestion
from ingestion.web_scraper import WebIngestion

class IngestionRequest(BaseModel):
    org_id: str | int # Allow string for "university" etc.
    type: str
    url: Optional[str] = None

def run_ingestion_task(org_id: int, ingestion_type: str, url: Optional[str] = None):
    """
    Background task to run ingestion pipeline.
    """
    logger.info(f"Starting ingestion task: type={ingestion_type}, org_id={org_id}")
    
    try:
        pipeline = None
        if ingestion_type == 'dummy_university':
            pipeline = DummyUniversityIngestion(org_id)
        elif ingestion_type == 'dummy_hospital':
            pipeline = DummyHospitalIngestion(org_id)
        elif ingestion_type == 'dummy_finance':
            pipeline = DummyFinanceIngestion(org_id)
        elif ingestion_type == 'web':
            if not url:
                raise ValueError("URL is required for web ingestion")
            pipeline = WebIngestion(org_id, url)
        else:
            logger.error(f"Unknown ingestion type: {ingestion_type}")
            return

        # 1. Fetch Data
        items = pipeline.run()
        
        # 2. Process and Store
        ids = []
        documents = []
        embeddings = []
        metadatas = []
        
        for item in items:
            text = item['text']
            meta = item['metadata']
            
            # Chunking (simple for now, or use existing chunk_text if available)
            # We'll treat each item as a document for simplicity in this phase
            # Or better, use the chunk_text function if we can access it or reimplement simple chunking
            
            # Let's use a simple split for now or the text splitter if imported
            # We can use RecursiveCharacterTextSplitter from langchain if imported
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_text(text)
            
            for i, chunk in enumerate(chunks):
                chunk_id = str(uuid.uuid4())
                
                # Embedding
                embedding = get_embedding(chunk)
                if not embedding:
                    logger.warning(f"Failed to generate embedding for chunk {chunk_id}")
                    continue
                    
                ids.append(chunk_id)
                documents.append(chunk)
                embeddings.append(embedding)
                
                # Enrich metadata
                chunk_meta = meta.copy()
                chunk_meta['chunk_index'] = i
                chunk_meta['ingestion_type'] = ingestion_type
                chunk_meta['org_id'] = org_id
                metadatas.append(chunk_meta)
        
        # 3. Store in ChromaDB
        if ids:
            collection = get_org_collection(org_id=org_id)
            chromadb_add(ids, documents, embeddings, metadatas, collection=collection)
            logger.info(f"Ingestion complete. Stored {len(ids)} chunks for Org {org_id}")
            
            # Log success to DB
            log_ingestion_status(org_id, ingestion_type, url, 'completed', {'chunks': len(ids)})
        else:
            logger.warning("No content to store")
            log_ingestion_status(org_id, ingestion_type, url, 'completed', {'chunks': 0, 'message': 'No content found'})

    except Exception as e:
        logger.exception(f"Ingestion failed: {e}")
        log_ingestion_status(org_id, ingestion_type, url, 'failed', {'error': str(e)})

def log_ingestion_status(org_id, ingestion_type, url, status, details):
    """Log ingestion status to Postgres"""
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ingestion_logs (org_id, type, url, status, details)
                VALUES (%s, %s, %s, %s, %s)
            """, (org_id, ingestion_type, url, status, PGJson(details)))
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to log ingestion status: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.post("/ingest")
async def trigger_ingestion(request: IngestionRequest, background_tasks: BackgroundTasks):
    """
    Trigger an ingestion task.
    """
    # Create initial log entry
    log_ingestion_status(request.org_id, request.type, request.url, 'pending', {})
    
    background_tasks.add_task(run_ingestion_task, request.org_id, request.type, request.url)
    return {"status": "accepted", "message": f"Ingestion started for {request.type}"}

# ============================================================================
# BATCH PROCESSING - Process pending documents with embeddings
# ============================================================================

@app.post("/process-batch")
async def process_documents_batch(org_id: int, batch_size: int = 100, max_documents: Optional[int] = None):
    """Process pending documents in batches to generate embeddings."""
    logger.info(f"Batch processing started: org_id={org_id}, batch_size={batch_size}")
    
    total_processed = 0
    total_failed = 0
    failed_docs = []
    
    try:
        collection = get_org_collection(org_id=org_id)
        conn = get_conn()
        cursor = conn.cursor()
        
        while True:
            cursor.execute("""
                SELECT id, filename, metadata, file_key
                FROM documents
                WHERE org_id = %s AND status = 'pending'
                ORDER BY created_at ASC
                LIMIT %s
            """, (org_id, batch_size))
            
            docs = cursor.fetchall()
            if not docs:
                break
            
            for doc_id, filename, metadata, file_key in docs:
                try:
                    if isinstance(metadata, str):
                        import json
                        metadata_dict = json.loads(metadata)
                    else:
                        metadata_dict = metadata or {}
                    
                    text_parts = [f"{k}: {v}" for k, v in metadata_dict.items() if v]
                    text = " | ".join(text_parts) if text_parts else f"Document from {filename}"
                    
                    if len(text.strip()) < 3:
                        failed_docs.append({"id": doc_id, "error": "No text"})
                        total_failed += 1
                        continue
                    
                    embedding = None
                    for attempt in range(3):
                        try:
                            embedding = get_embedding(text)
                            if embedding and len(embedding) > 0:
                                break
                        except Exception as e:
                            if attempt < 2:
                                import time
                                time.sleep(2 ** attempt)
                    
                    if not embedding:
                        failed_docs.append({"id": doc_id, "error": "Embedding failed"})
                        total_failed += 1
                        continue
                    
                    chromadb_add(
                        ids=[f"doc_{org_id}_{doc_id}"],
                        documents=[text],
                        embeddings=[embedding],
                        metadatas=[{"org_id": org_id, "doc_id": doc_id, "filename": filename}],
                        collection=collection
                    )
                    
                    cursor.execute("UPDATE documents SET status = 'processed' WHERE id = %s", (doc_id,))
                    total_processed += 1
                    
                except Exception as e:
                    logger.error(f"Error processing doc {doc_id}: {e}")
                    failed_docs.append({"id": doc_id, "error": str(e)})
                    total_failed += 1
            
            conn.commit()
            if max_documents and total_processed >= max_documents:
                break
        
        cursor.close()
        put_conn(conn)
        
        conn_check = get_conn()
        cursor_check = conn_check.cursor()
        cursor_check.execute("SELECT COUNT(*) FROM documents WHERE org_id = %s AND status = 'pending'", (org_id,))
        remaining = cursor_check.fetchone()[0]
        cursor_check.close()
        put_conn(conn_check)
        
        return {
            "success": True,
            "processed": total_processed,
            "failed": total_failed,
            "remaining": remaining,
            "progress_percentage": round((total_processed / (total_processed + remaining)) * 100, 2) if (total_processed + remaining) > 0 else 0
        }
    except Exception as e:
        logger.exception(f"Batch processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/processing-status")
async def get_processing_status(org_id: int):
    """Get processing status for an organization."""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM documents WHERE org_id = %s
            GROUP BY status
        """, (org_id,))
        status_counts = {row[0]: row[1] for row in cursor.fetchall()}
        cursor.close()
        put_conn(conn)
        
        total = sum(status_counts.values())
        completed = status_counts.get('processed', 0)
        
        return {
            "org_id": org_id,
            "total_documents": total,
            "pending": status_counts.get('pending', 0),
            "processed": completed,
            "progress_percentage": round((completed / total) * 100, 2) if total > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Startup
# -----------------------------
@app.on_event("startup")
def startup():
    global minio_client
    logger.info("Privacy-Aware RAG Worker starting...")

    # initialize the DB pool
    init_db_pool()

    # ensure DB tables exist
    try:
        ensure_database_tables()
    except Exception as e:
        # If DB isn't ready yet, log and continue; background_worker will also call ensure_database_tables()
        logger.exception("ensure_database_tables failed during startup: %s", e)

    minio_client = get_minio_client()
    start_background_worker()
    
    # Log which embed models were configured
    logger.info("Configured Ollama embed models (in preference order): %s", OLLAMA_EMBED_MODELS)
    logger.info("Worker service initialized successfully")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)