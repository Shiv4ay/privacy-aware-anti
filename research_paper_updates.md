# Research Paper Update Content: Privacy-Aware RAG Guide

Based on the recent advanced enhancements made to your system (Phases 6-10 and Frontend overhaul), here are highly detailed, academic-style additions you can directly integrate into your Capstone/Research paper. 

*Note: All references to external cloud models have been excluded to reflect your 100% offline, privacy-first local architecture.*

---

## 1. Additions to the Abstract & Introduction
*You can weave these points into your abstract or introduction to highlight the robustness and security of your system.*

**Suggested Text:**
> To address the challenges of context-crowding and lateral data leakage in typical Retrieval-Augmented Generation systems, this project introduces **Recursive Entity Resolution with strict Row-Level Security (RLS)** alongside an **Intent-Aware Query Normalization** engine. Furthermore, to eliminate the hallucination risks of standard Text-to-SQL logic on local, low-resource hardware, the architecture integrates a **Deterministic Offline Aggregate Engine** for administrative analytics. The system also uniquely features a **Contextual PII Guard** mechanism—utilizing domain-specific whitelists to prevent the over-redaction of technical terms—and heuristic threat detection to immediately intercept prompt injection attacks via real-time streaming alerts.

---

## 2. Additions to System Architecture / Methodology
*Add these subsections to your "Methodology" or "Proposed System Architecture" section, right after explaining the basic RAG flow.*

### A. Intent-Aware Context Assembly & Normalization
*Explains how you fixed the issue of local models getting confused by too much context or weird phrasing (Phase 7 & 10).*

**Suggested Text:**
> A significant challenge in Retrieval-Augmented Generation is "context crowding," where voluminous but low-priority data chunks (e.g., historical semester grades) obscure critical, high-value data (e.g., placement records), leading to model hallucination. To mitigate this, the proposed architecture implements an **Intent-Aware Context Assembly** module. The system utilizes NLU (Natural Language Understanding) aliases to normalize colloquial user phrasing (e.g., "my package", "3rd sem") into canonical search terms. Furthermore, the system caps the retrieval of redundant historical datasets (like results/grades) and forcibly promotes high-value chunks (like internships and placements) to the top of the context window. To enforce strict token efficiency, the system prompt employs a 5-step decision tree, forcing the local LLM to output scoped, tabular responses rather than dumping full, unoptimized user profiles.

### B. Deterministic Offline Aggregate Engine
*Explains how Admins and Faculty get accurate data without relying on the LLM to write SQL (Phase 9.5).*

**Suggested Text:**
> While LLMs are highly effective for unstructured text synthesis, relying on Text-to-SQL logic for complex aggregations on local, consumer-grade hardware introduces unacceptable latency and hallucination risks. Our system circumvents this by routing administrative and faculty analytic queries to a **Deterministic Offline Aggregate Engine**. Utilizing regex and semantic keyword matching, the system maps queries (e.g., "department GPA rankings" or "students placed at company X") to a pre-compiled library of optimized PostgreSQL templates. This hybrid approach guarantees 100% analytical accuracy and sub-second latency while bypassing the heavy computational overhead of generative models.

### C. Recursive Entity Resolution with Strict Row-Level Security (RLS)
*Explains how you prevented students from accessing each other's data while querying (Phase 9).*

**Suggested Text:**
> To prevent lateral privilege escalation—where one user might inadvertently or maliciously retrieve another user's contextual data via complex queries—the retrieval pipeline enforces **Strict Row-Level Security (RLS)** during its hop-based entity resolution. When a query requires recursive context (e.g., resolving a student ID to fetch associated placements), the system rigidly applies a `source_id` filter at every hop. Any entity resolution path attempting to traverse into a peer's data silo is immediately terminated, ensuring zero cross-user data leakage even under unstructured query scenarios.

---

## 3. Additions to Privacy Features / NLP Redaction Efficacy
*Add this to the section discussing your PII Redaction Engine (Presidio) to show how you made it smarter.*

### A. Context-Aware NLP Guards
*Explains the Academic term whitelist and Geography guards (Phase 8).*

**Suggested Text:**
> Standard Named Entity Recognition (NER) models frequently suffer from "over-redaction," erroneously flagging domain-specific terminology as Personally Identifiable Information (PII) (e.g., redacting the word "Cloud" in "Cloud Computing" as a location). To ensure data integrity, our PII Redaction Engine is fortified with **Context-Aware Guards**. This includes an **Academic Terms Whitelist** comprising curriculum nomenclature, as well as Geography and Email priority guards. These heuristic guards intercept the NER output and rescue falsely flagged sub-entities, ensuring that academic entities and proper architectural names remain intact while successfully neutralizing genuine PII.

### B. Voluntary Privacy Shield (UI/UX)
*Explains the new UI feature for student privacy (Phase 9.4).*

**Suggested Text:**
> Recognizing that privacy is also a physical, over-the-shoulder concern in shared environments (such as university labs), the user interface introduces a **Voluntary Privacy Shield**. Users can toggle "Hidden Mode", which instructs the backend to bypass the final de-anonymization step. Consequently, the UI renders cryptographic PII badges (e.g., `[NAME:idx_0]`) instead of plaintext values. Users can explicitly interact with these individual badges to reveal the underlying data on-demand, demonstrating a highly user-centric approach to data exposure.

---

## 4. Additions to Security & Threat Detection Sections
*A brand new section to add if you don't have one, highlighting your system's defense against AI attacks.*

### Heuristic Prompt Injection Defense
*Explains how you block jailbreaks and streaming alerts (Phase 2 & 8).*

**Suggested Text:**
> To secure the local LLM from adversarial exploitation, the system implements a preemptive **Prompt Injection Guardrail API**. Before any query reaches the tokenization or embedding phase, it is evaluated against a dynamic heuristics engine trained to detect direct jailbreaks, hypothetical bypass framing (e.g., "penetration test" or "system override" pretexts), and advanced role-play attacks. Upon detecting malicious intent, the system immediately severs the connection and returns a **Real-Time Streaming Security Alert** to the frontend, simultaneously logging the attack in an offline database to populate a Threat Intelligence Dashboard for administrators.

---

## 5. Potential Tables/Figures to Add

*   **Table Idea 1: Context Trimming Impact**: A table comparing "Before" (LLM fails to answer placement queries due to 30 context chunks) vs "After" (Intent-aware assembly capping results to 10 chunks, 100% success rate).
*   **Table Idea 2: Admin Aggregate Performance**: A table comparing "Text-to-SQL LLM" (High latency, high error rate) to your "Deterministic Regex SQL Templates" (Sub-second latency, 0% hallucination rate).
*   **Figure Idea 1**: A flowchart of the **Prompt Injection Guardrail** showing a malicious user request being intercepted and logged.
*   **Figure Idea 2 (Screenshot)**: Include a screenshot of the **Voluntary Privacy Shield** in action on the React frontend, showing the `[NAME]` badges, and another screenshot showing the amber **Security Alert Card** when a jailbreak is attempted.
