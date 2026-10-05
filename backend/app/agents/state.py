from __future__ import annotations

from typing import NotRequired, TypedDict


class UWState(TypedDict):
    ai_note: NotRequired[str | None]  # why AI stages are skipped for this run, None when admitted
    property_id: str
    raw_input: dict
    image_path: str | None
    extracted_features: dict
    guideline_hits: list[dict]  # retrieved guideline sections: {id, title, text, score}
    guideline_chunks: list[str]  # the same sections as "[G2] Title: text" for display and the PDF
    risk_score: int
    risk_flags: list[str]
    risk_breakdown: dict
    prototype_mitigation_model: dict
    comparables: list[dict]
    decision: str
    rationale: str  # propagated from memo_json["rationale"] after report generation
    memo_json: dict  # UnderwritingMemo shape when AI succeeds, {} when unavailable
    ai_memo_status: NotRequired[str]
    ai_memo_reason: NotRequired[str]
    memo_error: NotRequired[str]
    memo_model: NotRequired[str]
    review_status: NotRequired[str]  # not_required, pending_review, approved or overridden
    final_decision: NotRequired[str | None]
    reviewer: NotRequired[str]
    review_note: NotRequired[str]
