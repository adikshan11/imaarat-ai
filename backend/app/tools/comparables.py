from __future__ import annotations

import math

from app.db import reference_candidates
from app.observability import traced

# Prototype similarity weights — not insurer-calibrated
_SIMILARITY_WEIGHTS = {"square_footage": 0.30, "tiv": 0.30, "year_built": 0.20, "roof_age_years": 0.10, "prior_claims_count_5yr": 0.10}
_SCALES = {"square_footage": 1_000_000, "tiv": 1_000_000_000, "year_built": 50, "roof_age_years": 30, "prior_claims_count_5yr": 5}
_K_MIN, _K_MAX = 1, 20

_COLUMNS = ("property_id", "address", "city", "state", "construction_type", "occupancy_type", "cat_zone", "year_built", "roof_age_years", "square_footage", "tiv", "prior_claims_count_5yr")


def _safe(value: object) -> float | None:
    try:
        if value is None or str(value).strip() == "":
            return None
        f = float(value)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _similarity_distance(target: dict, row: dict) -> float:
    dist = 0.0
    for field, weight in _SIMILARITY_WEIGHTS.items():
        tv, rv = _safe(target.get(field)), _safe(row.get(field))
        if tv is not None and rv is not None:
            scale = _SCALES.get(field) or 1
            dist += weight * abs(tv - rv) / scale
    return dist


@traced("reference_properties", as_type="retriever")
def comparable_lookup(features: dict, k: int = 5) -> list[dict]:
    """Return reference properties ranked by multi-attribute similarity.

    These are synthetic reference records, not verified market comparables.
    """
    k = max(_K_MIN, min(_K_MAX, k))
    target_id = features.get("property_id")

    candidates: list[dict] = []
    for filters in (
        {"construction_type": features.get("construction_type"), "occupancy_type": features.get("occupancy_type"), "cat_zone": features.get("cat_zone")},
        {"construction_type": features.get("construction_type"), "occupancy_type": features.get("occupancy_type")},
        {"occupancy_type": features.get("occupancy_type")},
    ):
        candidates = reference_candidates(filters, target_id)
        if candidates:
            break
    if not candidates:
        return []

    ranked = sorted(candidates, key=lambda row: (_similarity_distance(features, row), row.get("property_id", "")))
    return [{column: row.get(column) for column in _COLUMNS} for row in ranked[:k]]
