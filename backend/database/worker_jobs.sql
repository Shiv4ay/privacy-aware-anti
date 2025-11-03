-- Worker jobs table for document processing

CREATE TABLE IF NOT EXISTS worker_jobs (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    job_data JSONB NOT NULL,
    status VARCHAR(16) DEFAULT 'pending',
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worker_jobs_status ON worker_jobs(status);
CREATE INDEX IF NOT EXISTS idx_worker_jobs_created_at ON worker_jobs(created_at DESC);
