from app import config
from app.tools.rag_lookup import corpus_hash, guideline_sections, section_document


def report_metadata() -> dict:
    sections = guideline_sections()
    lengths = [len(section_document(section)) for section in sections]
    return {
        "dataset": "handcrafted_synthetic",
        "scope": "Decision and flag agreement with rules; not LLM accuracy or real-property validation",
        "chunking": "section_boundaries",
        "corpus_sections": len(sections),
        "corpus_hash": corpus_hash(sections),
        "corpus_characters": sum(lengths),
        "section_characters": {section["id"]: length for section, length in zip(sections, lengths)},
        "corpus_tokens": None,
        "token_availability": "not_measured",
        "prompt_token_scope": "Instruction/evidence prompts only; excludes system text and schema. Not billed generation usage.",
        "k": 4,
        "embedding_model": config.GEMINI_EMBEDDING_MODEL_NAME,
        "configured_vector_store": "qdrant" if config.QDRANT_URL else "local",
        "retrieval_thresholds": {"hit_rate": 1.0, "recall": None},
        "retrieval_acceptance": "At least one manually expected guideline per synthetic case at k=4: hit rate must be 1.0; each case's minimum recall is 1 / expected guideline count, and the aggregate recall threshold is their mean. These are bounded synthetic smoke checks, not industry certification.",
        "faithfulness_threshold": 0.7,
        "faithfulness_denominator": "Completed judge scores on contract-valid memos; exclude failed executions, include below-threshold scores",
        "max_memo_cases": 2,
        "max_memo_generations": 4,
        "memo_denominator": "Planned case-format slots include preparation and judge setup failures; generation attempts count calls begun, including failed generation calls.",
        "generation_budget_note": "At most four memo generation requests, with generation retries and fallback disabled for this bounded run. Embedding, token counting and judge subcalls are additional requests.",
    }


def empty_report() -> dict:
    return {
        "status": "not_run",
        "passed": None,
        "run_mode": "not_run",
        "generated_at": None,
        "model": config.GEMINI_MODEL_NAME,
        "fallback_model": config.GEMINI_FALLBACK_MODEL,
        "judge_model": config.GEMINI_FALLBACK_MODEL,
        "metadata": report_metadata(),
        "deterministic": None,
        "retrieval": None,
        "prompt_tokens": None,
        "memos": None,
        "sections": {name: {"status": "not_run", "reason": "no_report"} for name in ("deterministic", "retrieval", "prompt_tokens", "memos")},
    }