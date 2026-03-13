

import os
import sys
import csv
import io
from dotenv import load_dotenv

# Load .env file explicitly from project root (2 levels up)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
load_dotenv(dotenv_path)

import time
import json
import uuid
import asyncio
import logging
import re
import base64
import hashlib
from typing import List, Optional, Dict, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Security Guardrails
from security.prompt_guard import scan_prompt

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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
import openai
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tiktoken
from ingestion.web_scraper import WebScraper

# Presidio NER setup
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern, RecognizerResult
from presidio_anonymizer import AnonymizerEngine

# Initialize Scraper
scraper = WebScraper()

# ALE Crypto Manager
try:
    from security.crypto_manager import CryptoManager
except ImportError:
    logger.warning("CryptoManager not found in security.crypto_manager. Encryption will fail if used.")
    CryptoManager = None

# Phase 4: DP and Retention
try:
    from security.differential_privacy import DifferentialPrivacy
except ImportError:
    logger.warning("DifferentialPrivacy not found. Search noise disabled.")
    DifferentialPrivacy = None

RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "365"))
DP_ENABLED = os.getenv("DP_ENABLED", "TRUE").upper() == "TRUE"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Phase 3: Guardrail Manager
try:
    from security.guardrail_manager import GuardrailManager
except ImportError:
    logger.warning("GuardrailManager not found. Security guardrails will be disabled.")
    GuardrailManager = None

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
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi3:mini")
# Accept comma-separated list of embedding models
OLLAMA_EMBED_MODELS_RAW = os.getenv("OLLAMA_EMBED_MODEL", "mxbai-embed-large")
# parse into list, strip whitespace and ignore empties
OLLAMA_EMBED_MODELS = [m.strip() for m in OLLAMA_EMBED_MODELS_RAW.split(",") if m.strip()]

CHROMADB_HOST = os.getenv("CHROMADB_HOST", "chromadb")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", 8000))
CHROMADB_COLLECTION = os.getenv("CHROMADB_COLLECTION", "privacy_documents")

TOP_K = int(os.getenv("TOP_K", 15))
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
# Standardize ChromaDB client with explicit tenant/database to avoid sync issues
chroma_client = chromadb.HttpClient(
    host=CHROMADB_HOST, 
    port=CHROMADB_PORT,
    tenant="default_tenant",
    database="default_database"
)
chroma_collection = chroma_client.get_or_create_collection(name="privacy_documents_1")

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
    user_role: Optional[str] = "student" # super_admin, admin, student, general
    user_id: Optional[Any] = None
    model_preference: Optional[Dict[str, Any]] = None
    dp_enabled: Optional[bool] = DP_ENABLED
    history: Optional[List[Dict[str, Any]]] = []

class ChatRequest(BaseModel):
    query: str
    context: Optional[str] = None
    organization: Optional[str] = "default"
    org_id: Optional[int] = None
    user_role: Optional[str] = "student"
    user_id: Optional[Any] = None
    department: Optional[str] = None
    user_category: Optional[str] = None
    model_preference: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, Any]]] = []
class RedactionRequest(BaseModel):
    text: str
    internal_only: bool = False

def get_org_collection(org_id: Optional[int] = None, org_name: str = "default", user_role: str = "student"):
    """Get or create a ChromaDB collection for a specific organization or general use.
    Phase 6.3: HNSW tuning for fast search on large datasets (11,000+ docs).
    """
    # Super admin should access org-specific data if org_id is provided
    # Otherwise fallback to org_id=1 as the default main collection
    if user_role in ["super_admin", "admin"]:
        if org_id:
            collection_name = f"privacy_documents_{org_id}"
        else:
            # Default to org 1 which has the main university data (25K+ documents)
            collection_name = "privacy_documents_1"
    elif user_role == "general":
        collection_name = "privacy_documents_general"
    elif org_id:
        collection_name = f"privacy_documents_{org_id}"
    else:
        # Fallback to name-based if ID not provided (legacy/default)
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', org_name).lower()
        collection_name = f"privacy_documents_{safe_name}"
    
    # CRITICAL: We provide pre-computed 384-dim embeddings from nomic-embed-text.
    # Phase 6.3: HNSW tuning for O(log N) search instead of brute-force O(N)
    metadata = {
        "hnsw:space": "cosine",            # Cosine similarity for text embeddings
        "hnsw:construction_ef": 200,       # Higher = more accurate index (default: 100)
        "hnsw:search_ef": 100,             # Higher = more accurate search (default: 10)
        "hnsw:M": 32,                      # More connections = faster search (default: 16)
        "hnsw:batch_size": 1000,           # Process in batches
        "hnsw:sync_threshold": 2000,       # Sync to disk every 2000 inserts
    }
    # Consistently use the same standardized client
    return chroma_client.get_or_create_collection(
        name=collection_name,
        metadata=metadata
    )

class DocumentChunk(BaseModel):
    id: str
    text: str
    score: float

# Privacy helpers (Presidio NER + Regex)
# -----------------------------
try:
    logger.info("Initializing Presidio Analyzer (loading NLP model en_core_web_md)...")
    from presidio_analyzer import AnalyzerEngine, RecognizerResult, PatternRecognizer, Pattern
    from presidio_anonymizer import AnonymizerEngine
    
    # --- Custom University Recognizers (Phase 7: Two-Tiered Redaction) ---
    # PES USN Pattern: PES, digits, characters (PES1234567, PES1PG24CA169)
    pes_pattern = Pattern(name="pes_pattern", regex=r"\bPES[A-Z0-9]{5,15}\b", score=0.9)
    pes_recognizer = PatternRecognizer(supported_entity="STUDENT_ID", patterns=[pes_pattern])
    
    # Structural IDs: PLACEMENT, COMPANY, FACULTY, COURSE, DEPT
    struct_pattern = Pattern(name="struct_pattern", regex=r"\b(STU|PLC|COMP|FAC|CRS|DEPT|MCA|ALU|USR|INT)[A_Z0-9_\-]{3,15}\b", score=0.9)
    struct_recognizer = PatternRecognizer(supported_entity="SYSTEM_ID", patterns=[struct_pattern])
    
    from presidio_analyzer.nlp_engine import NlpEngineProvider
    nlp_provider = NlpEngineProvider(nlp_configuration={
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": "en_core_web_md"}]
    })
    analyzer = AnalyzerEngine(nlp_engine=nlp_provider.create_engine())
    # Register custom recognizers
    analyzer.registry.add_recognizer(pes_recognizer)
    analyzer.registry.add_recognizer(struct_recognizer)
    
    anonymizer = AnonymizerEngine()
    logger.info("Presidio Analyzer initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize Presidio: {e}")
    analyzer = None
    anonymizer = None

def redact_text(text: str, return_map: bool = False, strictness: str = None, **kwargs):
    """
    Surgically redact PII from text without ever touching HTML tags.
    This prevents 'badge merging' across table cells and keeps UI structure 100% intact.
    """
    if not text or not analyzer:
        return (text, {}) if return_map else text

    # Entity type mapping for display labels
    TYPE_MAP = {
        "PERSON": "PERSON", "ORGANIZATION": "COMPANY", "PHONE_NUMBER": "PHONE",
        "EMAIL_ADDRESS": "EMAIL", "US_SSN": "SSN", "LOCATION": "LOCATION", "DATE_TIME": "DATE",
        "STUDENT_ID": "USER_ID", "SYSTEM_ID": "ID"
    }

    # Whitelists
    # Tightened ID_PATTERN: Must have prefix AND at least two ending digits to avoid redacting labels like "Company"
    ID_PATTERN = re.compile(r'\b(?:PES|STU|RES|INT|COMP|FAC|PLC|CRS|DEPT|MCA|ALU|USR|CSE|ISE|ECE|EEE|BME|BMS)[A-Z0-9_]*[0-9]{2,}\b|\b[A-Z]{2,4}[0-9]{3}[A-Z0-9]{0,3}\b', re.IGNORECASE)
    YEAR_PATTERN = re.compile(r'\b(20\d{2}(?:-\d{2,4})?)\b')

    # UNIVERSAL SEGMENTER: Split by tags, pipes, and newlines
    # This ensures Presidio never sees words from different cells/fields together.
    segments = re.split(r'(<[^>]+>|\||\n)', text)
    
    # --- Phase 4: Financial & Numerical PII (Harden for Stipend/Salary/LPA) ---
    # Catch currency amounts (e.g. 25000, 14,00,000, 22 LPA, 15 CTC)
    text = re.sub(r'\b(?:\d{4,10}|(?:\d{1,3}(?:,\d{2,3})+))\b', '[REDACTED_FINANCE]', text)
    text = re.sub(r'\b\d{1,3}\s*(?:LPA|CTC|Per Annum|Monthly)\b', '[REDACTED_FINANCE]', text, flags=re.IGNORECASE)
    
    # --- Phase 5: Date Redaction (Comprehensive Focus) ---
    # Catch YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    text = re.sub(r'\b\d{4}[-/\.]\d{2}[-/\.]\d{2}\b', '[REDACTED_DATE]', text)
    text = re.sub(r'\b\d{2}[-/\.]\d{2}[-/\.]\d{4}\b', '[REDACTED_DATE]', text)
    
    final_output_parts = []
    # FIX: Always use the passed pii_map if provided so state is preserved across calls!
    final_pii_map = kwargs.get("pii_map", {}) 
    global_counters = kwargs.get("counters", {})

    for segment in segments:
        if not segment:
            continue
            
        # If it's a separator, keep it exactly as is
        if re.match(r'(<[^>]+>|\||\n)', segment):
            final_output_parts.append(segment)
            continue
            
        # Process text segments individually
        # --- PHASE 1: CUSTOM RELIABLE REGEX (Priority) ---
        custom_results = []
        
        # Financial Amounts (Salary, Stipend, CTC) - Must come BEFORE Presidio to prevent 'REDACTED' fallback
        FINANCIAL_PATTERN = re.compile(r'\b(?:Salary|Stipend|CTC|Package|package)\s*[:\-]?\s*(?:Rs\.?|INR|USD|\$|₹)?\s*([\d,]{4,15})\b', re.IGNORECASE)
        for m in FINANCIAL_PATTERN.finditer(segment):
            custom_results.append(RecognizerResult(entity_type="MONEY", start=m.start(1), end=m.end(1), score=1.0))

        # Organization/Field labels that Presidio mis-identifies
        # IMPORTANT: Do NOT redact these labels themselves; they are required for UI tables.
        LABEL_PATTERN = re.compile(
            r'\b(Enrollment Date|Start Date|End Date|Placement Date|Date|Stipend|Salary|CTC|Package|Gender|Home State|Address|DOB|Pesu Id|Student Id)\b',
            re.IGNORECASE
        )
        for m in LABEL_PATTERN.finditer(segment):
            # We don't want to redact these LABELS, just protect them. 
            # We'll use a special 'LABEL' type that we skip in the loop.
            custom_results.append(RecognizerResult(entity_type="LABEL", start=m.start(), end=m.end(), score=1.0))

        # --- PHASE 2: PRESIDIO ANALYZER ---
        chunk_results = analyzer.analyze(text=segment, language='en') or []
        
        # Merge results, but CUSTOM wins on intersection
        final_results = custom_results.copy()
        for res in chunk_results:
            # Check if this outcome intersects with any of our high-confidence custom hits
            overlap = False
            for c_res in custom_results:
                if not (res.end <= c_res.start or res.start >= c_res.end):
                    overlap = True
                    break
            if not overlap:
                final_results.append(res)
        chunk_results = final_results

        # Add custom organization catch (only for non-overlapping)
        ORG_PATTERN = re.compile(r'\b(?:Org|Institution|Employer|Firm|Placed in)\s*[:\-]?\s*([A-Z][a-zA-Z0-9&.\s]{2,40})\b', re.IGNORECASE)
        for m in ORG_PATTERN.finditer(segment):
            # Check overlap again
            overlap = False
            for c_res in chunk_results:
                if not (m.end(1) <= c_res.start or m.start(1) >= c_res.end):
                    overlap = True
                    break
            if not overlap:
                chunk_results.append(RecognizerResult(entity_type="ORGANIZATION", start=m.start(1), end=m.end(1), score=0.95))
        
        # Add strict email catch
        EMAIL_CHUNK_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        for m in EMAIL_CHUNK_PATTERN.finditer(segment):
            chunk_results.append(RecognizerResult(entity_type="EMAIL_ADDRESS", start=m.start(), end=m.end(), score=1.0))
        
        # PRIVACY PERFECTION: Additional custom patterns for comprehensive PII coverage
        
        # Indian Phone Numbers (+91, 0-prefixed, or bare 10-digit)
        INDIAN_PHONE = re.compile(r'(?:\+91[\s\-]?)?(?:0?\d{10}|\d{5}[\s\-]\d{5})')
        for m in INDIAN_PHONE.finditer(segment):
            val = m.group(0).strip()
            if len(re.sub(r'\D', '', val)) >= 10:  # Must have at least 10 digits
                chunk_results.append(RecognizerResult(entity_type="PHONE_NUMBER", start=m.start(), end=m.end(), score=0.95))
        
        # Date of Birth patterns (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
        DOB_PATTERN = re.compile(r'\b(\d{4}-\d{2}-\d{2}|\d{2}[/\-]\d{2}[/\-]\d{4})\b')
        for m in DOB_PATTERN.finditer(segment):
            # Only redact if it looks like a specific date (not an academic year)
            val = m.group(0)
            if not re.match(r'20\d{2}-20\d{2}', val):  # Skip "2024-2025" academic years
                chunk_results.append(RecognizerResult(entity_type="DATE_TIME", start=m.start(), end=m.end(), score=0.90))
        
        # Aadhar Number (12 digits, often formatted as XXXX XXXX XXXX)
        AADHAR_PATTERN = re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b')
        for m in AADHAR_PATTERN.finditer(segment):
            val = re.sub(r'\s', '', m.group(0))
            if len(val) == 12 and val.isdigit():
                chunk_results.append(RecognizerResult(entity_type="US_SSN", start=m.start(), end=m.end(), score=0.95))
        
        # PAN Card (XXXXX9999X format)
        PAN_PATTERN = re.compile(r'\b[A-Z]{5}\d{4}[A-Z]\b')
        for m in PAN_PATTERN.finditer(segment):
            chunk_results.append(RecognizerResult(entity_type="US_SSN", start=m.start(), end=m.end(), score=0.95))
            
        # Financial moved to start of block for priority
        pass
        
        if not chunk_results:
            final_output_parts.append(segment)
            continue
            
        # Redact the chunk from back to front
        chunk_out = segment
        sorted_chunks = sorted(chunk_results, key=lambda r: r.start, reverse=True)
        for res in sorted_chunks:
            val = segment[res.start:res.end].strip()
            # Whitelist logic
            # If internal_only is True (for Search Params/History), we skip redacting structural IDs.
            # If False (for UI output), we redact everything including IDs.
            is_generic_id = ID_PATTERN.search(val.upper()) or res.entity_type in ["STUDENT_ID", "SYSTEM_ID"]
            
            if kwargs.get("internal_only", False) and is_generic_id:
                continue
                
            # Always skip standalone years/academic years (e.g. 2024, 2024-25), but NOT precise dates (YYYY-MM-DD)
            # Skip our protected labels
            if res.entity_type == "LABEL":
                continue

            if res.entity_type == "DATE_TIME":
                # Check if it's exactly a year or exactly a year range (length <= 9)
                if len(val) <= 9 and YEAR_PATTERN.fullmatch(val):
                    continue
                    
            if val.isdigit() and len(val) <= 3:
                continue
                
            dtype = TYPE_MAP.get(res.entity_type, "REDACTED")
            
            # CONSISTENT TOKEN MAPPING: 
            # If we've seen this exact PII value in this session (e.g., query ID matches context ID),
            # reuse the exact same token so the LLM can successfully match them.
            existing_token = None
            for tk, tv in final_pii_map.items():
                if tv.lower() == val.lower() and tk.startswith(f"[{dtype}"):
                    existing_token = tk
                    break
            
            if existing_token:
                token = existing_token
            else:
                idx = global_counters.get(dtype, 0)
                global_counters[dtype] = idx + 1
                token = f"[{dtype}:idx_{idx}]"
                final_pii_map[token] = val
                
            chunk_out = chunk_out[:res.start] + token + chunk_out[res.end:]
        
        final_output_parts.append(chunk_out)

    final_text = "".join(final_output_parts)
    if return_map:
        return (final_text, final_pii_map)
    return final_text

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
    if not db_pool or not conn:
        return
    try:
        # Check if connection is still in 'rused' to avoid KeyError
        if hasattr(db_pool, '_rused') and id(conn) in db_pool._rused:
            db_pool.putconn(conn)
        else:
            logger.warning(f"Connection {id(conn)} not found in pool rused set, closing instead.")
            conn.close()
    except Exception as e:
        logger.error(f"Failed to return DB connection to pool: {e}")

def close_db_pool():
    global db_pool
    try:
        if db_pool:
            db_pool.closeall()
            db_pool = None
            logger.info("Closed DB pool")
    except Exception as e:
        logger.exception("Error closing DB pool: %s", e)

def insert_audit_log(user_id, action, resource_type, resource_id, details, success=True, error_message=None, ip_address=None, user_agent=None):
    """
    Insert an audit log into audit_logs table and publish to Redis for real-time dashboard.
    """
    if not isinstance(details, dict):
        details = {"data": details}
    details["success"] = success
    if error_message:
        details["error_message"] = error_message

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at;
            """, (str(user_id) if user_id else None, action, resource_type, resource_id, ip_address, user_agent, PGJson(details)))
            row = cur.fetchone()
            conn.commit()
            
            if row:
                log_id, created_at = row
                # Real-time Broadcast via Redis Pub/Sub
                try:
                    r = redis.from_url(REDIS_URL)
                    event = {
                        "id": log_id,
                        "user_id": user_id,
                        "action": action,
                        "resource_type": resource_type,
                        "success": success,
                        "metadata": details,
                        "created_at": created_at.isoformat() if created_at else datetime.now().isoformat()
                    }
                    # Also try to resolve username if possible (simple heuristic)
                    event["username"] = details.get("username", "System") if details else "System"
                    
                    r.publish('system_activity', json.dumps(event))
                except Exception as redis_err:
                    logger.error(f"Redis Broadcast failed: {redis_err}")
                
                return log_id
            return None
    except Exception as e:
        logger.exception("Failed to insert audit log: %s", e)
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

# --- Embedding Cache (Phase 6.3) ---
_embedding_cache = {}
_EMBEDDING_CACHE_MAX = 500  # Keep last 500 embeddings in memory

def get_embedding(text: str, model_name: Optional[str] = None, timeout_per_call: int = 20) -> Optional[List[float]]:
    """
    Get embedding using nomic-embed-text to ensure consistency.
    All embeddings must use the same dimensionality (768) to match indexed documents.
    Uses an in-memory LRU cache to avoid redundant computation.
    """
    global _embedding_cache
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in _embedding_cache:
        logger.debug("Embedding cache HIT for key=%s", cache_key[:8])
        return _embedding_cache[cache_key]

    # ALWAYS use local nomic-embed-text to maintain 768-dim consistency
    local_model = "nomic-embed-text"
    logger.info(f"Generating embedding using {local_model} (768-dim)")
    result = _call_ollama_embeddings(local_model, text, timeout=timeout_per_call)

    if result:
        # Evict oldest entries if cache is full
        if len(_embedding_cache) >= _EMBEDDING_CACHE_MAX:
            oldest_key = next(iter(_embedding_cache))
            del _embedding_cache[oldest_key]
        _embedding_cache[cache_key] = result

    return result

def get_system_prompt(user_role: str = "student", context_present: bool = False) -> str:
    """Factory for Role-Specific and Strict-RAG System Prompts (Ultimate RAG v2)."""
    base_rules = """## CORE PRINCIPLES (NEVER VIOLATE):
1. Answer ONLY using information explicitly present in the <context> provided below. If the answer is NOT in the context, respond: "I could not find information about this in the available records. Please try rephrasing your query or provide a specific ID."
2. NEVER use your training knowledge to fill gaps. NEVER guess, infer, or fabricate information.
3. For follow-up questions, use conversation history to understand context, then still answer ONLY from the provided documents.

## IDENTITY VERIFICATION (CRITICAL):
4. BEFORE answering any query that contains an entity ID (which will appear as a privacy token like [ID:idx_0], [USER_ID:idx_0], [COMPANY:idx_0] due to anonymization), you MUST:
   a. Check ALL context records and confirm that the EXACT requested ID token appears in the data.
   b. If the context contains records for a DIFFERENT ID token (e.g., user asked for [ID:idx_0] but context has [ID:idx_1]), you MUST state clearly: "The records provided are for [found_token], not the requested [asked_token]. The exact record may not be indexed yet."
   c. NEVER present data from one entity as if it belongs to another. This is the most critical rule.
   d. NEVER say you couldn't find the raw string (e.g., PES1PG24CA169) because ALL raw strings have been replaced by these tokens. Verify using the tokens.

   IMPORTANT: Output adjacent PERSON tokens together as a full name: "[PERSON:idx_0] [PERSON:idx_1]". 
   - When asked for a "Name", look for [PERSON:idx_N] tokens in the context.

## PROFESSIONAL RESPONSE FORMAT (THE EXECUTIVE STANDARD):
8. **MANDATORY TABLE ARCHITECTURE**:
   - Use high-quality **HTML Tables** (<table>, <tr>, <th>, <td>) for ALL data presentation.
   - **CRITICAL**: Every activity (each Internship, each Placement) MUST have its own row in the table. 
   - Column layout for Professional Activity: | Category | Position | Organization | Duration/Status | Stipend/Salary |
   - Use simple, bold headers. DO NOT bunch data into a single cell with pipes (`|`).

9. **ENTITY PRIVACY (ZERO TOLERANCE)**:
   - **NEVER SHOW RAW IDs** (e.g., COMP_XXX, STU_XXX). If you see them, replace them with their Name or "[ID]".
   - IF A NAME IS RESOLVED (e.g., "Wipro"), SHOW ONLY "Wipro". DO NOT add brackets or ID suffixes.
   - If a salary or date appears unredacted in the context, REDACT IT YOURSELF to "[REDACTED]".

10. **EXECUTIVE MASTER PROFILE (VERBATIM ACCURACY)**:
    - Whenever "details" or "profile" is requested for an entity, you MUST provide a **Vertical Detailed Table** at the very top.
    - Format: | FIELD | VALUE |
    - **LIST EVERY FIELD** available in the record (e.g., First Name, Last Name, Email, Gender, DOB, Enrollment Date, Department, GPA, Phone, Address, Category, Home State, Admit Quota, Pesu Id, Batch).
    - **STRICT VALUE ASSOCIATION**: The value in the "VALUE" column MUST correspond to that specific field in the context. Never repeat the Name in the DOB or Phone field. If a field's value is unknown, show "[N/A]".
    - Result: Follow with Academic and Professional Activity tables.
    - End with a "Professional Outlook" section (1 sentence).

## UNIVERSAL DATA CHAINING:
11. ASSOCIATION ACCURACY: You must check ALL retrieved records. If a student record mentions an Internship ID, find the corresponding Internship row. If that row mentions a Company ID, find the Company Name. CHAIN THEM ALL.
12. CITATION: Reference source records naturally (e.g., "Verification: Master Profile #1, Placement Record #26").
[RECORD: 1]."""

    # Normalize role for consistent matching
    normalized_role = user_role.lower().strip() if isinstance(user_role, str) else 'student'

    if normalized_role == 'super_admin':
        role_desc = "You are the GLOBAL SYSTEM AUDITOR for a Privacy-Aware University Management System. You have overview access to all organizations and can analyze cross-departmental data. Provide executive-level insights."
        access_level = "FULL GLOBAL ACCESS"
    elif normalized_role == 'admin':
        role_desc = "You are the UNIVERSITY ADMINISTRATOR for a Privacy-Aware University Management System. You oversee campus data including students, faculty, placements, and department operations. Provide administrative insights and data-driven summaries."
        access_level = "CAMPUS-WIDE ACCESS"
    elif normalized_role == 'general':
        role_desc = "You are a PERSONAL GUIDANCE ASSISTANT for a Privacy-Aware Document Management System. You help the user navigate their private documents with precision and clarity."
        access_level = "PERSONAL ISOLATED ACCESS"
    else:
        role_desc = "You are a SECURE UNIVERSITY ASSISTANT for a Privacy-Aware University Management System. You help users find accurate information about students, faculty, courses, placements, internships, alumni, and departments from the university records. Be professional, thorough, and precise."
        access_level = "STUDENT PORTAL ACCESS"

    return f"{role_desc}\n\n{base_rules}\n\n[ACCESS LEVEL: {access_level}]\n\n"

def call_openai_chat(messages: List[Dict[str, str]], model: str = PRIMARY_MODEL) -> str:
    """Secure wrapper for OpenAI Chat completions."""
    if not openai:
        logger.error("OpenAI library not imported. Cannot call OpenAI chat.")
        return "ERROR: OpenAI service is not available."
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY is not set. Cannot call OpenAI chat.")
        return "ERROR: OpenAI API key is missing."

    try:
        # PII Redaction is expected to have happened before this call
        response = openai.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1, # Slight flexibility for natural, detailed responses
            max_tokens=2000  # Increased for comprehensive, detailed answers
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        return f"ERROR: Cloud reasoning failed. ({e})"

def _merge_split_name_fields(context: str) -> str:
    """
    Disable name merging as it causes AI confusion in vertical tables.
    We return the context as-is to ensure individual fields (Last Name, first_name)
    remain preserved for the AI to map correctly.
    """
    return context

def generate_chat_response(query: str, context: str, user_role: str = "student", conversation_history: list = None, privacy_level: str = "standard"):
    """
    Generate answer using either OpenAI or Ollama with Strict RAG Guardrails.
    
    Returns:
        tuple (response_text: str, context_pii_map: dict)
        The context_pii_map maps placeholder tokens like '[PERSON:idx_0]' to their original
        values (e.g., 'John Fritz'). This is built when redacting the context so the frontend
        can reveal real PII values when an admin clicks a badge.
    """

    # 1. Pre-flight Privacy Redaction (The Bread of the Sandwich)
    #    IMPORTANT: capture the pii_map from context redaction — this is the authoritative
    #    source for placeholder→real-value mappings that the LLM will echo in its response.
    pii_session_map = {}
    pii_session_counters = {}
    redacted_query = redact_text(query, pii_map=pii_session_map, counters=pii_session_counters, strictness=privacy_level)
    
    # ── Pre-process context: merge split name fields so Presidio sees full name ────
    # CSV rows are stored as "first_name: John | last_name: Fritz | ..."
    # Presidio detects "John" and "Fritz" as 2 separate PERSON entities → 2 tokens.
    # By combining them first, Presidio sees "John Fritz" as 1 entity → 1 token.
    # Use standard normalization (redact_text will handle ID preservation)
    normalized_context = _merge_split_name_fields(context)
    
    redacted_context, context_pii_map = redact_text(
        normalized_context, 
        return_map=True, 
        pii_map=pii_session_map, 
        counters=pii_session_counters, 
        strictness=privacy_level
    )
    logger.info(f"RAG SESSION: Consistent mapping for {len(context_pii_map)} entities. Query: {redacted_query[:50]}...")

    system_msg = get_system_prompt(user_role, bool(context))

    # Use OpenAI if configured
    use_openai = os.getenv("USE_OPENAI_CHAT", "FALSE").upper() == "TRUE" and OPENAI_API_KEY

    # Sliding window for conversation history (last 10 messages) to manage tokens
    active_history = conversation_history[-10:] if (conversation_history and len(conversation_history) > 0) else []

    if use_openai:
        logger.info(f"OpenAI Gateway: Sending REDACTED context (len={len(redacted_context)}) and query to cloud.")
        # DEBUG (Safe for FYP demo):
        logger.info(f"Anonymized Query: {redacted_query}")
        logger.info(f"Context Sample: {redacted_context[:500]}...")
        
        # Build messages array with conversation history for context continuity
        messages = [
            {"role": "system", "content": system_msg}
        ]
        
        # Add filtered history
        for msg in active_history:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                messages.append({
                    "role": msg["role"],
                    "content": redact_text(msg["content"], strictness=privacy_level)  # Redact PII from history too
                })
        
        # Add current query with document context
        messages.append({
            "role": "user", 
            "content": f"Context:\n{redacted_context}\n\nQuestion: {redacted_query}"
        })
        
        logger.info(f"OpenAI Call Messages: {json.dumps(messages)[:2000]}")
        raw_response = call_openai_chat(messages)
        logger.info(f"Raw OpenAI Response: {raw_response[:200]}...")
    else:
        # Fallback to Ollama (Local)
        logger.info(f"Using Local Ollama (Phi3) for role={user_role}")
        
        # Start prompt with system message and context
        prompt = f"<|im_start|>system\n{system_msg}\nContext:\n{redacted_context}\n<|im_end|>\n"
        
        # Add filtered history
        for msg in active_history:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                # Map roles (frontend might send 'user'/'ai' or 'user'/'assistant')
                role = "assistant" if msg["role"] in ["assistant", "ai"] else "user"
                safe_content = redact_text(msg["content"], strictness=privacy_level)
                prompt += f"<|im_start|>{role}\n{safe_content}\n<|im_end|>\n"
        
        # Add the current query
        prompt += f"<|im_start|>user\n{redacted_query}\n<|im_end|>\n<|im_start|>assistant\n"

        try:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "raw": True,
                "options": {"temperature": 0.1}
            }
            res = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=180)
            res.raise_for_status()
            raw_response = res.json().get("response", "")
        except Exception as e:
            logger.error(f"Local Ollama failed: {e}")
            raw_response = "I'm sorry, I encountered a local processing error."

    # 2. Post-flight Guardrails (The other Bread)
    if GuardrailManager and raw_response:
        guarded_response = GuardrailManager.post_process_response(raw_response)
        if guarded_response != raw_response:
             logger.info("GuardrailManager: Response was modified by post-flight guardrails.")
        return guarded_response, context_pii_map
    
    # Final safety pass — but do NOT discard the context_pii_map
    final_output = redact_text(raw_response, strictness=privacy_level)
    if final_output != raw_response:
        logger.info("redact_text: Final output was additionally anonymized.")
    return final_output, context_pii_map

def chromadb_add(ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[Dict] = None, collection=None):
    """Add documents to ChromaDB using Python client"""
    target_collection = collection or chroma_collection
    try:
        # Delete existing IDs to simulate upsert (compatible across Chroma versions)
        target_collection.delete(ids=ids)
    except Exception:
        pass
        
    target_collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

def chromadb_query(query_embeddings: List[List[float]], n_results: int = TOP_K, collection=None):
    """Query ChromaDB for most relevant documents using Python client"""
    target_collection = collection or chroma_collection
    print(f"SEARCHING with embeddings in collection: {target_collection.name}")
    results = target_collection.query(
        query_embeddings=query_embeddings,
        n_results=n_results
    )
    print(f"RAW RESULTS: {results}")
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
    """Extract text from various file formats (PDF, CSV, TXT, HTML).
    
    CSV files are parsed row-by-row, concatenating all field key-value pairs
    into a searchable text representation. This ensures every row and every
    field is fully indexed for search and chat retrieval.
    """
    try:
        lower_path = file_path.lower()
        
        if lower_path.endswith('.pdf'):
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        
        elif lower_path.endswith('.csv'):
            # Deep CSV extraction: read every row, every field
            rows_text = []
            filename_label = os.path.basename(file_path).replace('.csv', '').upper()
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                for row_idx, row in enumerate(reader):
                    row_parts = []
                    address_val = None
                    pincode_found = False
                    home_state_val = None
                    
                    for k, v in row.items():
                        if v and str(v).strip():
                            raw_key = str(k).strip()
                            key_lower = raw_key.lower()
                            
                            # Normalize header names
                            if key_lower == "sex":
                                clean_key = "Gender"
                            elif key_lower == "home_state":
                                clean_key = "Home State"
                            else:
                                clean_key = raw_key.replace('_', ' ').title()
                            
                            val = str(v).strip()
                            
                            # Normalize gender values
                            if key_lower in ("sex", "gender"):
                                v_lower = val.lower()
                                if v_lower in ("m", "male"):
                                    val = "Male"
                                elif v_lower in ("f", "female"):
                                    val = "Female"

                            row_parts.append(f"  {clean_key}: {val}")
                            
                            # Keep track of address and home state for enrichment
                            if clean_key.lower() == 'address':
                                address_val = val
                            if key_lower == "home_state":
                                home_state_val = val
                            if clean_key.lower() == 'pincode':
                                pincode_found = True
                    
                    # Logic to pull Pincode out of Address if not explicitly present
                    # This fulfills user request "if in data there is no pincode section please add"
                    if address_val and not pincode_found:
                        pins = re.findall(r'\b\d{6}\b', address_val)
                        if pins:
                            row_parts.append(f"  Pincode: {pins[0]}")

                    # Home State normalization:
                    # If a dedicated home_state column exists, we already captured it.
                    # Otherwise, attempt to infer state name/code from the address (word before pincode).
                    if not home_state_val and address_val:
                        m = re.search(r'([A-Za-z\s]+)\s+\d{6}\b', address_val)
                        if m:
                            # Take the last token before the pincode as a best-effort state indicator
                            state_candidate = m.group(1).strip().split()[-1]
                            if state_candidate:
                                home_state_val = state_candidate
                    if home_state_val:
                        row_parts.append(f"  Home State: {home_state_val}")

                    if row_parts:
                        # Use more descriptive RECORD labels based on filename (e.g., STUDENT RECORD 1)
                        record_type = filename_label.rstrip('S') # Plural to singular
                        rows_text.append(f"{record_type} RECORD {row_idx + 1}:\n" + "\n".join(row_parts) + "\n---")
            
            if rows_text:
                return "\n\n".join(rows_text)
            else:
                # Fallback: read raw text if DictReader found nothing
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()
        
        else:
            # Handle text files (TXT, HTML, etc.)
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
            conn = None
            
            try:
                # 1. Fetch encryption metadata from DB
                is_encrypted = False
                encrypted_dek = None
                encryption_iv = None
                encryption_tag = None
                doc_id = job_data.get("document_id")
                
                conn = get_conn()
                with conn.cursor() as cur:
                    if doc_id:
                        cur.execute("SELECT is_encrypted, encrypted_dek, encryption_iv, encryption_tag, metadata, filename FROM documents WHERE id = %s", (doc_id,))
                    else:
                        cur.execute("SELECT is_encrypted, encrypted_dek, encryption_iv, encryption_tag, metadata, filename FROM documents WHERE file_key = %s", (file_key,))
                    
                    row = cur.fetchone()
                    if row:
                        is_encrypted, encrypted_dek, encryption_iv, encryption_tag, db_metadata, db_filename = row

                # 2. Try MinIO download first
                try:
                    minio_client.fget_object(MINIO_BUCKET, file_key, temp_file_path)
                    logger.info(f"Downloaded {file_key} for processing (Encrypted: {is_encrypted})")

                    if is_encrypted:
                        if not CryptoManager:
                            raise ValueError("CryptoManager not available for decryption")
                        
                        logger.info(f"Decrypting file {file_key}...")
                        with open(temp_file_path, "rb") as f:
                            encrypted_data = f.read()
                        
                        decrypted_data = CryptoManager.decrypt_envelope(encrypted_data, encrypted_dek, encryption_iv, encryption_tag)
                        with open(temp_file_path, "wb") as f:
                            f.write(decrypted_data)

                    text_content = extract_text_from_file(temp_file_path)
                    source_info = file_key
                    
                    try: os.remove(temp_file_path)
                    except: pass

                except Exception as minio_err:
                    # 3. Fallback to DB Metadata (could be encrypted too)
                    logger.warning(f"File-based processing failed for {file_key}: {minio_err}. Using DB metadata...")
                    
                    if not row or not db_metadata:
                        logger.error(f"No metadata found to fall back for {file_key}")
                        return

                    metadata = db_metadata
                    if is_encrypted and isinstance(metadata, dict) and "encrypted_content" in metadata:
                        if not CryptoManager:
                            raise ValueError("CryptoManager not available for metadata decryption")
                        
                        logger.info(f"Decrypting metadata for {file_key}...")
                        encrypted_metadata_bytes = base64.b64decode(metadata["encrypted_content"])
                        decrypted_metadata_bytes = CryptoManager.decrypt_envelope(
                            encrypted_metadata_bytes, encrypted_dek, encryption_iv, encryption_tag
                        )
                        metadata = json.loads(decrypted_metadata_bytes.decode('utf-8'))

                    # Construct meaningful text from metadata
                    text_parts = [f"{k}: {v}" for k, v in metadata.items() if v and k not in ['record_type', 'source', 'row_index']]
                    text_content = " | ".join(text_parts)
                    if not text_content:
                        text_content = f"Document entry for {db_filename or file_key}"
                    source_info = f"DB Metadata: {db_filename or file_key}"

            except Exception as e:
                logger.error(f"Failed to process {file_key}: {e}")
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
                    for i, chunk in enumerate(batch_chunks):
                        # Extract potential Primary Entity ID for metadata bridging
                        # Pattern matches a wide range of campus identifiers
                        id_match = re.search(r'\b(PES|STU|RES|INT|COMP|FAC|PLC|CRS|DEPT|MCA|ALU)[A-Z0-9_]*\b', chunk, re.IGNORECASE)
                        primary_entity_id = id_match.group(0).upper() if id_match else ""
                        
                        metadatas.append({
                            "org_id": str(org_id) if org_id else "",
                            "organization": org_name,
                            "department": job_data.get("department", ""),
                            "user_category": job_data.get("user_category", ""),
                            "document_id": str(job_data.get("document_id", "")),
                            "filename": job_data.get("filename", ""),
                            "source_id": primary_entity_id, # Generic Bridging field for Student/Company/Faculty
                            "access_level": "general"
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

def start_retention_job():
    """Starts the daily data retention background job"""
    def retention_loop():
        while True:
            try:
                logger.info("[RETENTION] Running data lifecycle check...")
                conn = get_conn()
                with conn.cursor() as cur:
                    # 1. Identity purge: Find documents marked as 'deleted' or older than threshold
                    cur.execute("""
                        SELECT id, file_key, org_id
                        FROM documents 
                        WHERE status = 'deleted' 
                        OR (created_at < NOW() - INTERVAL '%s days' AND status = 'processed')
                    """, (RETENTION_DAYS,))
                    to_purge = cur.fetchall()

                    for doc_id, file_key, doc_org_id in to_purge:
                        logger.info(f"[RETENTION] Purging document: {file_key}")
                        
                        # A. Remove from MinIO
                        try:
                            minio_client.remove_object(MINIO_BUCKET, file_key)
                        except Exception as e:
                            logger.error(f"[RETENTION] Failed to remove {file_key} from MinIO: {e}")

                        # B. Remove from ChromaDB
                        try:
                            # Use org_id to get collection
                            org_col = get_org_collection(org_id=doc_org_id)
                            org_col.delete(where={"document_id": str(doc_id)})
                        except Exception as e:
                            logger.error(f"[RETENTION] Failed to remove {file_key} from Chroma: {e}")

                        # C. Finally delete from Postgres
                        cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
                    
                conn.commit()
                put_conn(conn)
                logger.info(f"[RETENTION] Purge complete. Processed {len(to_purge)} documents.")
            except Exception as e:
                logger.error(f"[RETENTION] Job error: {e}")
            
            # Wait 24 hours
            time.sleep(86400)

    thread = Thread(target=retention_loop, daemon=True)
    thread.start()

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

@app.post("/redact")
def redact_api_endpoint(request: RedactionRequest):
    """
    Standardize PII redaction endpoint.
    internal_only=True: Skips structural ID redaction (keeps raw USNs/Placements for joins).
    internal_only=False: Redacts EVERYTHING to secure badges (for UI display).
    """
    try:
        redacted_text = redact_text(request.text, internal_only=request.internal_only)
        return {"redacted_text": redacted_text}
    except Exception as e:
        logger.error(f"Redaction API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # 0. SECURITY FIREWALL (Prompt Injection Guardrails)
        # Logging is handled by the Node.js API gateway (which has user context) to avoid duplication
        if scan_prompt(raw_query):
            logger.warning(f"[SECURITY] Blocked malicious jailbreak attempt in /search from User {request.user_id}")
            raise HTTPException(status_code=403, detail="Security Warning: Malicious Prompt Detected. Action logged.")
            
        query_redacted = redact_text(raw_query)
        query_hash = hash_query(raw_query)

        # Initialize Org Collection and Filters
        org_id = request.org_id
        org_collection = get_org_collection(org_id=org_id)
        
        # Access Level RBAC - Disabled until model is updated
        where_filter = None
        
        fetch_k = request.top_k or 15
        depth_k = 150 # Increased significantly to find demographic data in crowded datasets

        # 0.0 TARGETED ID ROUTING (Prefer exact ID, but allow graceful fallback)
        # If the user provides a concrete entity ID (e.g., PES1PG24CA169),
        # we first try metadata-based lookup on `source_id`, then exact keyword search.
        # If nothing is found, we LOG the miss but DO NOT hard-block the search:
        # we fall back to the standard semantic + variant search pipeline so that
        # records that lack source_id metadata can still be discovered.
        id_candidates = []
        ALL_PREFIXES_ID_ROUTING = ["STU", "RES", "INT", "PES", "COMP", "FAC", "PLC", "CRS", "DEPT", "ALU", "USR", "MCA"]
        words_upper = re.findall(r'[A-Z0-9_]+', raw_query.upper())
        for word in words_upper:
            if any(word.startswith(p) for p in ALL_PREFIXES_ID_ROUTING) and any(c.isdigit() for c in word):
                if word not in id_candidates:
                    id_candidates.append(word)

        if id_candidates:
            asked_id = id_candidates[0]
            exact_docs = []

            # (A) Metadata-based lookup by source_id
            try:
                meta_results = org_collection.get(
                    where={"source_id": asked_id},
                    limit=fetch_k,
                    include=["documents", "metadatas"]
                )
            except Exception as e:
                logger.error(f"ID Routing: metadata lookup failed for {asked_id}: {e}")
                meta_results = None

            id_word_pattern = re.compile(rf'\b{re.escape(asked_id)}\b', re.IGNORECASE)

            if meta_results and meta_results.get("documents"):
                for doc in meta_results["documents"]:
                    # Some Chroma versions may return nested lists; normalize to strings
                    if isinstance(doc, list):
                        for d_txt in doc:
                            if isinstance(d_txt, str) and id_word_pattern.search(d_txt):
                                exact_docs.append(d_txt)
                    elif isinstance(doc, str) and id_word_pattern.search(doc):
                        exact_docs.append(doc)

            # (B) Fallback: exact keyword search on document text
            if not exact_docs:
                try:
                    kw_results = org_collection.get(
                        where_document={"$contains": asked_id},
                        limit=150,
                        include=["documents", "metadatas"]
                    )
                except Exception as e:
                    logger.error(f"ID Routing: keyword lookup failed for {asked_id}: {e}")
                    kw_results = None

                if kw_results and kw_results.get("documents"):
                    for doc in kw_results["documents"]:
                        if isinstance(doc, list):
                            for d_txt in doc:
                                if isinstance(d_txt, str) and id_word_pattern.search(d_txt):
                                    exact_docs.append(d_txt)
                        elif isinstance(doc, str) and id_word_pattern.search(doc):
                            exact_docs.append(doc)

            # (C) If we found any exact-ID records, short-circuit the rest of the pipeline.
            if exact_docs:
                logger.info(f"ID Routing: Resolved exact records for ID '{asked_id}' (count={len(exact_docs)})")
                documents = [
                    DocumentChunk(
                        id=f"id_meta_{asked_id}_{idx}",
                        text=txt,
                        # PRIORITY: Force demographic data to the very top if it's from students.csv
                        score=1.0 if "first_name:" in txt.lower() or "gender:" in txt.lower() else 0.99
                    )
                    for idx, txt in enumerate(exact_docs[:fetch_k])
                ]
                filtered = documents
                doc_ids_local = [d.id for d in filtered]

                # Build audit-style details (kept for parity with main flow)
                details = {
                    "query_hash": query_hash,
                    "query_redacted": query_redacted,
                    "result_count": len(filtered),
                    "document_ids": doc_ids_local
                }

                return {
                    "query": raw_query,
                    "query_redacted": query_redacted,
                    "query_hash": query_hash,
                    "results": filtered,
                    "total_found": len(filtered)
                }

            # (D) No exact match for the asked ID.
            # Relaxed firewall: log the miss, but continue into the standard
            # semantic + hybrid search path so that text-only records are still
            # discoverable (important for partially-ingested orgs like PES).
            logger.warning(f"ID Routing: No exact records found for '{asked_id}'. Falling back to semantic search pipeline.")

        # 0.1 Intent-Based Query Expansion (Phase 11)
        search_variants = generate_search_variants(raw_query)
        logger.info(f"SEARCH EXPANSION: Generated {len(search_variants)} variants: {search_variants}")

        # Final results aggregator
        final_chunks = []
        seen_texts = set()
        doc_ids = []

        for variant in search_variants:
            v_embedding = get_embedding(variant)
            if not v_embedding: continue

            # Query ChromaDB with current variant
            if where_filter:
                v_results = org_collection.query(
                    query_embeddings=[v_embedding],
                    n_results=depth_k,
                    include=["documents", "metadatas", "distances"],
                    where=where_filter
                )
            else:
                v_results = chromadb_query([v_embedding], depth_k, collection=org_collection)

            if v_results and v_results.get("documents") and v_results["documents"][0]:
                for i in range(len(v_results["documents"][0])):
                    txt = v_results["documents"][0][i]
                    if txt not in seen_texts:
                        dist = float(v_results["distances"][0][i]) if v_results.get("distances") else 0.5
                        rid = v_results["ids"][0][i]
                        # Score: Rational kernel sigma=500
                        score = 500.0 / (500.0 + dist)
                        final_chunks.append(DocumentChunk(id=rid, text=txt, score=score))
                        doc_ids.append(rid)
                        seen_texts.add(txt)

        # 0.2 HYBRID SEARCH: Exact Entity-ID Matching (Identity Firewall)
        # Covers ALL entity types: Students, Faculty, Alumni, Companies, Departments, etc.
        exact_id_found = False
        try:
            potential_ids = []
            # Extract potential entity IDs using expanded prefix list
            ALL_PREFIXES = ["STU", "RES", "INT", "PES", "COMP", "FAC", "PLC", "CRS", "DEPT", "ALU", "USR", "MCA"]
            words = re.findall(r'[A-Z0-9_]+', raw_query.upper())
            for word in words:
                if any(p in word for p in ALL_PREFIXES) and any(c.isdigit() for c in word):
                    if word not in potential_ids:
                        potential_ids.append(word)
            
            if potential_ids:
                logger.info(f"Identity Firewall: Exact-matching IDs: {potential_ids}")
                for keyword in potential_ids[:3]:
                    # Step 1: Broad fetch using $contains (Increased limit for Global Chaining)
                    kw_results = org_collection.get(where_document={"$contains": keyword}, limit=150, include=["metadatas", "documents"])
                    if kw_results and kw_results.get("ids"):
                        # Step 2: POST-FILTER — only keep records where the EXACT full ID appears as a whole word
                        exact_pattern = re.compile(rf'\b{re.escape(keyword)}\b', re.IGNORECASE)
                        for idx, rid in enumerate(kw_results["ids"]):
                            txt = kw_results["documents"][idx]
                            if exact_pattern.search(txt) and rid not in doc_ids and txt not in seen_texts:
                                final_chunks.append(DocumentChunk(id=rid, text=txt, score=0.97))
                                doc_ids.append(rid)
                                seen_texts.add(txt)
                                exact_id_found = True
                        
                        if exact_id_found:
                            logger.info(f"Identity Firewall: Found exact matches for '{keyword}'. Filtering vector noise.")
        except Exception as e:
            logger.error(f"Hybrid Search Error: {e}")

        # IDENTITY FIREWALL: If exact ID matches were found, remove vector search results
        # that DON'T contain the queried ID — these are "neighbor noise" that causes mismatches.
        if exact_id_found and potential_ids:
            filtered_chunks = []
            for chunk in final_chunks:
                # Always keep all exact-match results (score >= 0.97) unconditionally
                if chunk.score >= 0.97:
                    filtered_chunks.append(chunk)
                    continue
                # For vector results, only keep if they contain at least one queried ID
                keep = False
                for pid in potential_ids:
                    if re.search(rf'\b{re.escape(pid)}\b', chunk.text, re.IGNORECASE):
                        keep = True
                        break
                if keep:
                    filtered_chunks.append(chunk)
                else:
                    logger.info(f"Identity Firewall: Discarded noise vector result (id={chunk.id})")
        # 0.3 RECORD ISOLATION: Prevent "Neighbor Pollution"
        # If we have exact IDs, split chunks into individual records and keep ONLY the relevant blocks.
        if potential_ids:
            logger.info(f"Record Isolation: Filtering {len(final_chunks)} chunks for {potential_ids}")
            isolated_chunks = []
            for chunk in final_chunks:
                if chunk.score >= 0.99 or chunk.id.startswith("resolve_"):
                    isolated_chunks.append(chunk)
                    continue
                
                # Split chunk by standard record delimiters
                blocks = re.split(r'---|(?=RECORD \d+:)', chunk.text)
                relevant_blocks = []
                for block in blocks:
                    if any(re.search(rf'\b{re.escape(pid)}\b', block, re.IGNORECASE) for pid in potential_ids):
                        relevant_blocks.append(block.strip())
                
                if relevant_blocks:
                    chunk.text = "\n---\n".join(relevant_blocks)
                    isolated_chunks.append(chunk)
                    logger.info(f"Record Isolation: Kept {len(relevant_blocks)} blocks from chunk {chunk.id}")
            documents = isolated_chunks
        else:
            documents = final_chunks

        # --- RECURSIVE ENTITY RESOLUTION (Phase 6.3: MULTI-HOP) ---
        # Implement 3-pass resolution to handle deep links (Student -> Internship -> Company)
        ID_PURGE_REGEX = re.compile(r'\b(?:COMP|STU|PES|INT|PLC|FAC|USR|RES|ALU|MCA|CRS|DEPT|BATCH)[A-Z0-9_\-]*[0-9]{2,}\b', re.IGNORECASE)
        try:
            hops_completed = 0
            while hops_completed < 3:
                entity_hop_ids = set()
                for d in documents:
                    # Find Company, Faculty, Course, and Dept IDs
                    found = re.findall(r'\b(?:COMP|FAC|CRS|DEPT|STU|RES|INT|PLC|MCA|USR)[A-Z0-9_]*[0-9]{2,}\b', d.text, re.IGNORECASE)
                    for f in found:
                        fid = f.upper()
                        # Only hop if we haven't already resolved this EXACT ID this session
                        if fid not in doc_ids and f"resolve_{fid}" not in doc_ids:
                            entity_hop_ids.add(fid)
                
                if not entity_hop_ids:
                    break
                    
                logger.info(f"Recursive Retrieval (Pass {hops_completed+1}): Resolving {entity_hop_ids}")
                new_hop_found = False
                
                # Increase limit to handle larger datasets, prioritizing non-result IDs if needed
                # But for now, just increasing the cap to 100
                for hop_id in sorted(list(entity_hop_ids))[:100]:
                    lookup_id_stripped = re.sub(r'_(MCA|CSE|ISE|ECE|EEE|BME|BMS)', '', hop_id)
                    # VANTABLACK RESOLVER: Use metadata filtering specifically for Company/Faculty master records
                    where_filter = {"source_id": {"$in": [hop_id, lookup_id_stripped]}}
                    # If it's a COMP ID, prioritize records with record_type 'company'
                    if hop_id.startswith("COMP"):
                        # We try to get the specific company record first
                        hop_results = org_collection.get(
                            where={"$and": [where_filter, {"record_type": "company"}]},
                            limit=1,
                            include=["documents"]
                        )
                    else:
                        hop_results = org_collection.get(
                            where=where_filter,
                            limit=1,
                            include=["documents"]
                        )
                    
                    hop_doc = None
                    hop_id_val = f"resolve_{hop_id}"
                    
                    if hop_results and hop_results.get("ids") and len(hop_results["ids"]) > 0:
                        hop_doc = hop_results["documents"][0]
                    else:
                        # FALLBACK: Keyword search for both full and stripped ID
                        # Try full ID first as it's more specific
                        search_ids = [hop_id]
                        if lookup_id_stripped != hop_id:
                            search_ids.append(lookup_id_stripped)
                        
                        for sid in search_ids:
                            logger.info(f"Recursive Retrieval: Attempting Keyword Fallback for {sid}")
                            hop_emb = get_embedding(sid)
                            kw_results = org_collection.query(
                                query_embeddings=[hop_emb],
                                n_results=1,
                                where_document={"$contains": sid}
                            )
                            if kw_results and kw_results.get("ids") and kw_results.get("documents") and len(kw_results["documents"][0]) > 0:
                                fallback_text = kw_results["documents"][0][0]
                                if re.search(rf'\b{re.escape(sid)}\b', fallback_text, re.IGNORECASE):
                                    hop_doc = fallback_text
                                    hop_id_val = f"resolve_kw_{hop_id}"
                                    break

                        if hop_doc and hop_id_val not in doc_ids:
                            new_hop_found = True
                            resolved_name = "REDACTED_ENTITY"
                            
                            # RECORD ISOLATION: Split batch chunk into individual records
                            # Identify the specific block containing the target ID
                            temp_records = re.split(r'---|\bRECORD \d+:', hop_doc)
                            target_block = hop_doc # Fallback to full doc
                            for block in temp_records:
                                if re.search(rf'\b{re.escape(hop_id)}\b', block, re.IGNORECASE):
                                    target_block = block
                                    break
                                    
                            # Improved Name Extraction from the specific block
                            hop_parts = re.split(r'[,||\n]', target_block) 
                            forbidden_values = ["ID", "id", "PES", "STU", "RES", "INT", "COMP", "FAC", "PLC", "CRS", "DEPT", "MCA", "ALU", "USR", "BATCH", "RECORD", "POSITION", "STATUS", "STIPEND", "SALARY", "LOCATION", "INDUSTRY"]
                            
                            # Target labels based on ID prefix for maximum accuracy
                            target_labels = ["name", "title", "company name", "organization"]
                            if hop_id.startswith("COMP"):
                                target_labels = ["company name", "name", "company", "organization"]
                            
                            # Priority forbid list for values (words that are NEVER names)
                            forbidden_values = ["ID", "id", "PES", "STU", "RES", "INT", "COMP", "FAC", "PLC", "CRS", "DEPT", "MCA", "ALU", "USR", "BATCH", "RECORD", "POSITION", "STATUS", "STIPEND", "SALARY", "LOCATION", "INDUSTRY", "SDE", "INTERN", "COMPLETED", "PLACED"]
                            
                            for part in hop_parts:
                                clean_part = part.strip()
                                if ":" in clean_part:
                                    try:
                                        label, val = clean_part.split(":", 1)
                                        label = label.lower()
                                        val = val.strip()
                                        
                                        # Match label "name" or "company"
                                        # CRITICAL: If prefix is COMP, ensure length is > 1 and not a position
                                        if any(tl in label for tl in target_labels) and "id" not in label:
                                            # STRICT CHECK: Must not be a position/status or purely numeric
                                            u_val = val.upper()
                                            if val and val != "REDACTED_ENTITY" and not any(p in u_val for p in ["SDE", "DEVELOPER", "INTERN", "POSITION", "STATUS", "ROLE", "TITLE"]):
                                                # AGGRESSIVE NUMERIC CHECK: Forbid values that look like amounts or IDs
                                                if not re.search(r'^\d+$|[\d,]{4,}|Rs\.|INR|LPA|CTC|Pincode', val, re.IGNORECASE):
                                                    if len(val.split()) <= 4 and len(val) > 1:
                                                        resolved_name = val
                                                        break
                                    except: continue
                            
                            # Fallback: MUST be a real name, not a role or a generic title
                            if resolved_name == "REDACTED_ENTITY":
                                sub_parts = re.split(r'[,|:\n]', target_block)
                                for p in sub_parts:
                                    clean_p = p.strip()
                                    u_p = clean_p.upper()
                                    # Strict fallback: No SDE, No Intern, No Status words, NO NUMBERS
                                    if len(clean_p) > 3 and not any(x in u_p for x in forbidden_values + ["SDE", "ENGINEER", "DEVELOPER", "ROLE", "QUOTA", "MANAGEMENT", "MERIT"]):
                                        # Reject purely numeric/currency strings in fallback too
                                        if not re.search(r'^\d+$|[\d,]{4,}|Rs\.|INR|LPA|CTC|Pincode', clean_p, re.IGNORECASE):
                                            if not any(x in u_p for x in ["INTERN", "PLACED", "COMPLETED", "STATUS"]):
                                                resolved_name = clean_p
                                                break
                                        
                            if resolved_name.upper() == hop_id.upper() or len(resolved_name) < 2:
                                resolved_name = "REDACTED_ENTITY"

                        # In-Place Source Enrichment (CLEAN VERSION: NO RAW IDS)
                        if resolved_name and resolved_name != "REDACTED_ENTITY":
                            logger.info(f"Recursive Retrieval: Resolved {hop_id} -> {resolved_name}")
                            replacement_count = 0
                            for d_idx in range(len(documents)):
                                # ENHANCEMENT: Keep original ID for AI verification while enriching with Name
                                documents[d_idx].text = re.sub(rf'\b{re.escape(hop_id)}\b', f"{hop_id} ({resolved_name})", documents[d_idx].text)
                                if before_text != documents[d_idx].text:
                                    replacement_count += 1
                        else:
                            logger.info(f"Recursive Retrieval: No name found for {hop_id}")

                        # Prepare record for context (Names are already enriched)
                        clean_hop_doc = hop_doc
                        documents.append(DocumentChunk(id=hop_id_val, text=f"[RELIABLE_NAME_RESOLUTION]: {resolved_name} is the name for the entity mentioned in other records. Details: {clean_hop_doc}", score=0.99))
                        doc_ids.append(hop_id_val)
                
                if not new_hop_found:
                    break
                hops_completed += 1
        except Exception as e:
            logger.error(f"Recursive Retrieval Error: {e}")

        # FINAL IDENTITY CLEANUP: After recursive resolution, some resolved entity documents
        # may mention OTHER student IDs (e.g., a company record that lists multiple students).
        # Remove these noise documents to ensure the AI only sees the queried student's data.
        if exact_id_found and potential_ids:
            clean_documents = []
            for d in documents:
                # Always keep system-resolved metadata blocks (they provide names for IDs)
                if d.id and (d.id.startswith("resolve_") or "[RELIABLE_NAME_RESOLUTION]" in d.text):
                    clean_documents.append(d)
                    continue
                # For all other documents, verify they contain at least one queried ID
                keep = False
                for pid in potential_ids:
                    if re.search(rf'\b{re.escape(pid)}\b', d.text, re.IGNORECASE):
                        keep = True
                        break
                # RELAXED FIREWALL: If a document is extremely high score, keep it even if ID isn't found (might be contextually relevant)
                if keep or (hasattr(d, 'score') and d.score > 0.98):
                    clean_documents.append(d)
            documents = clean_documents
            logger.info(f"Identity Firewall (Final): {len(documents)} clean documents remain.")

        # --- FINAL CLEANUP ---
        # Names are already resolved in-place. We rely on redact_text to hide any missed IDs.
        for d in documents:
            # Clean up artifacts like "( : AMD)" or similar if they formed
            d.text = d.text.replace("( : )", "").replace("(: )", "")

        # Apply Differential Privacy if enabled
        if request.dp_enabled and DifferentialPrivacy:
            documents = DifferentialPrivacy.apply_noise(documents, request.top_k)

        filtered = documents 

        # Build audit details
        details = {
            "query_hash": query_hash,
            "query_redacted": query_redacted,
            "result_count": len(filtered),
            "document_ids": doc_ids
        }

        # No insert_audit_log here because Node.js API Gateway (chat.js / search.js) 
        # handles the authoritative auditing and prevents double-logging.

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
        raise HTTPException(status_code=500, detail=str(e))

# --- Smart Query Builder (Phase 6.1: Advanced Entity-Aware Context) ---
def build_search_query(message: str, history: list) -> str:
    """
    For follow-up questions like 'How many days?' or 'What are his scores?',
    we scan history for entity identifiers (IDs, names) to 'bridge' the context
    into the current retrieval query.
    """
    if not history or len(history) == 0:
        return message

    # 1. Extract potential identifiers from recent history
    context_ids = set()
    context_names = set()
    
    # Analyze recent turns (last 6 messages) for active entities
    recent_history = history[-6:]
    for h in recent_history:
        content = h.get("content", "") if isinstance(h, dict) else ""
        if not content: continue
        
        # Extract IDs: PES..., STU..., RES..., INT..., COMP..., PLC..., FAC...
        for m in re.finditer(r'\b(PES|STU|RES|INT|PLC|COMP|FAC|CRS|DEPT|MCA|ALU|USR)[A-Z0-9_\-]*\b', content, re.IGNORECASE):
            found_id = m.group(0).upper()
            context_ids.add(found_id)
            logger.info(f"BRIDGE: Found ID '{found_id}' in history turn.")
            
        # Extract potential Names (Title Case sequences)
        # This helps bridge names mentioned in previous turn to IDs in current turn
        # matches 2+ words starting with capital letters
        for name in re.finditer(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', content):
            found_name = name.group(0)
            context_names.add(found_name)
            logger.info(f"BRIDGE: Found Name '{found_name}' in history turn.")
            
        # Extract course acronyms (e.g., OS, DBMS, ML, AI)
        for acronym in re.finditer(r'\b(OS|DBMS|ML|AI|CN|DSA|OOP)\b', content):
            found_acronym = acronym.group(0)
            context_names.add(found_acronym)
            logger.info(f"BRIDGE: Found Acronym '{found_acronym}' in history turn.")

    # 2. Decision: Is this a follow-up?
    pronouns = ["he", "she", "him", "her", "they", "them", "his", "hers", "their", "it", "who", "where", "what", "which"]
    targets = ["score", "mark", "grade", "detail", "result", "address", "phone", "email", "internship", "placement", "placed", "teach", "study", "lives"]
    message_lower = message.lower()
    
    is_follow_up = (
        len(message.split()) < 12 or 
        any(f" {p} " in f" {message_lower} " for p in pronouns) or 
        any(t in message_lower for t in targets) or
        re.search(r'\b(he|she|it|his|her|they|their)\b', message_lower)
    )
    
    logger.info(f"BRIDGE: is_follow_up={is_follow_up}, context_ids={list(context_ids)}, context_names={list(context_names)}")
    
    if is_follow_up and (context_ids or context_names):
        # ACTIVE MEMORY INJECTION: Ensure contextual IDs are prioritized
        parts = []
        # Inject most relevant context IDs first
        for cid in context_ids:
            if cid.lower() not in message_lower:
                parts.append(cid)
        
        # Inject Names
        for nm in context_names:
            if nm.lower() not in message_lower:
                parts.append(nm)
                
        parts.append(message)
        combined = " ".join(parts)
        logger.info(f"SMART QUERY (Universal Chain): Injected {len(parts)-1} context entities. Combined: '{combined}'")
        return combined

    return message

# --- Relationship Resolution (Phase 10: RRR) ---
def recursive_resolve_links(initial_results: list, org_id: int, user_role: str, user_id: str, organization: str) -> list:
    """
    Scans retrieved text for 'Bridge IDs' (PLC_, COMP_, FAC_) and automatically
    fetches related records to provide the LLM with a 360-degree view.
    """
    if not initial_results: return initial_results
    
    found_bridge_ids = set()
    existing_ids = set()
    
    # 1. Collect all IDs in the current context
    for r in initial_results:
        text = r.get("text", "")
        # Look for potential entity bridges (now includes PES + ALU for student/master records)
        for m in re.finditer(r'\b(PLC|COMP|FAC|STU|CRS|DEPT|MCA|USR|PES|ALU)[A-Z0-9_\-]*\b', text, re.IGNORECASE):
            found_bridge_ids.add(m.group(0).upper())
        
        # Track what we already have to avoid infinite recursion or redundancy
        if r.get("metadata") and r["metadata"].get("doc_id"):
            existing_ids.add(str(r["metadata"]["doc_id"]))

    if not found_bridge_ids:
        return initial_results
    
    logger.info(f"RRR: Detected {len(found_bridge_ids)} potential bridge IDs in initial results: {list(found_bridge_ids)[:5]}")
    
    # 2. Perform a second-pass search for THESE specific IDs
    # We use a keyword-first search, prioritizing MASTER/STUDENT/ALUMNI records,
    # then fall back to semantic embeddings if needed.
    enriched_results = list(initial_results)
    
    for bridge_id in found_bridge_ids:
        # Avoid re-fetching bridge IDs that are essentially the same as the query or already present
        # But we want to be aggressive in fetching 'Master' details (e.g. Company name/address)
        try:
            org_col = get_org_collection(org_id=org_id, org_name=organization, user_role=user_role)

            linked_batch = None
            master_idx = 0

            # (A) Keyword-based query_texts search (preferred for exact IDs)
            try:
                linked_batch = org_col.query(
                    query_texts=[bridge_id],
                    n_results=5,
                    include=["documents", "metadatas", "distances"],
                )
            except TypeError:
                # Older Chroma versions may not support query_texts; fall back to embeddings.
                query_emb = get_embedding(bridge_id)
                if not query_emb:
                    continue
                linked_batch = org_col.query(
                    query_embeddings=[query_emb],
                    n_results=5,
                    include=["documents", "metadatas", "distances"],
                )

            if linked_batch and linked_batch.get("documents") and linked_batch["documents"][0]:
                docs = linked_batch["documents"][0]
                metas = linked_batch.get("metadatas", [[{}]])[0]

                # Prefer MASTER/STUDENT/ALUMNI records when available
                master_keywords = ("MASTER RECORD", "STUDENT RECORD", "ALUMNI RECORD")
                chosen_text = None
                chosen_meta = None

                for idx, txt in enumerate(docs):
                    if not isinstance(txt, str):
                        continue
                    upper_txt = txt.upper()
                    if all(k in upper_txt for k in ("RECORD", bridge_id.upper())) and any(
                        mk in upper_txt for mk in master_keywords
                    ):
                        chosen_text = txt
                        chosen_meta = metas[idx] if idx < len(metas) else {}
                        master_idx = idx
                        break

                # Fallback to the first document if no explicit master record is detected
                if chosen_text is None:
                    chosen_text = docs[0]
                    chosen_meta = metas[0] if metas else {}

                # Check if this record is already in our results to avoid duplication
                if chosen_meta.get("doc_id") and str(chosen_meta["doc_id"]) in existing_ids:
                    continue

                logger.info(f"RRR: Successfully linked record for '{bridge_id}' (idx={master_idx})")
                enriched_results.append({
                    "text": f"[RELATIONSHIP BRIDGE: {bridge_id}]\n{chosen_text}",
                    "metadata": chosen_meta,
                    # Lower score → higher priority when later sorted/considered
                    "score": 0.05,
                    "id": f"bridge_{bridge_id}"
                })
                existing_ids.add(str(chosen_meta.get("doc_id", "link")))
                
        except Exception as e:
            logger.warning(f"RRR: Failed to resolve link for '{bridge_id}': {e}")
            
    return enriched_results

# --- Query Expansion (Phase 11: Intent-Based Search) ---
def generate_search_variants(query: str) -> List[str]:
    """
    Intent-based search expansion for all entity types.
    Generates semantic variants to catch indirect questions across the full dataset.
    """
    variants = [query]
    query_lower = query.lower()
    
    # Rule-based expansion for common intent patterns
    if "teach" in query_lower or "professor" in query_lower or "instructor" in query_lower:
        variants.extend(["Faculty teaching course", "Department head and instructors", "faculty_id course assignment"])
    
    if "hod" in query_lower or "head of department" in query_lower:
        variants.extend(["Department head", "Faculty HOD designation", "department_id head"])
    
    # Curated expansion map for University data — covers ALL entity types
    expansion_map = {
        "placement": ["placement record", "salary package", "job position", "company placed", "placement_id"],
        "internship": ["internship record", "stipend", "intern position", "company internship", "internship_id"],
        "scores": ["result record", "semester results", "academic grade", "course marks", "GPA score"],
        "marks": ["result record", "semester results", "academic grade", "course score"],
        "result": ["result record", "semester grade", "academic performance", "result_id"],
        "salary": ["placement salary", "package CTC", "annual compensation", "highest salary"],
        "company": ["company record", "placement company", "employer details", "company_id"],
        "faculty": ["faculty record", "professor details", "teaching staff", "faculty_id"],
        "alumni": ["alumni record", "graduated student", "alumni details", "alumni_id"],
        "department": ["department record", "dept details", "department_id", "MCA department"],
        "course": ["course record", "subject details", "course_id", "semester course"],
        "details": ["full profile", "contact information", "placement summary", "internship history", "academic record", "student master info"],
        "detail": ["full profile", "contact information", "placement summary", "internship history", "academic record", "student master info"],
        "highest": ["maximum value", "top performer", "best score", "rank 1"],
        "topper": ["highest score", "top performer", "best GPA", "rank 1 student"],
        "compare": ["comparison", "versus", "difference between", "side by side"],
    }
    
    for key, terms in expansion_map.items():
        if key in query_lower:
            variants.extend(terms)
            
    return list(set(variants))[:4]  # Slightly increased from 3 for better coverage


@app.post("/chat")
async def chat_with_documents(req: Request):
    """Robust chat endpoint"""
    logger.info("DEBUG_MARKER_ENDPOINT_START")
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
        org_id = None
        user_id = None
        organization = "default"
        user_role = "student"

        if isinstance(body, dict):
            query = body.get("query") or body.get("message") or body.get("prompt") or None
            context = body.get("context", None)
            conversation_history = body.get("conversation_history",  [])  # For follow-up questions
            org_id = body.get("org_id")
            user_id = body.get("user_id")
            organization = body.get("organization") or "default"
            user_role = body.get("user_role") or body.get("role", "student")
            privacy_level = body.get("privacy_level", "standard")
        else:
            query = None
            context = None
            privacy_level = "standard"

        if not query or not isinstance(query, str) or not query.strip():
            # Differentiate missing vs malformed
            raise HTTPException(status_code=400, detail="Missing required 'query' (also accepts 'message' or 'prompt'). The request body must be JSON.")

        query = query.strip()

        # 0. SECURITY FIREWALL (Prompt Injection Guardrails)
        # Logging is handled by the Node.js API gateway (which has user context) to avoid duplication
        if scan_prompt(query):
            logger.warning(f"[SECURITY] Blocked malicious jailbreak attempt in /chat from User {user_id}")
            raise HTTPException(status_code=403, detail="Security Warning: Malicious Prompt Detected. Action logged.")

        # Phase 3 Guardrails: Query Safety Check
        if GuardrailManager:
            is_safe, error_msg = GuardrailManager.check_query(query)
            if not is_safe:
                return {
                    "query": query,
                    "response": error_msg,
                    "context_used": False,
                    "status": "blocked"
                }

        # Build context if not provided
        if not context:
            try:
                # Dynamic top_k based on role: Admins need more context for aggregate analysis/trends
                # Increased values for more comprehensive, accurate responses
                admin_roles = ['admin', 'super_admin']
                is_admin = user_role in admin_roles
                k_val = 20 if is_admin else 10  # Increased from 12/5 for better context
                
                # Phase 6.1: Smart Query Builder — use conversation history for better retrieval
                search_query = build_search_query(query, conversation_history)
                logger.info(f"CHAT: building context for role={user_role}, using top_k={k_val}, search_query='{search_query[:80]}...'")
                
                sr = SearchRequest(
                    query=search_query, 
                    top_k=k_val, 
                    org_id=org_id, 
                    organization=organization,
                    user_role=user_role,
                    user_id=user_id
                )
                search_results = search_documents(sr)

                # Build initial result objects for relationship resolution
                initial_results = []
                if isinstance(search_results, dict) and "results" in search_results:
                    for r in search_results["results"]:
                        if hasattr(r, "text"):
                            txt = r.text
                            sc = getattr(r, "score", 0.5)
                        elif isinstance(r, dict):
                            txt = r.get("text", "")
                            sc = r.get("score", 0.5)
                        else:
                            txt = ""
                            sc = 0.5
                        if txt:
                            initial_results.append({"text": txt, "metadata": {}, "score": sc})

                # Phase 10: Relationship Resolution (RRR) — enrich with linked master/company records
                enriched_results = recursive_resolve_links(
                    initial_results,
                    org_id=org_id,
                    user_role=user_role,
                    user_id=user_id,
                    organization=organization or "default",
                )

                # Build context with clear record separators for better Reasoning
                context_parts = []
                for idx, r in enumerate(enriched_results):
                    chunk_text = r.get("text", "")
                    if chunk_text:
                        context_parts.append(f"DOCUMENT RECORD {idx+1}:\n{chunk_text}\n---")
                
                context = "\n\n".join(context_parts)
                logger.info(f"CHAT: Final context assembly complete. {len(context_parts)} records. Total len: {len(context)}")
                if context:
                    logger.info(f"ASSEMELD CONTEXT (1000 chars): {context[:1000]}")
            except Exception as e:
                logger.exception("Chat: unexpected error while building context: %s", e)
                context = ""

        # generate_chat_response now returns (text, context_pii_map)
        # context_pii_map is the authoritative source: it maps [PERSON:idx_0] -> 'John Fritz'
        # because it was built when redacting the context BEFORE sending to the LLM.
        logger.info(f"FINAL_CONTEXT_FOR_LLM (len={len(context or '')}): {(context or '')[:2000]}")
        response_text, context_pii_map = generate_chat_response(
            query, 
            context or "", 
            user_role=user_role,
            conversation_history=conversation_history,
            privacy_level=privacy_level
        )

        # ── PII handling ──────────────────────────────────────────────────
        # The context was ALREADY redacted before being sent to the LLM.
        # The LLM's response only contains [TYPE:idx_N] tokens, not raw PII.
        # Re-running redact_text() on the response causes double-redaction corruption.
        # Instead, we trust the context_pii_map as the authoritative source.
        pii_map = dict(context_pii_map)
        logger.info(f"PII_MAP from context: {list(pii_map.keys())[:15]}")

        # ── Clean up LLM artifacts: stray token fragments or remnants ───────
        # Pattern: [TYPE:idx_N]x_M]K] → LLM garbles multiple token refs into one
        response_text = re.sub(r'(\[[A-Z_]+:idx_\d+\])(?:[x_\d\]]+)', r'\1', response_text)
        # Catch suffixes like ]:idx_N] or ]idx_N] that the LLM often appends  
        response_text = re.sub(r'\]\s*:?idx_\d+\]', ']', response_text)  
        # Catch lone idx_N] fragments (not preceded by a colon or letter) 
        response_text = re.sub(r'(?<![:\w])idx_\d+\]', '', response_text)
        # Catch partial fragments like [EMAILidx_N] (missing colon)
        response_text = re.sub(r'\[([A-Z_]+)idx_(\d+)\]', r'[\1:idx_\2]', response_text)
        # Catch double brackets [[TOKEN]]
        response_text = re.sub(r'\[\[(.*?)\]\]', r'[\1]', response_text)

        logger.info(f"PII MAP KEYS for this response: {list(pii_map.keys())}")
        logger.info(f"USER ROLE sending pii_map: '{user_role}' (lower: '{user_role.lower() if user_role else ''}')")

        # Check for PII markers in the response
        pii_types = []
        if re.search(r'\[EMAIL:idx_', response_text):     pii_types.append("email")
        if re.search(r'\[PHONE:idx_', response_text):     pii_types.append("phone")
        if re.search(r'\[SSN:idx_', response_text):       pii_types.append("ssn")
        if re.search(r'\[COMPANY:idx_', response_text):   pii_types.append("company")
        if re.search(r'\[PERSON:idx_', response_text):    pii_types.append("person")
        if re.search(r'\[LOCATION:idx_', response_text):  pii_types.append("location")
        if re.search(r'\[CREDIT_CARD:idx_|IBAN:idx_|BANK_ACCOUNT:idx_', response_text): pii_types.append("financial")
        if re.search(r'\[IP_ADDRESS:idx_', response_text): pii_types.append("ip_address")
        if re.search(r'\[PASSPORT:idx_|DRIVER_LICENSE:idx_|ITIN:idx_', response_text): pii_types.append("government_id")
        if re.search(r'\[MEDICAL_LICENSE:idx_', response_text): pii_types.append("medical")
        if re.search(r'\[CRYPTO:idx_', response_text):    pii_types.append("crypto")
        if re.search(r'\[REDACTED:idx_', response_text):  pii_types.append("generic_pii")
        
        pii_detected = len(pii_types) > 0
        # No Python insert_audit_log here because Node.js API Gateway (chat.js) handles it to prevent duplicates

        # RBAC: Only send the pii_map to admin / super_admin roles
        # Regular users get null — the frontend can never reveal PII for them
        auth_role = user_role.lower() if isinstance(user_role, str) else str(user_role)
        include_map = auth_role in ('admin', 'super_admin')

        return {
            "query": query,
            "response": response_text,
            "context_used": bool(context),
            "status": "success",
            "pii_detected": pii_detected,
            "pii_types": pii_types,
            "pii_map": pii_map if include_map else None
        }


    except HTTPException:
        # re-raise to let FastAPI send the right HTTP status & detail
        raise
    except Exception as e:
        logger.exception("Chat endpoint unexpected error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error in /chat")

# --- Phase 6.5: Streaming Chat Endpoint (SSE) ---
@app.post("/chat/stream")
async def chat_stream(req: Request):
    """Streaming chat endpoint using Server-Sent Events for real-time token delivery."""
    try:
        body = await req.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body for /chat/stream")

    query = body.get("query") or body.get("message") or body.get("prompt")
    if not query or not isinstance(query, str) or not query.strip():
        raise HTTPException(status_code=400, detail="Missing required 'query'")

    query = query.strip()
    conversation_history = body.get("conversation_history", [])
    org_id = body.get("org_id")
    user_id = body.get("user_id")
    organization = body.get("organization") or "default"
    user_role = body.get("user_role") or body.get("role", "student")
    privacy_level = body.get("privacy_level", "standard")

    # Security check
    if scan_prompt(query):
        raise HTTPException(status_code=403, detail="Security Warning: Malicious Prompt Detected.")

    if GuardrailManager:
        is_safe, error_msg = GuardrailManager.check_query(query)
        if not is_safe:
            raise HTTPException(status_code=403, detail=error_msg)

    # Build context
    context = ""
    try:
        admin_roles = ['admin', 'super_admin']
        is_admin = user_role in admin_roles
        k_val = 20 if is_admin else 10
        search_query = build_search_query(query, conversation_history)

        sr = SearchRequest(
            query=search_query, top_k=k_val, org_id=org_id,
            organization=organization, user_role=user_role, user_id=user_id
        )
        search_results = search_documents(sr)
        context_parts = []
        if isinstance(search_results, dict) and "results" in search_results:
            for idx, r in enumerate(search_results["results"]):
                chunk_text = r.get("text", "") if isinstance(r, dict) else getattr(r, "text", "")
                if chunk_text:
                    context_parts.append(f"DOCUMENT RECORD {idx+1}:\n{chunk_text}\n---")
        context = "\n\n".join(context_parts)
    except Exception as e:
        logger.exception("Stream: error building context: %s", e)

    # Redact
    pii_session_map = {}
    pii_session_counters = {}
    
    redacted_query = redact_text(query, pii_map=pii_session_map, counters=pii_session_counters, strictness=privacy_level)
    redacted_context = redact_text(context, pii_map=pii_session_map, counters=pii_session_counters, strictness=privacy_level)
    system_msg = get_system_prompt(user_role, bool(context))

    messages = [{"role": "system", "content": system_msg}]
    if conversation_history and isinstance(conversation_history, list):
        for msg in conversation_history:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                messages.append({
                    "role": msg["role"], 
                    "content": redact_text(
                        msg["content"], 
                        pii_map=pii_session_map, 
                        counters=pii_session_counters, 
                        strictness=privacy_level
                    )
                })
    messages.append({"role": "user", "content": f"Context:\n{redacted_context}\n\nQuestion: {redacted_query}"})

    use_openai = os.getenv("USE_OPENAI_CHAT", "FALSE").upper() == "TRUE" and OPENAI_API_KEY

    if not use_openai:
        # Non-streaming fallback for Ollama
        response_text = generate_chat_response(query, context or "", user_role=user_role,
                                                conversation_history=conversation_history, privacy_level=privacy_level)
        async def fallback_gen():
            yield f'data: {json.dumps({"token": response_text})}\n\n'
            yield 'data: [DONE]\n\n'
        return StreamingResponse(fallback_gen(), media_type='text/event-stream')

    # OpenAI streaming
    async def generate():
        try:
            stream = openai.chat.completions.create(
                model=PRIMARY_MODEL, messages=messages,
                max_tokens=2000, temperature=0.1, stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield f'data: {json.dumps({"token": delta.content})}\n\n'
            yield 'data: [DONE]\n\n'
        except Exception as e:
            logger.exception("Streaming error: %s", e)
            yield f'data: {json.dumps({"token": f"Error: {str(e)}"})}\n\n'
            yield 'data: [DONE]\n\n'

    return StreamingResponse(generate(), media_type='text/event-stream')

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
async def process_documents_batch(org_id: int, background_tasks: BackgroundTasks, batch_size: int = 100, max_documents: Optional[int] = None, force: bool = False):
    """Trigger background batch processing for pending documents.
    
    Args:
        force: If True, reset 'processed' documents back to 'pending' first,
               then re-process them with deep extraction. Used to fix documents
               that were indexed with shallow metadata only.
    """
    logger.info(f"Background batch processing triggered: org_id={org_id}, force={force}")
    
    if force:
        # Reset processed documents to pending so they get re-extracted
        try:
            conn = get_conn()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE documents SET status = 'pending'
                WHERE org_id = %s AND status = 'processed'
            """, (org_id,))
            reset_count = cursor.rowcount
            conn.commit()
            cursor.close()
            put_conn(conn)
            logger.info(f"Force reprocess: Reset {reset_count} documents to 'pending' for org_id={org_id}")
        except Exception as e:
            logger.error(f"Failed to reset documents for force reprocess: {e}")
    
    background_tasks.add_task(run_batch_processing, org_id, batch_size, max_documents)
    
    return {
        "status": "accepted",
        "message": f"Background processing started for org_id={org_id} (force={force})"
    }

async def run_batch_processing(org_id: int, batch_size: int = 100, max_documents: Optional[int] = None):
    """Deep batch processing: downloads files from MinIO, extracts full text,
    chunks content, generates embeddings, and stores in ChromaDB.
    
    This ensures every document is fully indexed with its actual content
    (not just metadata), making search and chat work with real document data.
    Organization isolation is enforced by using org-specific ChromaDB collections.
    """
    total_processed = 0
    total_failed = 0
    total_chunks = 0
    failed_docs = []
    
    try:
        collection = get_org_collection(org_id=org_id)
        conn = get_conn()
        cursor = conn.cursor()
        
        # Initialize MinIO client for file downloads
        try:
            mc = get_minio_client()
        except Exception as e:
            logger.error(f"Failed to initialize MinIO client: {e}")
            mc = None
        
        while True:
            cursor.execute("""
                SELECT id, filename, metadata, file_key, is_encrypted, encrypted_dek, encryption_iv, encryption_tag
                FROM documents
                WHERE org_id = %s AND status = 'pending'
                ORDER BY created_at ASC
                LIMIT %s
                FOR UPDATE SKIP LOCKED
            """, (org_id, batch_size))
            
            docs = cursor.fetchall()
            if not docs:
                break
            
            for doc_id, filename, metadata, file_key, is_encrypted, encrypted_dek, encryption_iv, encryption_tag in docs:
                try:
                    text = ""
                    
                    # ========== PHASE 1: DEEP TEXT EXTRACTION ==========
                    # Strategy: Try MinIO file download first (best quality),
                    # then fall back to DB metadata if MinIO fails.
                    
                    minio_success = False
                    if mc and file_key:
                        temp_path = f"/tmp/batch_{org_id}_{doc_id}_{os.path.basename(file_key)}"
                        try:
                            mc.fget_object(MINIO_BUCKET, file_key, temp_path)
                            logger.info(f"[Deep Extract] Downloaded {file_key} from MinIO for doc {doc_id}")
                            
                            # Decrypt the file if it was encrypted at rest
                            if is_encrypted and CryptoManager:
                                try:
                                    with open(temp_path, "rb") as f:
                                        encrypted_data = f.read()
                                    decrypted_data = CryptoManager.decrypt_envelope(
                                        encrypted_data, encrypted_dek, encryption_iv, encryption_tag
                                    )
                                    with open(temp_path, "wb") as f:
                                        f.write(decrypted_data)
                                    logger.info(f"[Deep Extract] Decrypted file for doc {doc_id}")
                                except Exception as de:
                                    logger.error(f"[Deep Extract] File decryption failed for doc {doc_id}: {de}")
                                    # Try metadata fallback below
                            
                            # Extract full text from the downloaded file
                            text = extract_text_from_file(temp_path)
                            if text and len(text.strip()) > 3:
                                minio_success = True
                                logger.info(f"[Deep Extract] Extracted {len(text)} chars from file for doc {doc_id}")
                            
                            # Clean up temp file
                            try:
                                os.remove(temp_path)
                            except:
                                pass
                                
                        except Exception as minio_err:
                            logger.warning(f"[Deep Extract] MinIO download failed for doc {doc_id} ({file_key}): {minio_err}")
                            try:
                                os.remove(temp_path)
                            except:
                                pass
                    
                    # ========== FALLBACK: DB METADATA EXTRACTION ==========
                    if not minio_success:
                        if isinstance(metadata, str):
                            metadata_dict = json.loads(metadata)
                        else:
                            metadata_dict = metadata or {}
                        
                        # Phase 2: Handle ALE Decryption if document is encrypted
                        if is_encrypted and CryptoManager:
                            try:
                                encrypted_b64 = metadata_dict.get("encrypted_content")
                                if encrypted_b64:
                                    encrypted_bytes = base64.b64decode(encrypted_b64)
                                    decrypted_bytes = CryptoManager.decrypt_envelope(
                                        encrypted_bytes, 
                                        encrypted_dek, 
                                        encryption_iv, 
                                        encryption_tag
                                    )
                                    metadata_dict = json.loads(decrypted_bytes.decode('utf-8'))
                                    logger.info(f"Successfully decrypted metadata for doc {doc_id}")
                            except Exception as e:
                                logger.error(f"Failed to decrypt doc {doc_id}: {e}")

                        # Build text from metadata fields (excluding internal keys)
                        text_parts = [f"{k}: {v}" for k, v in metadata_dict.items() 
                                      if v and k not in ('record_type', 'source', 'row_index', 'encrypted_content')]
                        text = " | ".join(text_parts) if text_parts else ""
                    
                    # ========== VALIDATE EXTRACTED TEXT ==========
                    if not text or len(text.strip()) < 3:
                        failed_docs.append({"id": doc_id, "error": "No text extracted"})
                        cursor.execute("UPDATE documents SET status = 'failed' WHERE id = %s", (doc_id,))
                        total_failed += 1
                        continue
                    
                    # ========== PHASE 5: TOXICITY ANALYSIS CHECK ==========
                    is_toxic = False
                    toxicity_score = 0.0
                    try:
                        if openai and OPENAI_API_KEY:
                            # Only check first 1000 chars to save API calls
                            check_text = text[:1000]
                            oa_client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=5.0, max_retries=0)
                            mod_response = oa_client.moderations.create(input=check_text)
                            if mod_response.results:
                                result = mod_response.results[0]
                                is_toxic = result.flagged
                                if hasattr(result, 'category_scores'):
                                    scores = result.category_scores.model_dump().values()
                                    toxicity_score = float(max(scores)) if scores else 0.0
                                
                                if is_toxic:
                                    logger.warning(f"Document {doc_id} flagged as TOXIC. Skipping ingestion.")
                                    cursor.execute(
                                        "UPDATE documents SET status = 'rejected_toxic', is_toxic = TRUE, toxicity_score = %s WHERE id = %s",
                                        (toxicity_score, doc_id)
                                    )
                                    total_failed += 1
                                    continue
                    except Exception as e:
                        logger.error(f"Moderation API failed for doc {doc_id}: {e}")
                        # Proceeding without moderation if API fails
                    
                    # ========== PHASE 3: CHUNK TEXT ==========
                    # Split long documents into overlapping chunks for better search quality
                    chunks = chunk_text(text, chunk_size=512, overlap=50)
                    if not chunks:
                        chunks = [text]  # Fallback: use entire text as one chunk
                    
                    logger.info(f"[Deep Extract] Doc {doc_id} ({filename}): {len(text)} chars -> {len(chunks)} chunks")
                    
                    # ========== PHASE 4: EMBED & STORE EACH CHUNK ==========
                    # Determine access level for RBAC
                    access_level = None
                    if not minio_success and isinstance(metadata_dict, dict):
                        access_level = metadata_dict.get("access_level")
                    if not access_level:
                        fname_lower = filename.lower() if filename else ""
                        txt_lower = text[:500].lower()
                        if "faculty" in fname_lower or "faculty" in txt_lower:
                            access_level = "faculty"
                        elif "student" in fname_lower or "intern" in txt_lower or "alumni" in txt_lower:
                            access_level = "student"
                        else:
                            access_level = "general"
                    
                    doc_chunk_count = 0
                    all_chunk_ids = []
                    all_chunk_docs = []
                    all_chunk_embs = []
                    all_chunk_metas = []

                    for chunk_idx, chunk_text_content in enumerate(chunks):
                        # Generate embedding with retry
                        embedding = None
                        for attempt in range(3):
                            try:
                                embedding = get_embedding(chunk_text_content)
                                if embedding and len(embedding) > 0:
                                    break
                            except Exception:
                                if attempt < 2:
                                    time.sleep(2 ** attempt)
                        
                        if not embedding:
                            logger.warning(f"Embedding failed for doc {doc_id} chunk {chunk_idx}, skipping chunk")
                            continue
                        
                        if len(chunks) == 1:
                            chunk_id = f"doc_{org_id}_{doc_id}"
                        else:
                            chunk_id = f"doc_{org_id}_{doc_id}_chunk_{chunk_idx}"
                        
                        # Phase 4.1: Source Discovery (Extract ID for metadata-based retrieval)
                        # We scan the metadata/text for valid entity IDs to populate source_id
                        source_id = None
                        if isinstance(metadata_dict, dict):
                            # Try known ID fields in priority order
                            id_keys = ['student_id', 'id', 'srn', 'usn', 'company_id', 'faculty_id', 'course_id', 'dept_id']
                            for ik in id_keys:
                                if ik in metadata_dict and metadata_dict[ik]:
                                    source_id = str(metadata_dict[ik]).upper()
                                    break
                        
                        if not source_id:
                            # Heuristic: Find the first token that looks like an ID in the chunk text
                            id_match = re.search(r'\b(PES|STU|RES|INT|PLC|COMP|FAC|CRS|DEPT|ALU|USR)[A-Z0-9_\-]{2,}\b', chunk_text_content, re.IGNORECASE)
                            if id_match:
                                source_id = id_match.group(0).upper()

                        collection_metadata = {
                            "org_id": org_id, 
                            "doc_id": doc_id, 
                            "filename": filename,
                            "access_level": access_level,
                            "chunk_index": chunk_idx,
                            "source_id": source_id
                        }
                        
                        all_chunk_ids.append(chunk_id)
                        all_chunk_docs.append(chunk_text_content)
                        all_chunk_embs.append(embedding)
                        all_chunk_metas.append(collection_metadata)
                        doc_chunk_count += 1
                    
                    if doc_chunk_count > 0:
                        # ATOMIC INDEXING: Only delete old vectors if we have new ones to replace them
                        try:
                            # Cleanup old potential chunk formats (doc_ID, doc_ID_chunk_N)
                            old_ids_to_clean = [f"doc_{org_id}_{doc_id}"] + [f"doc_{org_id}_{doc_id}_chunk_{i}" for i in range(100)]
                            collection.delete(ids=old_ids_to_clean)
                        except Exception:
                            pass
                            
                        chromadb_add(
                            ids=all_chunk_ids,
                            documents=all_chunk_docs,
                            embeddings=all_chunk_embs,
                            metadatas=all_chunk_metas,
                            collection=collection
                        )
                    if doc_chunk_count == 0:
                        cursor.execute("UPDATE documents SET status = 'failed' WHERE id = %s", (doc_id,))
                        total_failed += 1
                        continue
                    
                    # Update document status and store content preview
                    logger.info(f"[Deep Extract] SUCCESS: doc {doc_id} ({filename}) - Chunks: {doc_chunk_count}, Text sample: '{text[:100]}...'")
                    
                    cursor.execute(
                        "UPDATE documents SET status = 'processed', processed_at = NOW(), content_preview = %s WHERE id = %s",
                        (text[:500], doc_id)
                    )
                    total_processed += 1
                    total_chunks += doc_chunk_count
                    
                    if total_processed % 50 == 0:
                        conn.commit()
                        logger.info(f"[Deep Extract] Progress: {total_processed} docs, {total_chunks} chunks indexed...")
                    
                except Exception as e:
                    logger.error(f"Error processing doc {doc_id}: {e}")
                    failed_docs.append({"id": doc_id, "error": str(e)})
                    total_failed += 1
                    try:
                        conn.rollback()
                        cursor.execute("UPDATE documents SET status = 'failed' WHERE id = %s", (doc_id,))
                        conn.commit()
                    except Exception as inner_e:
                        logger.error(f"Could not safely mark doc {doc_id} as failed: {inner_e}")
            
            conn.commit()
            if max_documents and total_processed >= max_documents:
                break
        
        cursor.close()
        put_conn(conn)
        
        logger.info(f"[Deep Extract] FINISHED for org_id={org_id}. Processed: {total_processed}, Chunks: {total_chunks}, Failed: {total_failed}")
        
    except Exception as e:
        logger.exception(f"Background batch processing error for org_id {org_id}: {e}")

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
# Auto-Indexing Background Scanner
# -----------------------------
def periodic_processing_job():
    """Periodically scans for pending documents across ALL organizations
    and automatically triggers deep extraction + ChromaDB indexing.
    
    This ensures that newly uploaded documents are always processed
    without requiring any manual button click.
    """
    import asyncio
    SCAN_INTERVAL = 60  # seconds between scans

    logger.info("[AutoIndex] Periodic processing scanner started (interval=%ds)", SCAN_INTERVAL)

    while True:
        try:
            time.sleep(SCAN_INTERVAL)

            conn = get_conn()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT DISTINCT org_id FROM documents
                WHERE status = 'pending'
                ORDER BY org_id
            """)
            pending_orgs = [row[0] for row in cursor.fetchall()]
            cursor.close()
            put_conn(conn)

            if not pending_orgs:
                continue

            logger.info("[AutoIndex] Found pending documents in %d org(s): %s", len(pending_orgs), pending_orgs)

            for oid in pending_orgs:
                try:
                    logger.info("[AutoIndex] Triggering batch processing for org_id=%d", oid)
                    # run_batch_processing is an async function, run it in a new event loop
                    loop = asyncio.new_event_loop()
                    loop.run_until_complete(run_batch_processing(oid, batch_size=100))
                    loop.close()
                    logger.info("[AutoIndex] Completed batch processing for org_id=%d", oid)
                except Exception as e:
                    logger.error("[AutoIndex] Failed processing org_id=%d: %s", oid, e)

        except Exception as e:
            logger.error("[AutoIndex] Scanner error: %s", e)
            time.sleep(10)

def start_periodic_scanner():
    """Launch the periodic processing scanner as a daemon thread."""
    scanner_thread = Thread(target=periodic_processing_job, daemon=True)
    scanner_thread.start()
    logger.info("[AutoIndex] Scanner thread launched.")

# -----------------------------
# Startup
# -----------------------------
@app.on_event("startup")
def on_startup():
    """Initialize all background services on worker startup."""
    try:
        ensure_database_tables()
    except Exception as e:
        logger.exception("ensure_database_tables failed at startup: %s", e)
    
    start_background_worker()
    start_retention_job()
    start_periodic_scanner()
    logger.info("All background services started successfully.")
