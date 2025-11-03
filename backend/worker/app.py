#!/usr/bin/env python3

import os
import time
import json
import uuid
import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

import psycopg2
import redis
import requests
from minio import Minio
from pypdf import PdfReader
from threading import Thread

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn

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

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "mxbai-embed-large")

CHROMADB_URL = os.getenv("CHROMADB_URL", "http://chromadb:8000")
CHROMADB_COLLECTION = os.getenv("CHROMADB_COLLECTION", "privacy_documents")

TOP_K = int(os.getenv("TOP_K", 5))

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="Privacy-Aware RAG Worker", version="1.0.0")

# -----------------------------
# Pydantic models
# -----------------------------
class EmbedRequest(BaseModel):
    id: Optional[str] = None
    text: str

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = TOP_K

class ChatRequest(BaseModel):
    query: str
    context: Optional[str] = None

class DocumentChunk(BaseModel):
    id: str
    text: str
    score: float

# -----------------------------
# Utility functions
# -----------------------------
def get_embedding(text: str) -> Optional[List[float]]:
    """Get embedding from Ollama API"""
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
            timeout=60
        )
        response.raise_for_status()
        return response.json().get("embedding", [])
    except Exception as e:
        logger.error(f"Ollama embedding failed: {e}")
        return None

def generate_chat_response(query: str, context: str = "") -> str:
    """Generate chat response using Ollama"""
    try:
        prompt = f"""You are a helpful AI assistant for a privacy-aware document search system.

Context from documents:
{context}

User question: {query}

Please provide a helpful and accurate response based on the context provided. If the context doesn't contain relevant information, say so politely."""

        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
        return response.json().get("response", "I'm sorry, I couldn't generate a response.")
    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        return "I'm sorry, I encountered an error generating a response."

def chromadb_add(ids: List[str], documents: List[str], embeddings: List[List[float]]):
    """Add documents to ChromaDB"""
    url = f"{CHROMADB_URL}/api/v1/collections/{CHROMADB_COLLECTION}/add"
    data = {
        "ids": ids,
        "documents": documents,
        "embeddings": embeddings
    }
    response = requests.post(url, json=data, timeout=60)
    response.raise_for_status()
    return response.json()

def chromadb_query(query_embeddings: List[List[float]], n_results: int = TOP_K):
    """Query ChromaDB"""
    url = f"{CHROMADB_URL}/api/v1/collections/{CHROMADB_COLLECTION}/query"
    data = {
        "query_embeddings": query_embeddings,
        "n_results": n_results
    }
    response = requests.post(url, json=data, timeout=60)
    response.raise_for_status()
    return response.json()

def chromadb_create_collection():
    """Create ChromaDB collection if it doesn't exist"""
    try:
        url = f"{CHROMADB_URL}/api/v1/collections"
        data = {"name": CHROMADB_COLLECTION}
        response = requests.post(url, json=data, timeout=30)
        if response.status_code in [200, 409]:  # 409 means collection already exists
            logger.info(f"ChromaDB collection '{CHROMADB_COLLECTION}' ready")
        else:
            response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to create ChromaDB collection: {e}")

# -----------------------------
# Database operations
# -----------------------------
def get_db_connection(retries=10, delay=3):
    for attempt in range(retries):
        try:
            return psycopg2.connect(DATABASE_URL)
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(delay)

def ensure_database_tables():
    """Create database tables if they don't exist"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Documents table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            file_key TEXT NOT NULL UNIQUE,
            filename TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            content_preview TEXT,
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

    conn.commit()
    cur.close()
    conn.close()
    logger.info("Database tables ensured")

# -----------------------------
# MinIO operations
# -----------------------------
def get_minio_client(retries=10, delay=3):
    for attempt in range(retries):
        try:
            client = Minio(
                f"{MINIO_ENDPOINT}:{MINIO_PORT}",
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=False
            )
            # Test connection
            if client.bucket_exists(MINIO_BUCKET):
                return client
            else:
                client.make_bucket(MINIO_BUCKET)
                return client
        except Exception as e:
            if attempt == retries - 1:
                raise e
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

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks"""
    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(start + chunk_size - overlap, start + 1)

    return chunks

def process_document_job(job_data: Dict[str, Any]):
    """Process a document from MinIO"""
    file_key = job_data.get("key")
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
        if not text_content:
            logger.warning(f"No text extracted from {file_key}")
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
                    logger.warning(f"Failed to get embedding for chunk from {file_key}")

            # Store in ChromaDB if we have embeddings
            if batch_embeddings and len(batch_embeddings) == len(batch_chunks):
                try:
                    chromadb_add(batch_ids[:len(batch_embeddings)], 
                               batch_chunks[:len(batch_embeddings)], 
                               batch_embeddings)
                    logger.info(f"Stored batch of {len(batch_embeddings)} chunks from {file_key}")
                except Exception as e:
                    logger.error(f"Failed to store batch in ChromaDB: {e}")

        # Update database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE documents SET status = 'processed', processed_at = NOW(), content_preview = %s WHERE file_key = %s",
            (text_content[:500], file_key)
        )
        conn.commit()
        cur.close()
        conn.close()

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
    ensure_database_tables()
    chromadb_create_collection()

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
    """Start background worker thread"""
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
        "chromadb": False,
        "postgres": False,
        "redis": False,
        "minio": False
    }

    # Check Ollama
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        checks["ollama"] = response.status_code == 200
    except:
        pass

    # Check ChromaDB
    try:
        response = requests.get(f"{CHROMADB_URL}/api/v1/heartbeat", timeout=5)
        checks["chromadb"] = response.status_code == 200
    except:
        pass

    # Check PostgreSQL
    try:
        conn = get_db_connection()
        conn.close()
        checks["postgres"] = True
    except:
        pass

    # Check Redis
    try:
        redis_client = redis.from_url(REDIS_URL)
        checks["redis"] = redis_client.ping()
    except:
        pass

    # Check MinIO
    try:
        minio_client.bucket_exists(MINIO_BUCKET)
        checks["minio"] = True
    except:
        pass

    status = "healthy" if all(checks.values()) else "degraded"
    return {"status": status, "checks": checks, "timestamp": datetime.now().isoformat()}

@app.post("/embed")
def embed_text(request: EmbedRequest):
    """Embed text and optionally store in ChromaDB"""
    try:
        embedding = get_embedding(request.text)
        if not embedding:
            raise HTTPException(status_code=500, detail="Failed to generate embedding")

        doc_id = request.id or str(uuid.uuid4())

        # Store in ChromaDB
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
    """Search for similar documents"""
    try:
        # Get query embedding
        query_embedding = get_embedding(request.query)
        if not query_embedding:
            raise HTTPException(status_code=500, detail="Failed to generate query embedding")

        # Query ChromaDB
        results = chromadb_query([query_embedding], request.top_k)

        # Format results
        documents = []
        if results.get("documents") and results["documents"][0]:
            for i, (doc_text, doc_id, distance) in enumerate(zip(
                results["documents"][0],
                results["ids"][0],
                results["distances"][0]
            )):
                documents.append(DocumentChunk(
                    id=doc_id,
                    text=doc_text,
                    score=1.0 - distance  # Convert distance to similarity score
                ))

        return {
            "query": request.query,
            "results": documents,
            "total_found": len(documents)
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat_with_documents(request: ChatRequest):
    """Chat interface with document context"""
    try:
        context = ""

        if not request.context:
            # Search for relevant documents
            search_request = SearchRequest(query=request.query, top_k=3)
            search_results = search_documents(search_request)

            # Build context from search results
            contexts = []
            for doc in search_results["results"]:
                contexts.append(doc.text)
            context = "\n\n".join(contexts)
        else:
            context = request.context

        # Generate response
        response = generate_chat_response(request.query, context)

        return {
            "query": request.query,
            "response": response,
            "context_used": bool(context),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Startup
# -----------------------------
@app.on_event("startup")
def startup():
    """Initialize services on startup"""
    global minio_client
    logger.info("Privacy-Aware RAG Worker starting...")

    # Initialize MinIO client
    minio_client = get_minio_client()

    # Start background worker
    start_background_worker()

    logger.info("Worker service initialized successfully")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)
