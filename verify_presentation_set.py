import requests
import json
import time

students = [
    "PES1PG24CA160", "PES1PG24CA161", "PES1PG24CA162", "PES1PG24CA163", "PES1PG24CA164",
    "PES1PG24CA165", "PES1PG24CA166", "PES1PG24CA167", "PES1PG24CA168", "PES1PG24CA169"
]

report = []

print(f"Starting verification for {len(students)} students...")

for stu_id in students:
    print(f"Testing {stu_id}...", end=" ", flush=True)
    payload = {
        "query": f"{stu_id} give info",
        "org_id": 4,
        "user_id": "test_user",
        "user_role": "admin",
        "organization": "default",
        "conversation_history": []
    }
    
    try:
        start_time = time.time()
        resp = requests.post("http://localhost:8001/chat", json=payload, timeout=60)
        duration = time.time() - start_time
        
        if resp.status_code == 200:
            data = resp.json()
            response_text = data.get("response", "")
            pii_map = data.get("pii_map", {})
            
            # Checks
            has_na = "[N/A]" in response_text
            # Check if any stipend (e.g. 22000) is in pii_map under [PHONE]
            stipend_as_phone = False
            for token, actual in pii_map.items():
                if "PHONE" in token and actual in ["22000", "1400000", "25000", "26000", "18000"]:
                    stipend_as_phone = True
            
            # Check for name resolution
            has_company_name = any(name in response_text for name in ["Swiggy", "PayTM", "Wipro", "KPMG", "Razorpay"])
            
            status = "✅ PASS" if not has_na and not stipend_as_phone else "⚠️ ISSUE"
            if has_na: status += " (Has [N/A])"
            if stipend_as_phone: status += " (Stipend-as-Phone)"
            
            report.append({
                "id": stu_id,
                "status": status,
                "duration": f"{duration:.2f}s",
                "resolved_companies": [n for n in ["Swiggy", "PayTM", "Wipro", "KPMG", "Razorpay"] if n in response_text]
            })
            print(status)
        else:
            print(f"❌ FAIL (Status {resp.status_code})")
            report.append({"id": stu_id, "status": f"❌ HTTP {resp.status_code}"})
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        report.append({"id": stu_id, "status": f"❌ ERROR: {str(e)[:50]}"})

print("\n--- FINAL REPORT ---")
print(json.dumps(report, indent=2))

with open("presentation_readiness_report.json", "w") as f:
    json.dump(report, f, indent=2)
