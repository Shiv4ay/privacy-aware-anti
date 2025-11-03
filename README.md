# Privacy-Aware RAG Project

## Overview
A full-stack AI system for privacy-aware document search, retrieval, and chat, using Ollama Mistral, ChromaDB, FastAPI/Node.js backend, React/Tailwind frontend.

## Structure
- `docker-compose.yml`: Multi-container orchestration
- `backend/`
    - `api/`: Node.js Express API gateway
    - `worker/`: FastAPI Python worker for document processing
    - `database/`: Postgres schema (SQL files)
- `frontend/`: React/Tailwind dashboard UI

## Setup

1. **Install dependencies**
   - Backend:
     - `cd backend/api && npm install`
     - `cd ../worker && pip install -r requirements.txt`
   - Frontend:
     - `cd frontend && npm install`
2. **Database**
   - Postgres auto-initializes via `init.sql` and supporting schema files.
3. **Run dev (root directory):**
   - `docker-compose up --build`
4. **Access the app:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:3001](http://localhost:3001)
   - MinIO: [http://localhost:9001](http://localhost:9001)
   - Ollama: [http://localhost:11434](http://localhost:11434)

## Test Data
Use included `sample.txt`, `downloaded.txt`, or `downloaded_sample.txt` as upload/test files.

## Redis Test
To validate your Redis server: run `python backend/test_redis.py`

## Notes
- Customize environment variables in `.env` as needed.
- All code follows a privacy-conscious architecture.
