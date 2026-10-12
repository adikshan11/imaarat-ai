"""Interoperability: an MCP server (tools for AI clients) and an A2A agent (for other agents)."""

from __future__ import annotations

import json
import os
from typing import Any

from a2a.helpers import get_data_parts, new_data_artifact, new_data_part, new_task, new_text_message, new_text_part
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.context import ServerCallContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import add_a2a_routes_to_fastapi, create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCapabilities, AgentCard, AgentInterface, AgentSkill
from a2a.types.a2a_pb2 import Task, TaskState
from fastapi import FastAPI
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.concurrency import run_in_threadpool
from starlette.types import Receive, Scope, Send

from app import budget
from app.config import GUIDELINES_MD
from app.db import fetch_history, fetch_submission_detail, submission_for_thread
from app.schemas import decision_from_score, indicative_product_segment
from app.tools.hazard_lookup import lookup as hazard_lookup
from app.tools.hazard_lookup import verify_location
from app.tools.rag_lookup import retrieve
from app.tools.risk_calculator import risk_score_calculator


def public_base_url() -> str:
    if os.getenv("PUBLIC_BASE_URL"):
        return os.environ["PUBLIC_BASE_URL"]
    host = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
    return f"https://{host}/api" if host else "http://localhost:8000"


def deterministic_assessment(property_facts: dict[str, Any]) -> dict[str, Any]:
    property_facts = verify_location(property_facts)
    scored = risk_score_calculator(property_facts)
    tiv = property_facts.get("tiv")
    return {
        "official_hazard": property_facts["official_hazard"],
        "seismic_zone_used": property_facts.get("seismic_zone"),
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
    title="imaarat.ai: Indian property underwriting",
    instructions="Commercial property underwriting tools. The deterministic Python engine owns every decision; use assess_property for a score and decision, and search_guidelines for the underwriting guidance behind it.",
)


@mcp.tool(
    description="Score a commercial property with the deterministic underwriting engine and return the decision, risk flags and score breakdown. Pass the 6-digit pincode to check the declared seismic zone against official data and add flood and cyclone evidence. Nothing is stored."
)
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
    pincode: str | None = None,
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
            "zip": pincode,
        }
    )


@mcp.tool(
    description="Look up official natural-hazard evidence for an Indian 6-digit pincode: seismic zone (IS 1893:2016 map), share of the pincode area flooded in 1998-2022 satellite records (NRSC/NDEM) and the IMD cyclone hazard grade of its district."
)
def lookup_hazard(pincode: str) -> dict[str, Any]:
    return hazard_lookup(pincode) or {"error": f"no hazard data for pincode {pincode}"}


@mcp.tool(description="Retrieve the underwriting guideline sections (RAG over Gemini embeddings in Qdrant) most relevant to a question.")
def search_guidelines(query: str, k: int = 3) -> list[dict[str, Any]]:
    return retrieve(query, k=k, ai_note=budget.INTEROP_NOTE)


@mcp.tool(description="Get one stored underwriting assessment by its numeric id, with decision, review status and AI rationale.")
def get_assessment(assessment_id: int) -> dict[str, Any]:
    detail = fetch_submission_detail(assessment_id)
    return assessment_summary(detail) if detail else {"error": f"assessment {assessment_id} not found"}


@mcp.tool(description="List stored underwriting assessments, newest first, optionally filtered by decision (Accept, Refer, Decline (mitigation possible), Auto-Decline).")
def list_assessments(decision: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    rows = [row for row in fetch_history() if decision is None or row["decision"] == decision]
    return [{key: row.get(key) for key in ("id", "property_id", "risk_score", "decision", "final_decision", "review_status", "risk_flags")} for row in rows[:limit]]


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
    """A2A skill handler: property facts start an assessment task; text in, guideline sections out."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        data_parts = get_data_parts(context.message.parts) if context.message else []
        if not data_parts:
            question = context.get_user_input()
            hits = retrieve(question, k=3, ai_note=budget.INTEROP_NOTE)
            text = "\n\n".join(f"[{hit['id']}] {hit['title']}: {hit['text']}" for hit in hits) or "No guidance retrieved (retrieval needs AI_API_KEY)."
            await event_queue.enqueue_event(new_text_message(text, context_id=context.context_id, task_id=context.task_id))
            return
        if context.current_task:
            await event_queue.enqueue_event(new_text_message("This task already has an assessment; read it with tasks/get.", context_id=context.context_id, task_id=context.task_id))
            return
        from app.agents.graph import run_graph
        from app.db import save_submission

        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        await event_queue.enqueue_event(new_task(context.task_id, context.context_id, TaskState.TASK_STATE_SUBMITTED, history=[context.message]))
        facts = dict(data_parts[0])
        missing = [name for name in A2A_REQUIRED if facts.get(name) in (None, "")]
        if missing:
            await updater.reject(updater.new_agent_message([new_text_part(f"Missing required facts: {', '.join(missing)}. Send them in a new task.")]))
            return
        await updater.start_work()
        facts.setdefault("property_id", f"A2A-{context.task_id[:8]}")
        state = run_graph(facts, thread_id=f"a2a:{context.context_id}:{context.task_id}", ai_note=budget.INTEROP_NOTE)
        detail = fetch_submission_detail(save_submission(state)["id"])
        await updater.add_artifact([new_data_part(task_result(detail))], name="assessment")
        if detail["review_status"] == "pending_review":
            await updater.update_status(TaskState.TASK_STATE_WORKING, message=updater.new_agent_message([new_text_part(AWAITING)]))
        else:
            await updater.complete()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        raise NotImplementedError("Assessments run to completion and cannot be cancelled")


A2A_REQUIRED = ("construction_type", "occupancy_type", "cat_zone", "sprinkler_system")
AWAITING = "Referred to an underwriter. The task stays working until they sign off; check it again with tasks/get."
INDICATIVE = "Indicative assessment from a demo service, decided by fixed rules; not a quote, a policy or a binding underwriting decision."


def task_result(detail: dict[str, Any]) -> dict[str, Any]:
    return {**assessment_summary(detail), "reviewer": detail.get("reviewer"), "reviewed_at": detail.get("reviewed_at"), "review_note": detail.get("review_note"), "notice": INDICATIVE}


def assessment_task(task_id: str) -> Task | None:
    """The A2A task rebuilt from its stored assessment, so it outlives the serverless instance."""
    submission_id = submission_for_thread(f":{task_id}")
    detail = fetch_submission_detail(submission_id) if submission_id else None
    if detail is None:
        return None
    context_id = detail["thread_id"][4 : -len(task_id) - 1]
    waiting = detail["review_status"] == "pending_review"
    task = new_task(task_id, context_id, TaskState.TASK_STATE_WORKING if waiting else TaskState.TASK_STATE_COMPLETED, artifacts=[new_data_artifact("assessment", task_result(detail))])
    if waiting:
        task.status.message.CopyFrom(new_text_message(AWAITING, context_id=context_id, task_id=task_id))
    return task


class AssessmentTaskStore(InMemoryTaskStore):
    """Keeps in-flight tasks in memory and reads settled ones from the assessment table."""

    async def get(self, task_id: str, context: ServerCallContext) -> Task | None:
        task = await super().get(task_id, context)
        if task is not None and task.status.state != TaskState.TASK_STATE_WORKING:
            return task
        return await run_in_threadpool(assessment_task, task_id) or task


def agent_card() -> AgentCard:
    return AgentCard(
        name="imaarat.ai",
        description="Commercial property underwriting agent for Indian properties: deterministic risk scoring, Gemini Vision and RAG evidence, and a validated AI memo.",
        version="1.1.0",
        supported_interfaces=[AgentInterface(url=f"{public_base_url()}/a2a", protocol_binding="JSONRPC", protocol_version="1.0")],
        capabilities=AgentCapabilities(streaming=False, push_notifications=False),
        default_input_modes=["application/json", "text/plain"],
        default_output_modes=["application/json", "text/plain"],
        skills=[
            AgentSkill(
                id="assess_property",
                name="Assess property",
                description="Send property facts as a JSON data part (construction_type, occupancy_type, cat_zone and sprinkler_system are required). The task returns the risk score, decision, rationale and guideline citations. A referred case stays working until an underwriter signs off; read it again with tasks/get.",
                tags=["underwriting", "risk", "insurance"],
                examples=[
                    json.dumps(
                        {"construction_type": "Frame", "occupancy_type": "Warehouse", "cat_zone": "Flood", "roof_age_years": 32, "sprinkler_system": "N", "prior_claims_count_5yr": 3, "tiv": 30000000}
                    )
                ],
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
    handler = DefaultRequestHandler(agent_executor=UnderwritingAgentExecutor(), task_store=AssessmentTaskStore(), agent_card=card)
    add_a2a_routes_to_fastapi(
        app,
        agent_card_routes=create_agent_card_routes(card),
        jsonrpc_routes=create_jsonrpc_routes(handler, rpc_url="/a2a"),
    )


async def serve_mcp(scope: Scope, receive: Receive, send: Send) -> None:
    """Serve one stateless MCP request with its own session manager."""
    app = mcp_app()
    async with app.router.lifespan_context(app):
        await app(scope, receive, send)


def interop_app() -> FastAPI:
    """Build the app that serves the MCP server and the A2A agent."""
    app = FastAPI()
    app.mount("/mcp", serve_mcp)
    add_a2a(app)
    return app
