-- Map processed document chunks and worker details

CREATE TABLE IF NOT EXISTS worker_docs (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    chunk_id TEXT NOT NULL,
    embedding JSONB,
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_docs_document_id ON worker_docs(document_id);
CREATE INDEX IF NOT EXISTS idx_worker_docs_chunk_id ON worker_docs(chunk_id);
