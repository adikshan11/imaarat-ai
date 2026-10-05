from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

from app.config import HAZARD_JSON

ZONE_ORDER = ["II", "III", "IV", "V"]
FLOOD_FLAG_PCT = 10.0
CYCLONE_FLAG_GRADES = ("P1", "P2")


@lru_cache(maxsize=1)
def hazard_table() -> dict[str, Any]:
    return json.loads(HAZARD_JSON.read_text(encoding="utf-8"))


def lookup(pincode: Any) -> dict[str, Any] | None:
    digits = re.sub(r"\D", "", str(pincode or ""))
    if len(digits) != 6:
        return None
    table = hazard_table()
    row = table["pincodes"].get(digits)
    if row is None:
        return None
    return {"pincode": digits, **dict(zip(table["fields"], row)), "built_at": table["built_at"]}


def hazard_flags(hazard: dict[str, Any] | None, declared_zone: str | None) -> list[str]:
    if not hazard:
        return []
    flags = []
    official = hazard.get("seismic_zone")
    if official in ZONE_ORDER and declared_zone in ZONE_ORDER and ZONE_ORDER.index(official) > ZONE_ORDER.index(declared_zone):
        flags.append("declared_seismic_zone_below_official")
    if (hazard.get("flood_area_pct") or 0) >= FLOOD_FLAG_PCT or (hazard.get("urban_flood_points") or 0) >= 1:
        flags.append("flood_history_at_pincode")
    if hazard.get("cyclone_grade") in CYCLONE_FLAG_GRADES:
        flags.append("imd_cyclone_prone_district")
    return flags


def verify_location(features: dict[str, Any]) -> dict[str, Any]:
    hazard = lookup(features.get("zip"))
    if hazard is None:
        return {**features, "official_hazard": None}
    declared = features.get("seismic_zone")
    official = hazard.get("seismic_zone")
    verified = dict(features)
    verified["official_hazard"] = hazard
    verified["seismic_zone_declared"] = declared
    if official in ZONE_ORDER and (declared not in ZONE_ORDER or ZONE_ORDER.index(official) > ZONE_ORDER.index(declared)):
        verified["seismic_zone"] = official
    verified["hazard_flags"] = hazard_flags(hazard, declared)
    return verified


def sources() -> dict[str, Any]:
    table = hazard_table()
    return {"built_at": table["built_at"], "sources": table["sources"], "pincodes": len(table["pincodes"])}
