import re
import logging
from typing import Tuple, List

logger = logging.getLogger(__name__)

class GuardrailManager:
    # Enterprise-grade patterns that indicate a potential jailbreak or prompt injection attempt
    JAILBREAK_PATTERNS = [
        r"(?i)ignore\s+(all\s+)?previous\s+(instructions|prompts|directions)",
        r"(?i)forget\s+(all\s+)?(previous\s+)?instructions",
        r"(?i)disregard\s+(all\s+)?previous",
        r"(?i)you\s+are\s+now\s+(a|an|the)\s+(unfiltered|developer|system admin|DAN)",
        r"(?i)act\s+as\s+(a|an|the)\s+(unfiltered|developer|system admin|DAN)",
        r"(?i)system\s+(reset|override|bypass)",
        r"(?i)output\s+(the\s+)?full\s+(system\s+)?prompt",
        r"(?i)print\s+(your\s+)?(system\s+)?prompt",
        r"(?i)what\s+are\s+your\s+(core\s+)?instructions",
        r"(?i)(bypass|disable)\s+(security|filters|rules|guardrails)",
        r"(?i)repeat\s+the\s+(text|words)\s+above",
        r"(?i)new\s+persona",
        r"(?i)dan\s+mode",
        r"(?i)stay\s+professional\s+but",
        r"(?i)base64", # common encoding trick
        r"(?i)simulat(e|ion)"
    ]

    # Role-Aware System Prompt with Privacy Controls
    SECURE_SYSTEM_PROMPT = """You are a helpful AI assistant. Answer using the provided context.

RULES:
1. If the user is an 'admin', you have FULL ACCESS to all data in the context. Answer any question.
2. If the user is a 'student', only answer questions about the student's own data.
3. Be concise and professional.
4. Only use the provided context. If it's not there, say you don't know."""

    @classmethod
    def check_query(cls, query: str) -> Tuple[bool, str]:
        """
        Scans a user query for prompt injection attempts.
        Returns: (is_safe, message_if_unsafe)
        """
        for pattern in cls.JAILBREAK_PATTERNS:
            if re.search(pattern, query):
                logger.warning(f"[GUARDRAIL] Potential jailbreak detected in query: {query[:100]}...")
                return False, "I'm sorry, I cannot process this request as it violates our safety and privacy policies. Please ask a question related to the document context."
        
        return True, ""

    @classmethod
    def post_process_response(cls, response: str) -> str:
        """
        Scans the LLM response for potential PII leakage and redacts it.
        Uses the shared redaction logic.
        """
        from utils.privacy import redact_text
        
        # Simple string patterns for common LLM leakage "Your instructions are..."
        if "Your instructions are" in response or "You are a helpful AI" in response[:50]:
            logger.warning("[GUARDRAIL] LLM attempted to leak instructions!")
            return "I'm sorry, I cannot provide that information as it involves internal system configurations. I am here to help you with the provided documents."

        return redact_text(response)
