-- DPDP Data Quality: Response Feedback
-- Stores thumbs-up/down ratings from users on RAG responses.
-- query_hash links feedback to a specific query without storing PII.

CREATE TABLE IF NOT EXISTS response_feedback (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(100) NOT NULL,
    org_id      INTEGER      NOT NULL,
    query_hash  VARCHAR(64)  NOT NULL,   -- SHA-256 of the query text
    rating      VARCHAR(4)   NOT NULL CHECK (rating IN ('up', 'down')),
    comment     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_org_id     ON response_feedback (org_id);
CREATE INDEX IF NOT EXISTS idx_feedback_query_hash ON response_feedback (query_hash);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id    ON response_feedback (user_id);
