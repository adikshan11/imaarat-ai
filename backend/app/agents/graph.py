from __future__ import annotations

from typing import Any, Literal
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from app.agents.state import UWState
from app.db import database_url, is_postgres
from app.observability import publish_trace, traced
from app.schemas import decision_from_score
from app.tools.comparables import comparable_lookup
from app.tools.rag_lookup import format_hit, retrieve
from app.tools.hazard_lookup import verify_location
from app.tools.risk_calculator import risk_score_calculator
from app.tools.vision_extract import extract_property_features

REVIEW_DECISIONS = ("Accept", "Refer", "Decline (mitigation possible)", "Auto-Decline")


def intake_node(state: UWState) -> dict:
    return {"property_id": str(state["raw_input"].get("property_id", ""))}


def extract_features_node(state: UWState) -> dict:
    return {"extracted_features": verify_location(extract_property_features(state.get("image_path"), state["raw_input"], state.get("ai_note")))}


def retrieval_query(raw: dict) -> str:
    parts = [
        f"{raw.get('construction_type', '')} construction",
        f"{raw.get('occupancy_type', '')} occupancy",
        f"roof age {raw.get('roof_age_years')} years" if raw.get("roof_age_years") is not None else "",
        f"{raw.get('cat_zone', '')} CAT zone",
        f"seismic zone {raw.get('seismic_zone', '')}",
        f"{raw.get('prior_claims_count_5yr')} prior claims" if raw.get("prior_claims_count_5yr") is not None else "",
        "sprinklered" if str(raw.get("sprinkler_system", "")).upper() == "Y" else "no sprinklers",
        f"total value at risk INR {raw.get('total_value_at_risk_inr') or raw.get('tiv')}",
    ]
    return ", ".join(part for part in parts if part)


def rag_guidelines_node(state: UWState) -> dict:
    hits = retrieve(retrieval_query(state["raw_input"]), k=4, ai_note=state.get("ai_note"))
    return {"guideline_hits": hits, "guideline_chunks": [format_hit(hit) for hit in hits]}


def score_risk_node(state: UWState) -> dict:
    score_data = risk_score_calculator(state.get("extracted_features") or state["raw_input"])
    return {
        "risk_score": int(score_data["score"]),
        "risk_flags": score_data["flags"],
        "risk_breakdown": score_data["breakdown"],
        "prototype_mitigation_model": score_data["prototype_mitigation_model"],
    }


def fetch_comparables_node(state: UWState) -> dict:
    return {"comparables": comparable_lookup(state.get("extracted_features") or state["raw_input"], k=5)}


def decide_node(state: UWState) -> dict:
    # Deterministic authority: Python rules set the decision; AI only explains.
    return {"decision": decision_from_score(state["risk_score"])}


def generate_report_node(state: UWState) -> dict:
    from app.agents.report_agent import generate_memo

    working = dict(state)
    memo = generate_memo(working)
    return {
        "memo_json": memo,
        "rationale": memo.get("rationale", "") if memo else "",
        "ai_memo_status": working.get("ai_memo_status", ""),
        "ai_memo_reason": working.get("ai_memo_reason", ""),
        "memo_error": working.get("memo_error", ""),
        "memo_model": working.get("memo_model", ""),
    }


def human_review_node(state: UWState) -> dict:
    """Referrals pause here until an underwriter approves or overrides the deterministic decision."""
    if state["decision"] != "Refer":
        return {"review_status": "not_required", "final_decision": state["decision"]}
    review = interrupt(
        {
            "question": "Approve the referral or override the decision",
            "property_id": state["property_id"],
            "risk_score": state["risk_score"],
            "risk_flags": state["risk_flags"],
            "options": list(REVIEW_DECISIONS),
        }
    )
    final_decision = review.get("final_decision") or state["decision"]
    return {
        "review_status": "approved" if final_decision == state["decision"] else "overridden",
        "final_decision": final_decision,
        "reviewer": review.get("reviewer", ""),
        "review_note": review.get("note", ""),
    }


def route_after_score(state: UWState) -> Literal["fetch_comparables", "decide"]:
    # Auto-decline fast path: at 85+ the profile is already beyond appetite, so skip reference properties.
    return "decide" if state["risk_score"] >= 85 else "fetch_comparables"


def build_graph() -> StateGraph:
    workflow = StateGraph(UWState)
    workflow.add_node("intake", intake_node)
    workflow.add_node("extract_features", extract_features_node)
    workflow.add_node("rag_guidelines", rag_guidelines_node)
    workflow.add_node("score_risk", score_risk_node)
    workflow.add_node("fetch_comparables", fetch_comparables_node)
    workflow.add_node("decide", decide_node)
    workflow.add_node("generate_report", generate_report_node)
    workflow.add_node("human_review", human_review_node)

    workflow.add_edge(START, "intake")
    workflow.add_edge("intake", "extract_features")
    workflow.add_edge("extract_features", "rag_guidelines")
    workflow.add_edge("rag_guidelines", "score_risk")
    workflow.add_conditional_edges("score_risk", route_after_score, {"fetch_comparables": "fetch_comparables", "decide": "decide"})
    workflow.add_edge("fetch_comparables", "decide")
    workflow.add_edge("decide", "generate_report")
    workflow.add_edge("generate_report", "human_review")
    workflow.add_edge("human_review", END)
    return workflow


_compiled: dict[str, Any] = {}


def checkpointer():
    """Postgres checkpoints survive serverless restarts; memory is enough for local runs and tests."""
    if not is_postgres():
        return InMemorySaver()
    from langgraph.checkpoint.postgres import PostgresSaver
    from psycopg import Connection
    from psycopg.rows import dict_row

    connection = Connection.connect(
        database_url().replace("postgresql+psycopg://", "postgresql://", 1),
        autocommit=True,
        prepare_threshold=None,
        row_factory=dict_row,
    )
    saver = PostgresSaver(connection)
    saver.setup()
    return saver


def graph():
    url = database_url()
    if url not in _compiled:
        _compiled[url] = build_graph().compile(checkpointer=checkpointer())
    return _compiled[url]


def initial_state(raw_input: dict, image_path: str | None, ai_note: str | None = None) -> UWState:
    return {
        "ai_note": ai_note,
        "property_id": str(raw_input.get("property_id", "")),
        "raw_input": raw_input,
        "image_path": image_path,
        "extracted_features": {},
        "guideline_hits": [],
        "guideline_chunks": [],
        "risk_score": 0,
        "risk_flags": [],
        "risk_breakdown": {},
        "prototype_mitigation_model": {},
        "comparables": [],
        "decision": "Accept",
        "rationale": "",
        "memo_json": {},
    }


@traced("underwrite", as_type="chain")
def run_graph(raw_input: dict, image_path: str | None = None, thread_id: str | None = None, ai_note: str | None = None) -> UWState:
    """Run the pipeline; a referral returns with review_status 'pending_review' and its thread_id."""
    thread_id = thread_id or f"uw-{uuid4().hex}"
    config = {"configurable": {"thread_id": thread_id}}
    result = graph().invoke(initial_state(raw_input, image_path, ai_note), config=config)
    state = {key: value for key, value in result.items() if key != "__interrupt__"}
    state["thread_id"] = thread_id
    state["trace_url"] = publish_trace()
    if "__interrupt__" in result:
        state["review_status"] = "pending_review"
        state["final_decision"] = None
    return state


@traced("underwriter_review", as_type="chain")
def resume_review(thread_id: str, final_decision: str, reviewer: str, note: str) -> UWState:
    config = {"configurable": {"thread_id": thread_id}}
    result = graph().invoke(Command(resume={"final_decision": final_decision, "reviewer": reviewer, "note": note}), config=config)
    return {key: value for key, value in result.items() if key != "__interrupt__"}
