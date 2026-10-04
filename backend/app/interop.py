"""Interoperability: an MCP server (tools for AI clients) and an A2A agent (for other agents)."""

from __future__ import annotations

import json
import os
from typing import Any

from a2a.helpers import get_data_parts, new_data_message, new_text_message
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import add_a2a_routes_to_fastapi, create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentInterface, AgentSkill
from fastapi import FastAPI
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from app.config import GUIDELINES_MD
from app.db import fetch_history, fetch_submission_detail
from app.schemas import decision_from_score, indicative_product_segment
from app.tools.rag_lookup import retrieve
from app.tools.risk_calculator import risk_score_calculator


def public_base_url() -> str:
    host = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
    return f"https://{host}/api" if host else os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")


def deterministic_assessment(property_facts: dict[str, Any]) -> dict[str, Any]:
    scored = risk_score_calculator(property_facts)
    tiv = property_facts.get("tiv")
    return {
        "risk_score": scored["score"],
        "decision": decision_from_score(scored["score"]),
        "risk_flags": scored["flags"],
        "risk_breakdown": scored["breakdown"],
        "product_segment": indicative_product_segment(float(tiv)) if tiv else None,
    }


def assessment_summary(detail: dict[str, Any]) -> dict[str, Any]:
    memo = detail.get("memo_json") or {}
    return {
        "id": detail.get("id"),
        "property_id": detail.get("property_id"),
        "city": detail.get("raw_input", {}).get("city"),
        "risk_score": detail.get("risk_score"),
        "decision": detail.get("decision"),
        "final_decision": detail.get("final_decision"),
        "review_status": detail.get("review_status"),
        "risk_flags": detail.get("risk_flags"),
        "rationale": memo.get("rationale", ""),
        "guideline_citations": memo.get("guideline_citations", []),
    }


mcp = MCPServer(
    name="imaarat",
    title="Imaarat: Indian property underwriting",
    instructions="Commercial property underwriting tools. The deterministic Python engine owns every decision; use assess_property for a score and decision, and search_guidelines for the underwriting guidance behind it.",
)


@mcp.tool(description="Score a commercial property with the deterministic underwriting engine and return the decision, risk flags and score breakdown. Nothing is stored.")
def assess_property(
    construction_type: str,
    occupancy_type: str,
    cat_zone: str,
    sprinkler_system: str = "Y",
    roof_age_years: int | None = None,
    seismic_zone: str = "II",
    distance_to_coast_miles: float | None = None,
    distance_to_fire_zone_miles: float | None = None,
    prior_claims_count_5yr: int | None = None,
    tiv: float | None = None,
) -> dict[str, Any]:
    return deterministic_assessment(
        {
            "construction_type": construction_type,
            "occupancy_type": occupancy_type,
            "cat_zone": cat_zone,
            "sprinkler_system": sprinkler_system,
            "roof_age_years": roof_age_years,
            "seismic_zone": seismic_zone,
            "distance_to_coast_miles": distance_to_coast_miles,
            "distance_to_fire_zone_miles": distance_to_fire_zone_miles,
            "prior_claims_count_5yr": prior_claims_count_5yr,
            "tiv": tiv,
        }
    )


@mcp.tool(description="Retrieve the underwriting guideline sections (RAG over Gemini embeddings in Qdrant) most relevant to a question.")
def search_guidelines(query: str, k: int = 3) -> list[dict[str, Any]]:
    return retrieve(query, k=k)


@mcp.tool(description="Get one stored underwriting assessment by its numeric id, with decision, review status and AI rationale.")
def get_assessment(assessment_id: int) -> dict[str, Any]:
    detail = fetch_submission_detail(assessment_id)
    return assessment_summary(detail) if detail else {"error": f"assessment {assessment_id} not found"}


@mcp.tool(description="List stored underwriting assessments, newest first, optionally filtered by decision (Accept, Refer, Decline (mitigation possible), Auto-Decline).")
def list_assessments(decision: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    rows = [row for row in fetch_history() if decision is None or row["decision"] == decision]
    return [
        {key: row.get(key) for key in ("id", "property_id", "risk_score", "decision", "final_decision", "review_status", "risk_flags")}
        for row in rows[:limit]
    ]


@mcp.resource("uw://guidelines", name="underwriting-guidelines", description="The full underwriting guidelines (sections G1 to G12).", mime_type="text/markdown")
def guidelines() -> str:
    return GUIDELINES_MD.read_text(encoding="utf-8")


def mcp_app():
    return mcp.streamable_http_app(
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )


class UnderwritingAgentExecutor(AgentExecutor):
    """A2A skill handler: property data in, underwriting assessment out; text in, guideline sections out."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        data_parts = get_data_parts(context.message.parts) if context.message else []
        if data_parts:
            from app.agents.graph import run_graph
            from app.db import save_submission

            facts = dict(data_parts[0])
            facts.setdefault("property_id", f"A2A-{context.context_id[:8] if context.context_id else 'request'}")
            state = run_graph(facts)
            state["id"] = save_submission(state)["id"]
            reply = new_data_message(assessment_summary(state), context_id=context.context_id, task_id=context.task_id)
        else:
            question = context.get_user_input()
            hits = retrieve(question, k=3)
            text = "\n\n".join(f"[{hit['id']}] {hit['title']}: {hit['text']}" for hit in hits) or "No guidance retrieved (retrieval needs GEMINI_API_KEY)."
            reply = new_text_message(text, context_id=context.context_id, task_id=context.task_id)
        await event_queue.enqueue_event(reply)

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        raise NotImplementedError("Assessments run to completion and cannot be cancelled")


def agent_card() -> AgentCard:
    return AgentCard(
        name="Imaarat",
        description="Commercial property underwriting agent for Indian properties: deterministic risk scoring, Gemini Vision and RAG evidence, and a validated AI memo.",
        version="1.0.0",
        supported_interfaces=[AgentInterface(url=f"{public_base_url()}/a2a", protocol_binding="JSONRPC", protocol_version="1.0")],
        capabilities=AgentCapabilities(streaming=False),
        default_input_modes=["application/json", "text/plain"],
        default_output_modes=["application/json", "text/plain"],
        skills=[
            AgentSkill(
                id="assess_property",
                name="Assess property",
                description="Send property facts as a JSON data part; receive the risk score, decision, review status, rationale and guideline citations.",
                tags=["underwriting", "risk", "insurance"],
                examples=[json.dumps({"construction_type": "Frame", "occupancy_type": "Warehouse", "cat_zone": "Flood", "roof_age_years": 32, "sprinkler_system": "N", "prior_claims_count_5yr": 3, "tiv": 30000000})],
                input_modes=["application/json"],
                output_modes=["application/json"],
            ),
            AgentSkill(
                id="underwriting_guidance",
                name="Underwriting guidance",
                description="Ask a question in text; receive the most relevant underwriting guideline sections.",
                tags=["rag", "guidelines"],
                examples=["What applies to a roof older than 30 years?"],
                input_modes=["text/plain"],
                output_modes=["text/plain"],
            ),
        ],
    )


def add_a2a(app: FastAPI) -> None:
    card = agent_card()
    handler = DefaultRequestHandler(agent_executor=UnderwritingAgentExecutor(), task_store=InMemoryTaskStore(), agent_card=card)
    add_a2a_routes_to_fastapi(
        app,
        agent_card_routes=create_agent_card_routes(card),
        jsonrpc_routes=create_jsonrpc_routes(handler, rpc_url="/a2a"),
    )
