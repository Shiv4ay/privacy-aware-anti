import random
import numpy as np
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class DifferentialPrivacy:
    @staticmethod
    def apply_noise(results: List[Any], top_k: int, epsilon: float = 0.1) -> List[Any]:
        """
        Applies Differential Privacy concepts to search results:
        1. Adds Laplacian noise to the similarity scores.
        2. Occasionally injects distractors (lower similarity items) to prevent fingerprinting.
        """
        if not results:
            return results

        # 1. Score Jittering (Laplacian Noise)
        # Note: In a real high-epsilon DP system, the noise scale depends on the sensitivity.
        # Here we use it as a 'lite' version to prevent precise score tracking.
        for doc in results:
            noise = np.random.laplace(0, 0.05) # Jitter of +/- 5%
            doc.score = max(0.0, min(1.0, doc.score + noise))

        # 2. Distractor Injection
        # If we have more results than top_k, swap one of the top results with a lower one
        # This breaks 'membership inference' by making results less deterministic.
        # Bug fix: Only inject if we have MORE results than top_k
        if len(results) > top_k and random.random() < 0.2: # 20% chance of distractor injection
            idx_to_replace = random.randint(0, min(len(results), top_k) - 1)
            idx_of_distractor = random.randint(min(len(results), top_k), len(results) - 1)
            
            logger.info(f"[DP] Injecting distractor result at index {idx_to_replace}")
            results[idx_to_replace], results[idx_of_distractor] = results[idx_of_distractor], results[idx_to_replace]

        # Sort back by score if needed, or leave jittered order (better for DP)
        return results[:top_k]
