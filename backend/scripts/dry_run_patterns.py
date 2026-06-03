"""Dry-run pattern matching on empty G queries to find gaps."""
import json, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
results = []
with open(os.path.join(SCRIPT_DIR, "results_af.jsonl"), encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                results.append(json.loads(line))
            except Exception:
                pass

g_results = [r for r in results if r.get("category") == "G"]
NOT_FOUND_PHRASES = [
    "could not find", "no information", "not found", "no records",
    "unable to find", "no relevant", "no data", "not available",
]
empty_g = [
    r for r in g_results
    if not r.get("response")
    or len(r.get("response", "").strip()) < 20
    or any(p in r.get("response", "").lower() for p in NOT_FOUND_PHRASES)
]


def would_match(query):
    q = query.lower().strip()
    _OVR = ["summary", "statistic", "stat", "overview", "dashboard", "report",
            "kpi", "count", "total", "number", "percent", "rate", "analytic"]
    _is_listing = (any(q.startswith(p) for p in ["list ", "who ", "which "])
                   or (q.startswith("show ") and not any(w in q for w in _OVR)))

    is_placement_rank = any(p in q for p in [
        "which compan", "top compan", "most student", "hired most", "placement rank",
        "company hire", "top recruiter", "most popular company", "maximum hires",
        "company with most", "company hired most", "highest placements", "most placements",
        "top hiring", "company absorbed", "organization placed", "top 10 recruit",
    ])
    is_avg_salary = any(p in q for p in [
        "average salary", "avg salary", "average ctc", "avg ctc", "average package",
        "mean salary", "average lpa", "mean ctc", "mean package", "average compensation",
        "average stipend", "avg stipend", "mean stipend", "stipend average",
        "average monthly stipend", "stipend range", "maximum stipend", "highest stipend",
    ])
    is_max_salary = any(p in q for p in [
        "highest ctc", "highest salary", "highest package", "maximum salary", "max ctc",
        "maximum ctc", "top salary", "highest lpa", "best package", "highest pay",
        "best salary", "highest compensation", "max salary", "maximum pay",
        "ctc range", "salary range", "salary distribution", "ctc distribution",
        "compensation range", "package range",
    ])
    is_internship_count = any(p in q for p in [
        "how many intern", "internship count", "total intern", "number of intern",
        "students did internship", "students did intern", "intern count",
        "students interned", "students completed internship",
        "internship statistic", "internship number", "internship enrollment",
        "internship record", "internship summary", "internship overview",
        "internship analytic", "internship dashboard",
        "count of internship", "internship exist", "internship in our",
        "internship in the system", "internship data", "internship figure",
        "number of student internship",
    ])
    is_count_students = (
        any(p in q for p in ["how many student", "total student", "student count",
                              "number of student", "enrolled student"])
        and not any(p in q for p in ["intern", "placed", "placement"])
    )
    is_placement_rate = not _is_listing and any(p in q for p in [
        "placement rate", "placement percent", "how many placed", "placed student",
        "got placement", "students are placed", "students got placed", "students placed",
        "how many students placed", "how many student placed", "students have been placed",
        "total placed", "placement count", "number of placement", "total placement",
        "placement statistic", "placement summary", "placement overview", "placement dashboard",
        "placement report", "placement kpi", "placement performance", "placement number",
        "placement data", "number of student placement", "count of placement",
        "count of student", "mca students have been placed", "mca students are placed",
        "placement and internship", "internship and placement",
        "how is the placement", "all placement",
    ])
    _CITIES = ["bangalore", "bengaluru", "hyderabad", "chennai", "noida",
               "gurugram", "gurgaon", "mumbai", "pune", "delhi"]
    _city = next((c for c in _CITIES if c in q), None)
    is_placement_by_location = bool(_city) and any(p in q for p in [
        "placed in", "placement in", "working in", "placement count",
        "internship in", "intern in", "how many",
    ])
    is_failed_docs = any(p in q for p in ["failed document", "failed ingestion", "ingestion fail"])
    is_all_faculty = any(p in q for p in ["all faculty", "list faculty", "faculty member", "show faculty"])
    is_doc_summary = any(p in q for p in ["document summary", "how many document", "total document", "document count"])
    is_audit_summary = any(p in q for p in ["audit log", "recent log", "security log", "query log"])
    is_role_distribution = any(p in q for p in ["role distribution", "user role", "how many admin", "how many user"])
    is_pending_docs = any(p in q for p in ["pending document", "queued document"])
    is_audit_by_user = any(p in q for p in ["audit for user", "user activity", "user audit"])
    is_jailbreak_count = any(p in q for p in ["jailbreak attempt", "security attempt", "blocked query"])
    is_system_health = any(p in q for p in ["system health", "overall status", "system overview"])
    is_active_users = any(p in q for p in ["active user", "last login", "recent login"])
    is_org_overview = any(p in q for p in ["organization overview", "org stats", "organization summary"])
    is_processing_jobs = any(p in q for p in ["processing job", "queue status", "ingestion queue"])
    is_super_admin_mutation = any(p in q for p in ["create account", "create user", "rotate key"])
    is_dept_gpa = any(p in q for p in ["dept gpa", "department gpa", "gpa by department"])
    is_students_at_company = any(p in q for p in ["students at company", "students placed at", "placed at company"])
    is_faculty_course_map = any(p in q for p in ["faculty course", "who teaches", "teacher for course"])
    is_batch_placement = any(p in q for p in ["batch placement", "placement by batch", "placement comparison"])

    matched = any([
        is_count_students, is_placement_rank, is_avg_salary, is_failed_docs,
        is_all_faculty, is_doc_summary, is_placement_rate, is_audit_summary,
        is_role_distribution, is_pending_docs, is_audit_by_user, is_jailbreak_count,
        is_system_health, is_active_users, is_org_overview, is_processing_jobs,
        is_super_admin_mutation, is_dept_gpa, is_students_at_company,
        is_faculty_course_map, is_batch_placement,
        is_max_salary, is_internship_count, is_placement_by_location,
    ])
    flags = []
    for name, val in [
        ("rank", is_placement_rank), ("rate", is_placement_rate),
        ("intern_count", is_internship_count), ("avg_sal", is_avg_salary),
        ("max_sal", is_max_salary), ("location", is_placement_by_location),
        ("at_company", is_students_at_company), ("batch", is_batch_placement),
        ("count_students", is_count_students),
    ]:
        if val:
            flags.append(name)
    return matched, flags, _city


print(f"Total empty G queries: {len(empty_g)}")
no_match = []
does_match = []
for r in empty_g:
    matched, flags, city = would_match(r.get("query", ""))
    if not matched:
        no_match.append(r)
    else:
        does_match.append((r, flags, city))

print(f"\n=== {len(no_match)} queries with NO pattern match ===")
for r in no_match:
    print(f"  {r['query_id']}: {r['query']}")

print(f"\n=== {len(does_match)} queries that MATCH but returned empty (stale results — re-run needed) ===")
for r, flags, city in does_match:
    print(f"  {r['query_id']}: [{','.join(flags)}] city={city!r}  {r['query']}")
