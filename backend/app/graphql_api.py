"""Read-only GraphQL API: one query can fetch status, hazards, portfolio totals and a page of submissions; writes stay on REST."""

from enum import Enum

import strawberry
from strawberry.extensions import MaxAliasesLimiter, MaxTokensLimiter, QueryDepthLimiter
from starlette.concurrency import run_in_threadpool
from strawberry.fastapi import GraphQLRouter
from strawberry.scalars import JSON
from strawberry.schema.config import StrawberryConfig

from app.db import fetch_submission_detail, history_page, portfolio_summary
from app.tools.hazard_lookup import lookup as hazard_lookup


@strawberry.enum
class SortKey(Enum):
    CREATED = "created"
    PROPERTY = "property"
    LOCATION = "location"
    SCORE = "score"
    VALUE = "value"


@strawberry.enum
class Direction(Enum):
    ASC = "asc"
    DESC = "desc"


@strawberry.type
class Portfolio:
    submissions: int
    average_score: int
    pending_review: int
    total_value_inr: float
    with_sprinklers: int
    with_fire_alarm: int
    with_flood_protection: int
    mitigation_benefit: float
    decisions: JSON
    bands: JSON
    top_drivers: JSON
    hazard_checks: JSON


@strawberry.type
class SubmissionRow:
    id: int
    property_id: str
    decision: str | None
    final_decision: str | None
    risk_score: int | None
    review_status: str | None
    risk_flags: list[str]
    total_value_at_risk_inr: float | None
    created_at: str
    raw_input: JSON
    prototype_mitigation_model: JSON


@strawberry.type
class HistoryPage:
    total: int
    rows: list[SubmissionRow]


def submission_row(row: dict) -> SubmissionRow:
    return SubmissionRow(
        id=row["id"], property_id=row["property_id"], decision=row["decision"], final_decision=row["final_decision"],
        risk_score=row["risk_score"], review_status=row["review_status"], risk_flags=row["risk_flags"],
        total_value_at_risk_inr=row["total_value_at_risk_inr"], created_at=row["created_at"],
        raw_input=row["raw_input"], prototype_mitigation_model=row["prototype_mitigation_model"],
    )


@strawberry.type
class Query:
    @strawberry.field(description="Version, AI availability and the remaining AI budget.")
    async def status(self) -> JSON:
        from app.api.main import status

        return await run_in_threadpool(status)

    @strawberry.field(description="Hazard data for an Indian PIN code, or null when unknown.")
    async def hazard(self, pincode: str) -> JSON | None:
        return await run_in_threadpool(hazard_lookup, pincode)

    @strawberry.field(description="Totals across every assessment.")
    async def portfolio(self) -> Portfolio:
        summary = await run_in_threadpool(portfolio_summary)
        return Portfolio(**summary)

    @strawberry.field(description="One page of assessments, searched, filtered and sorted on the server.")
    async def history(self, limit: int = 20, offset: int = 0, decision: str | None = None, q: str | None = None,
                      sort: SortKey = SortKey.CREATED, direction: Direction = Direction.DESC) -> HistoryPage:
        rows, total = await run_in_threadpool(history_page, max(1, min(limit, 100)), max(0, offset), decision, q, sort.value, direction.value)
        return HistoryPage(total=total, rows=[submission_row(row) for row in rows])

    @strawberry.field(description="The full stored result of one assessment.")
    async def submission(self, id: int) -> JSON | None:
        return await run_in_threadpool(fetch_submission_detail, id)


schema = strawberry.Schema(
    query=Query,
    config=StrawberryConfig(auto_camel_case=False),
    extensions=[QueryDepthLimiter(max_depth=4), MaxAliasesLimiter(max_alias_count=2), MaxTokensLimiter(max_token_count=1000)],
)
graphql_router = GraphQLRouter(schema)
