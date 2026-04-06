-- Analytics Schema: Structured tables for NL2SQL aggregate queries
-- These tables store placement and internship data for mathematically
-- accurate aggregate queries via the LangChain SQL Agent.
-- org_id is MANDATORY on every table to enforce tenant isolation.

-- ─────────────────────────────────────────────────────────────────
-- PLACEMENTS
-- Source CSV columns: placement_id, student_id, company_id, position,
--   salary, placement_date, location, employment_type, status
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placements (
    id               SERIAL PRIMARY KEY,
    placement_id     VARCHAR(20)     NOT NULL,
    org_id           INTEGER         NOT NULL,
    student_id       VARCHAR(50)     NOT NULL,
    company_id       VARCHAR(50),
    position         VARCHAR(100),
    salary           NUMERIC(12, 2),
    placement_date   DATE,
    location         VARCHAR(100),
    employment_type  VARCHAR(50),
    status           VARCHAR(50),
    created_at       TIMESTAMPTZ     DEFAULT NOW()
);

-- Enforce uniqueness per org to allow safe re-ingestion
CREATE UNIQUE INDEX IF NOT EXISTS uq_placements_org_pid
    ON placements (org_id, placement_id);

-- Required indexes for fast aggregate queries and tenant isolation
CREATE INDEX IF NOT EXISTS idx_placements_org_id
    ON placements (org_id);

CREATE INDEX IF NOT EXISTS idx_placements_student_id
    ON placements (org_id, student_id);

CREATE INDEX IF NOT EXISTS idx_placements_company_id
    ON placements (org_id, company_id);

CREATE INDEX IF NOT EXISTS idx_placements_salary
    ON placements (org_id, salary);


-- ─────────────────────────────────────────────────────────────────
-- INTERNSHIPS
-- Source CSV columns: internship_id, student_id, company_id, position,
--   start_date, end_date, stipend, location, status, supervisor
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS internships (
    id               SERIAL PRIMARY KEY,
    internship_id    VARCHAR(20)     NOT NULL,
    org_id           INTEGER         NOT NULL,
    student_id       VARCHAR(50)     NOT NULL,
    company_id       VARCHAR(50),
    position         VARCHAR(100),
    start_date       DATE,
    end_date         DATE,
    stipend          NUMERIC(10, 2),
    location         VARCHAR(100),
    status           VARCHAR(50),
    supervisor       VARCHAR(200),
    created_at       TIMESTAMPTZ     DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_internships_org_iid
    ON internships (org_id, internship_id);

CREATE INDEX IF NOT EXISTS idx_internships_org_id
    ON internships (org_id);

CREATE INDEX IF NOT EXISTS idx_internships_student_id
    ON internships (org_id, student_id);

CREATE INDEX IF NOT EXISTS idx_internships_company_id
    ON internships (org_id, company_id);

CREATE INDEX IF NOT EXISTS idx_internships_stipend
    ON internships (org_id, stipend);

-- ─────────────────────────────────────────────────────────────────
-- COMPANIES  (shared reference table, org_id scoped)
-- Source CSV columns: company_id, company_name, industry, location,
--   website, contact_email, contact_phone, partnership_since
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id                 SERIAL PRIMARY KEY,
    org_id             INTEGER         NOT NULL,
    company_id         VARCHAR(50)     NOT NULL,
    company_name       VARCHAR(200),
    industry           VARCHAR(100),
    location           VARCHAR(200),
    website            VARCHAR(200),
    created_at         TIMESTAMPTZ     DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_org_cid
    ON companies (org_id, company_id);

CREATE INDEX IF NOT EXISTS idx_companies_org_id
    ON companies (org_id);
