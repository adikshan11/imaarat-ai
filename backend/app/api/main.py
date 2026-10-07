from __future__ import annotations

import json
import math
import time
from contextlib import asynccontextmanager
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from app import __version__, auth, budget, llm, telemetry
from app.api.auth_routes import router as auth_router
from app.config import AI_API_KEY, DB_PATH, QDRANT_URL
from app.db import fetch_submission_detail, history_page, init_db, is_postgres, portfolio_summary, record_review, save_submission, seed_demo_database
from app.graphql_api import graphql_router
from app.interop import add_a2a, mcp, mcp_app
from app.observability import ENABLED as TRACING_ENABLED
from app.observability import flush
from app.reports import build_submission_pdf
from app.schemas import decision_from_score, indicative_product_segment
from app.tools.form_reader import read_form
from app.tools.hazard_lookup import lookup as hazard_lookup
from app.tools.hazard_lookup import sources as hazard_sources
from app.tools.hazard_lookup import verify_location

IMAGE_SUFFIXES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_demo_database()
    init_db()
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="imaarat.ai", lifespan=lifespan)


@app.middleware("http")
async def record_requests(request: Request, call_next: Any) -> Any:
    started = time.perf_counter()
    status, error_type = 500, None
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    except Exception as error:
        error_type = type(error).__name__
        raise
    finally:
        route = getattr(request.scope.get("route"), "path", None) or "unmatched"
        if route not in ("/health", "/ops/summary"):
            telemetry.record_request(route, request.method, status, round((time.perf_counter() - started) * 1000), error_type)


app.mount("/mcp", mcp_app())
app.include_router(graphql_router, prefix="/graphql")
app.include_router(auth_router)
add_a2a(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):(3000|5173)$",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, Any]:
    ready, reason = budget.ai_ready()
    return {
        "version": __version__,
        "ai": ready,
        "ai_reason": reason,
        "ai_budget": budget.remaining(),
        "vector_store": "qdrant" if QDRANT_URL and AI_API_KEY else "local",
        "tracing": TRACING_ENABLED,
        "persistent_storage": is_postgres(),
    }


def property_tiv_from_components(*values: float | None, fallback: float | None) -> float | None:
    supplied = [value for value in values if value is not None]
    if supplied:
        return sum(supplied)
    return fallback


@app.post("/underwrite/submit")
async def submit_underwriting(
    request: Request,
    proposer_name: str | None = Form(default=None),
    insured_legal_name: str | None = Form(default=None),
    business_name: str | None = Form(default=None),
    contact_person: str | None = Form(default=None),
    designation: str | None = Form(default=None),
    mobile: str | None = Form(default=None),
    email: str | None = Form(default=None),
    policy_period_start: str | None = Form(default=None),
    policy_period_end: str | None = Form(default=None),
    interested_parties: str | None = Form(default=None),
    financial_institution: str | None = Form(default=None),
    property_id: str = Form(...),
    address: str = Form(...),
    city: str = Form(...),
    state: str = Form(...),
    zip: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    construction_type: str = Form(...),
    year_built: int = Form(...),
    wall_material: str | None = Form(default=None),
    floor_material: str | None = Form(default=None),
    roof_material: str | None = Form(default=None),
    building_height_m: float | None = Form(default=None),
    roof_type: str | None = Form(default=None),
    roof_age_years: int | None = Form(default=None),
    square_footage: int = Form(...),
    occupancy_type: str = Form(...),
    business_activity: str | None = Form(default=None),
    is_manufacturing: bool | None = Form(default=None),
    manufacturing_process: str | None = Form(default=None),
    is_warehouse_storage: bool | None = Form(default=None),
    goods_stored: str | None = Form(default=None),
    num_stories: int = Form(...),
    sprinkler_system: str = Form(...),
    fire_alarm: bool | None = Form(default=None),
    flood_protection: bool | None = Form(default=None),
    generator: bool | None = Form(default=None),
    drainage: bool | None = Form(default=None),
    security_protective_safeguards: bool | None = Form(default=None),
    cat_zone: str = Form(...),
    policy_type: str | None = Form(default=None),
    seismic_zone: str = Form(default="II"),
    rsmd_cover: bool | None = Form(default=None),
    terrorism_cover: bool | None = Form(default=None),
    earthquake_cover: bool | None = Form(default=None),
    flood_cover: bool | None = Form(default=None),
    cyclone_wind_cover: bool | None = Form(default=None),
    distance_to_coast_miles: float | None = Form(default=None),
    distance_to_fire_zone_miles: float | None = Form(default=None),
    prior_claims_count_5yr: int | None = Form(default=None),
    prior_claims_total_amount: float | None = Form(default=None),
    last_loss_date: str | None = Form(default=None),
    building_value_inr: float | None = Form(default=None),
    plant_machinery_value_inr: float | None = Form(default=None),
    furniture_fixtures_equipment_value_inr: float | None = Form(default=None),
    stock_inventory_value_inr: float | None = Form(default=None),
    other_contents_value_inr: float | None = Form(default=None),
    contents_value_inr: float | None = Form(default=None),
    business_interruption_cover: bool | None = Form(default=None),
    business_interruption_value_inr: float | None = Form(default=None),
    annual_gross_profit_inr: float | None = Form(default=None),
    indemnity_period_months: int | None = Form(default=None),
    tiv: float | None = Form(default=None),
    submission_date: str = Form(...),
    image: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    total_value_at_risk_inr = property_tiv_from_components(
        building_value_inr,
        plant_machinery_value_inr,
        furniture_fixtures_equipment_value_inr,
        stock_inventory_value_inr,
        other_contents_value_inr if other_contents_value_inr is not None else contents_value_inr,
        fallback=tiv,
    )
    derived_policy_type = indicative_product_segment(total_value_at_risk_inr) if total_value_at_risk_inr is not None else policy_type
    raw_input = {
        "proposer_name": proposer_name,
        "insured_legal_name": insured_legal_name,
        "business_name": business_name,
        "contact_person": contact_person,
        "designation": designation,
        "mobile": mobile,
        "email": email,
        "policy_period_start": policy_period_start,
        "policy_period_end": policy_period_end,
        "interested_parties": interested_parties,
        "financial_institution": financial_institution,
        "property_id": property_id,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip,
        "latitude": latitude,
        "longitude": longitude,
        "construction_type": construction_type,
        "year_built": year_built,
        "wall_material": wall_material,
        "floor_material": floor_material,
        "roof_material": roof_material,
        "building_height_m": building_height_m,
        "roof_type": roof_type,
        "roof_age_years": roof_age_years,
        "square_footage": square_footage,
        "occupancy_type": occupancy_type,
        "business_activity": business_activity,
        "is_manufacturing": is_manufacturing,
        "manufacturing_process": manufacturing_process,
        "is_warehouse_storage": is_warehouse_storage,
        "goods_stored": goods_stored,
        "num_stories": num_stories,
        "sprinkler_system": sprinkler_system,
        "fire_alarm": fire_alarm,
        "flood_protection": flood_protection,
        "generator": generator,
        "drainage": drainage,
        "security_protective_safeguards": security_protective_safeguards,
        "cat_zone": cat_zone,
        "policy_type": derived_policy_type,
        "total_value_at_risk_inr": total_value_at_risk_inr,
        "seismic_zone": seismic_zone,
        "rsmd_cover": rsmd_cover,
        "terrorism_cover": terrorism_cover,
        "earthquake_cover": earthquake_cover,
        "flood_cover": flood_cover,
        "cyclone_wind_cover": cyclone_wind_cover,
        "distance_to_coast_miles": distance_to_coast_miles,
        "distance_to_fire_zone_miles": distance_to_fire_zone_miles,
        "prior_claims_count_5yr": prior_claims_count_5yr,
        "prior_claims_total_amount": prior_claims_total_amount,
        "last_loss_date": last_loss_date,
        "building_value_inr": building_value_inr,
        "plant_machinery_value_inr": plant_machinery_value_inr,
        "furniture_fixtures_equipment_value_inr": furniture_fixtures_equipment_value_inr,
        "stock_inventory_value_inr": stock_inventory_value_inr,
        "other_contents_value_inr": other_contents_value_inr,
        "contents_value_inr": contents_value_inr,
        "business_interruption_cover": business_interruption_cover,
        "business_interruption_value_inr": business_interruption_value_inr,
        "annual_gross_profit_inr": annual_gross_profit_inr,
        "indemnity_period_months": indemnity_period_months,
        "tiv": total_value_at_risk_inr,
        "submission_date": submission_date,
    }
    image_path = None
    if image is not None:
        local_dir = DB_PATH.parent / "images_uploads"
        local_dir.mkdir(parents=True, exist_ok=True)
        image_path = str(local_dir / f"{uuid4().hex}{IMAGE_SUFFIXES.get(image.content_type or '', '.img')}")
        image_bytes = await image.read()
        with open(image_path, "wb") as out:
            out.write(image_bytes)
        print("IMAGE_RECEIVED=true")
        print(f"IMAGE_SIZE_BYTES={len(image_bytes)}")
        print(f"IMAGE_MIME_TYPE={image.content_type or 'unknown'}")
        print(f"[POST /underwrite/submit] IMAGE RECEIVED: {image.filename}, SIZE: {len(image_bytes)} bytes")

    from app.agents.graph import run_graph

    note = await run_in_threadpool(budget.admission_note, budget.client_address(request.headers, request.client.host if request.client else None))
    result = await run_in_threadpool(run_graph, raw_input, image_path=image_path, ai_note=note)
    result["raw_input"] = raw_input
    result["policy_type"] = derived_policy_type
    result["total_value_at_risk_inr"] = total_value_at_risk_inr
    result["prototype_mitigation_model"] = result.get("prototype_mitigation_model", {})
    model = result["prototype_mitigation_model"]
    result["authoritative_risk_score"] = result["risk_score"]
    result["mitigation_benefits"] = model.get("mitigation_benefits", [])
    result["prototype_mitigation_total"] = model.get("mitigation_benefit", 0)
    result["positive_factors"] = model.get("positive_factors", [])
    result["risk_profile"] = model.get("risk_profile", [])
    result["ai_memo_status"] = result.get("ai_memo_status") or ("Available" if result.get("memo_json") else "Unavailable")
    result["ai_memo_reason"] = (result.get("ai_memo_reason") or result.get("memo_error")) if result["ai_memo_status"] != "Available" else ""
    result["memo_json"] = result.get("memo_json", {})
    saved = await run_in_threadpool(save_submission, result)
    result["id"] = saved.get("id")
    flush()
    return result


@app.post("/underwrite/preview")
async def preview_underwriting(request: Request) -> dict[str, Any]:
    """Run deterministic backend recalculation without creating a history record."""
    form = await request.form()

    def text(name: str) -> str | None:
        raw = form.get(name)
        return str(raw) if raw not in (None, "") else None

    def number(name: str) -> float | None:
        raw = text(name)
        if raw is None:
            return None
        try:
            parsed = float(raw)
        except ValueError:
            return None
        return None if math.isnan(parsed) else parsed

    def boolean(name: str) -> bool | None:
        raw = text(name)
        return None if raw is None else raw.lower() in ("true", "1", "yes", "on")

    preview_tiv = property_tiv_from_components(
        number("building_value_inr"),
        number("plant_machinery_value_inr"),
        number("furniture_fixtures_equipment_value_inr"),
        number("stock_inventory_value_inr"),
        number("other_contents_value_inr") if number("other_contents_value_inr") is not None else number("contents_value_inr"),
        fallback=number("tiv"),
    )
    features = {
        "roof_age_years": int(number("roof_age_years") or 0),
        "year_built": int(number("year_built") or 2000),
        "square_footage": number("square_footage") or 1000,
        "construction_type": text("construction_type"),
        "sprinkler_system": text("sprinkler_system"),
        "occupancy_type": text("occupancy_type"),
        "cat_zone": text("cat_zone"),
        "seismic_zone": text("seismic_zone") or "II",
        "distance_to_coast_miles": number("distance_to_coast_miles"),
        "distance_to_fire_zone_miles": number("distance_to_fire_zone_miles"),
        "prior_claims_count_5yr": number("prior_claims_count_5yr"),
        "prior_claims_total_amount": number("prior_claims_total_amount"),
        "tiv": preview_tiv,
        "fire_alarm": boolean("fire_alarm"),
        "flood_protection": boolean("flood_protection"),
        "generator": boolean("generator"),
        "drainage": boolean("drainage"),
        "security_protective_safeguards": boolean("security_protective_safeguards"),
        "zip": text("zip"),
    }
    from app.tools.risk_calculator import risk_score_calculator

    features = verify_location(features)
    score_data = risk_score_calculator(features)
    model = score_data["prototype_mitigation_model"]
    auth_score = score_data["score"]
    return {
        "risk_score": auth_score,
        "authoritative_risk_score": auth_score,
        "authoritative_decision": decision_from_score(auth_score),
        "official_hazard": features["official_hazard"],
        "seismic_zone_used": features["seismic_zone"],
        "policy_type": indicative_product_segment(preview_tiv) if preview_tiv is not None else None,
        "risk_flags": score_data["flags"],
        "risk_breakdown": score_data["breakdown"],
        "prototype_mitigation_model": model,
        "mitigation_benefits": model["mitigation_benefits"],
        "prototype_mitigation_total": model["mitigation_benefit"],
        "positive_factors": model["positive_factors"],
        "risk_profile": model["risk_profile"],
    }


class Review(BaseModel):
    final_decision: str
    reviewer: str
    note: str = ""


@app.post("/underwrite/history/{submission_id}/review")
def review_submission(submission_id: int, review: Review, request: Request) -> dict[str, Any]:
    """Resume a paused referral with the underwriter's decision (LangGraph human-in-the-loop)."""
    from app.agents.graph import REVIEW_DECISIONS, resume_review

    auth.require_reviewer(request)

    detail = fetch_submission_detail(submission_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if detail.get("review_status") != "pending_review":
        raise HTTPException(status_code=409, detail="This submission is not awaiting review")
    if review.final_decision not in REVIEW_DECISIONS:
        raise HTTPException(status_code=422, detail=f"final_decision must be one of {', '.join(REVIEW_DECISIONS)}")
    if review.final_decision != detail["decision"] and not review.note.strip():
        raise HTTPException(status_code=422, detail="An override needs a note explaining why")
    status = "overridden" if review.final_decision != detail["decision"] else "approved"
    try:
        resume_review(detail["thread_id"], review.final_decision, review.reviewer, review.note)
    except Exception as exc:
        print(f"[review] {submission_id} graph resume unavailable: {type(exc).__name__}: {exc}")
    record_review(submission_id, review.final_decision, review.reviewer, review.note, status)
    flush()
    return fetch_submission_detail(submission_id) or {}


@app.post("/underwrite/read-form")
async def read_paper_form(request: Request, image: UploadFile = File(...)) -> dict[str, Any]:
    ready, reason = budget.ai_ready()
    if not ready:
        raise HTTPException(status_code=503, detail=f"AI form reading is switched off on this deployment: {reason}")
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG or WebP photo of the form")
    data = await image.read()
    if len(data) > 4_000_000:
        raise HTTPException(status_code=413, detail="The photo is larger than 4 MB")
    try:
        await run_in_threadpool(budget.admit, budget.client_address(request.headers, request.client.host if request.client else None))
    except budget.BudgetExceeded as exceeded:
        raise HTTPException(status_code=429, detail=str(exceeded), headers={"Retry-After": str(exceeded.retry_after)}) from exceeded
    try:
        return await run_in_threadpool(read_form, data, image.content_type)
    except budget.BudgetExceeded as exceeded:
        raise HTTPException(status_code=429, detail=f"The form could not be read. {llm.failure_reason(exceeded)}", headers={"Retry-After": str(exceeded.retry_after)}) from exceeded
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"The form could not be read. {llm.failure_reason(error)}") from error


@app.get("/hazard/sources")
def hazard_source_list() -> dict[str, Any]:
    return hazard_sources()


@app.get("/hazard/{pincode}")
def hazard(pincode: str) -> dict[str, Any]:
    found = hazard_lookup(pincode)
    if found is None:
        raise HTTPException(status_code=404, detail="No hazard data for this pincode")
    return found


@app.get("/underwrite/analytics")
def analytics() -> dict[str, Any]:
    """Latest dbt mart snapshot: Postgres when the nightly pipeline has published one, else the bundled file."""
    from sqlalchemy import inspect as sql_inspect
    from sqlalchemy import text

    from app.config import DATA_DIR
    from app.db import get_engine, is_postgres

    if is_postgres() and sql_inspect(get_engine()).has_table("analytics_snapshots"):
        with get_engine().connect() as conn:
            row = conn.execute(text("SELECT payload FROM analytics_snapshots ORDER BY id DESC LIMIT 1")).first()
        if row:
            return json.loads(row.payload)
    bundled = DATA_DIR / "analytics" / "latest.json"
    if bundled.exists():
        return json.loads(bundled.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="No analytics snapshot yet; run the pipeline")


@app.get("/underwrite/evals")
def evals() -> dict[str, Any]:
    """Latest evaluation report written by evals/run_evals.py."""
    from app.config import BASE_DIR

    report = BASE_DIR / "evals" / "results" / "latest.json"
    from app.evaluation import empty_report

    if not report.exists():
        return empty_report()
    data = json.loads(report.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else empty_report()


@app.get("/underwrite/history")
def history(
    response: Response,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    decision: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    sort: Literal["created", "property", "location", "score", "value"] = "created",
    direction: Literal["asc", "desc"] = "desc",
) -> list[dict[str, Any]]:
    rows, total = history_page(limit, offset, decision, q, sort, direction)
    response.headers["X-Total-Count"] = str(total)
    return rows


@app.get("/ops/summary")
def ops_summary(hours: int = Query(default=24, ge=1, le=336)) -> dict[str, Any]:
    return telemetry.summary(hours)


@app.get("/underwrite/portfolio")
def portfolio() -> dict[str, Any]:
    return portfolio_summary()


@app.get("/underwrite/history/{submission_id}")
def history_detail(submission_id: int) -> dict[str, Any]:
    detail = fetch_submission_detail(submission_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return detail


@app.get("/underwrite/history/{submission_id}/report.pdf")
def history_report(submission_id: int) -> Response:
    detail = fetch_submission_detail(submission_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    try:
        pdf = build_submission_pdf(detail)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Report generation unavailable: {type(exc).__name__}: {exc}") from exc
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="underwriting-{submission_id}.pdf"'},
    )
