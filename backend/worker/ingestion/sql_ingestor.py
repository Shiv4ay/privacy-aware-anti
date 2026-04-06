"""
Dual Ingestion: Structured SQL writer for placements.csv and internships.csv.

Called from process_document_job() in app.py after ChromaDB chunking so that
aggregate queries (NL2SQL) can run against mathematically accurate Postgres data.

Only placements.csv and internships.csv trigger SQL writes. All other filenames
return 0 immediately (no-op), so existing ingestion is unaffected.
"""
import csv
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Filenames that trigger structured SQL ingestion
_PLACEMENT_FILE  = "placements.csv"
_INTERNSHIP_FILE = "internships.csv"
_COMPANY_FILE    = "companies.csv"


def _safe_decimal(value: Optional[str]):
    """Return float or None for numeric CSV fields."""
    if value is None:
        return None
    v = str(value).strip().replace(",", "")
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _safe_str(value: Optional[str], maxlen: int = 200) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip()
    return v[:maxlen] if v else None


def _safe_date(value: Optional[str]) -> Optional[str]:
    """Return ISO date string or None."""
    if not value:
        return None
    v = str(value).strip()
    # Accept YYYY-MM-DD; reject obviously invalid strings
    return v if len(v) >= 8 else None


def ingest_placements(file_path: str, org_id: int, cur) -> int:
    """
    UPSERT rows from placements.csv into the placements table.
    Returns number of rows processed.
    """
    count = 0
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        # Normalise header names: strip whitespace
        reader.fieldnames = [h.strip() for h in (reader.fieldnames or [])]
        for row in reader:
            row = {k.strip(): v.strip() if v else None for k, v in row.items()}
            placement_id = _safe_str(row.get("placement_id"), 20)
            if not placement_id:
                continue

            cur.execute(
                """
                INSERT INTO placements
                    (placement_id, org_id, student_id, company_id, position,
                     salary, placement_date, location, employment_type, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (org_id, placement_id) DO UPDATE SET
                    student_id      = EXCLUDED.student_id,
                    company_id      = EXCLUDED.company_id,
                    position        = EXCLUDED.position,
                    salary          = EXCLUDED.salary,
                    placement_date  = EXCLUDED.placement_date,
                    location        = EXCLUDED.location,
                    employment_type = EXCLUDED.employment_type,
                    status          = EXCLUDED.status
                """,
                (
                    placement_id,
                    org_id,
                    _safe_str(row.get("student_id"), 50),
                    _safe_str(row.get("company_id"), 50),
                    _safe_str(row.get("position"), 100),
                    _safe_decimal(row.get("salary")),
                    _safe_date(row.get("placement_date")),
                    _safe_str(row.get("location"), 100),
                    _safe_str(row.get("employment_type"), 50),
                    _safe_str(row.get("status"), 50),
                ),
            )
            count += 1

    logger.info(f"[SQL_INGESTOR] Upserted {count} placement rows for org_id={org_id}")
    return count


def ingest_internships(file_path: str, org_id: int, cur) -> int:
    """
    UPSERT rows from internships.csv into the internships table.
    Returns number of rows processed.
    """
    count = 0
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [h.strip() for h in (reader.fieldnames or [])]
        for row in reader:
            row = {k.strip(): v.strip() if v else None for k, v in row.items()}
            internship_id = _safe_str(row.get("internship_id"), 20)
            if not internship_id:
                continue

            cur.execute(
                """
                INSERT INTO internships
                    (internship_id, org_id, student_id, company_id, position,
                     start_date, end_date, stipend, location, status, supervisor)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (org_id, internship_id) DO UPDATE SET
                    student_id  = EXCLUDED.student_id,
                    company_id  = EXCLUDED.company_id,
                    position    = EXCLUDED.position,
                    start_date  = EXCLUDED.start_date,
                    end_date    = EXCLUDED.end_date,
                    stipend     = EXCLUDED.stipend,
                    location    = EXCLUDED.location,
                    status      = EXCLUDED.status,
                    supervisor  = EXCLUDED.supervisor
                """,
                (
                    internship_id,
                    org_id,
                    _safe_str(row.get("student_id"), 50),
                    _safe_str(row.get("company_id"), 50),
                    _safe_str(row.get("position"), 100),
                    _safe_date(row.get("start_date")),
                    _safe_date(row.get("end_date")),
                    _safe_decimal(row.get("stipend")),
                    _safe_str(row.get("location"), 100),
                    _safe_str(row.get("status"), 50),
                    _safe_str(row.get("supervisor"), 200),
                ),
            )
            count += 1

    logger.info(f"[SQL_INGESTOR] Upserted {count} internship rows for org_id={org_id}")
    return count


def ingest_companies(file_path: str, org_id: int, cur) -> int:
    """
    UPSERT rows from companies.csv into the companies table.
    Returns number of rows processed.
    """
    count = 0
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [h.strip() for h in (reader.fieldnames or [])]
        for row in reader:
            row = {k.strip(): v.strip() if v else None for k, v in row.items()}
            company_id = _safe_str(row.get("company_id"), 50)
            if not company_id:
                continue

            cur.execute(
                """
                INSERT INTO companies
                    (org_id, company_id, company_name, industry, location, website)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (org_id, company_id) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    industry     = EXCLUDED.industry,
                    location     = EXCLUDED.location,
                    website      = EXCLUDED.website
                """,
                (
                    org_id,
                    company_id,
                    _safe_str(row.get("company_name"), 200),
                    _safe_str(row.get("industry"), 100),
                    _safe_str(row.get("location"), 200),
                    _safe_str(row.get("website"), 200),
                ),
            )
            count += 1

    logger.info(f"[SQL_INGESTOR] Upserted {count} company rows for org_id={org_id}")
    return count


def ingest_to_sql(file_path: str, filename: str, org_id: int, cur) -> int:
    """
    Entry point called from process_document_job().

    Dispatches to the correct ingestor based on filename.
    Returns number of rows written, or 0 if this file is not a structured type.

    The cursor is NOT committed here — the caller owns the transaction.
    """
    lower = os.path.basename(filename).lower()

    if lower == _PLACEMENT_FILE:
        return ingest_placements(file_path, org_id, cur)

    if lower == _INTERNSHIP_FILE:
        return ingest_internships(file_path, org_id, cur)

    if lower == _COMPANY_FILE:
        return ingest_companies(file_path, org_id, cur)

    return 0  # Not a structured file — no SQL writes
