from typing import List, Dict, Any
from .pipeline import IngestionPipeline
import datetime

class DummyUniversityIngestion(IngestionPipeline):
    def fetch(self) -> List[Dict[str, Any]]:
        return [
            {
                "text": "NOTICE: Fall Semester 2025 registration begins on August 1st. All students must clear dues.",
                "metadata": {"source": "university_notices", "type": "notice", "date": "2025-07-15"}
            },
            {
                "text": "COURSE: CS101 Introduction to Computer Science. Instructor: Dr. Alan Turing. Credits: 4.",
                "metadata": {"source": "university_courses", "type": "course", "code": "CS101"}
            },
            {
                "text": "DEPARTMENT: The Department of Physics is located in the Newton Building. Head: Dr. Einstein.",
                "metadata": {"source": "university_departments", "type": "department", "name": "Physics"}
            }
        ]

class DummyHospitalIngestion(IngestionPipeline):
    def fetch(self) -> List[Dict[str, Any]]:
        return [
            {
                "text": "DOCTOR: Dr. Gregory House, Department of Diagnostic Medicine. Specialization: Rare Diseases.",
                "metadata": {"source": "hospital_doctors", "type": "doctor", "name": "Dr. House"}
            },
            {
                "text": "SERVICE: 24/7 Emergency Room is available at the Main Entrance. Call 911 for ambulance.",
                "metadata": {"source": "hospital_services", "type": "service", "name": "Emergency"}
            },
            {
                "text": "PUBLIC HEALTH: Flu vaccination drive starts next Monday. Free for seniors and children.",
                "metadata": {"source": "hospital_public_health", "type": "announcement"}
            }
        ]

class DummyFinanceIngestion(IngestionPipeline):
    def fetch(self) -> List[Dict[str, Any]]:
        return [
            {
                "text": "POLICY: Investment Policy 2025. Risk tolerance must be assessed before any equity allocation.",
                "metadata": {"source": "finance_policies", "type": "policy", "year": "2025"}
            },
            {
                "text": "MARKET UPDATE: Tech stocks rally as AI adoption surges. NASDAQ up 2.5%.",
                "metadata": {"source": "finance_market", "type": "news", "date": datetime.date.today().isoformat()}
            },
            {
                "text": "GUIDE: How to diversify your portfolio. Rule of thumb: 60% stocks, 40% bonds.",
                "metadata": {"source": "finance_guides", "type": "guide"}
            }
        ]
