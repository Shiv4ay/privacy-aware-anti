-- Documents table schema for Privacy-Aware RAG

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    file_key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'pending',
    content_preview TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Indexes for fast lookup and sorting
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_file_key ON documents(file_key);
