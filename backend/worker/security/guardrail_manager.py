import re
import logging
from typing import Tuple, List

logger = logging.getLogger(__name__)

class GuardrailManager:
    # Patterns that indicate a potential jailbreak or prompt injection attempt
    JAILBREAK_PATTERNS = [
        r"(?i)ignore (all )?previous instructions",
        r"(?i)forget (all )?previous instructions",
        r"(?i)you are now (a|an|the) ",
        r"(?i)system (reset|override)",
        r"(?i)disregard (all )?previous",
        r"(?i)output (the )?full (system )?prompt",
        r"(?i)repeat the text above",
        r"(?i)new persona",
        r"(?i)dan mode",
        r"(?i)stay professional but"
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
