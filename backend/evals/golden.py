"""Golden evaluation set: each case varies one baseline property and states the expected outcome.

expected_flags and expected_decision follow the deterministic engine's documented rules;
relevant_guidelines lists the guideline sections a good retriever should return for the case.
"""

from __future__ import annotations

BASELINE = {
    "address": "Eval Street",
    "city": "Pune",
    "state": "MH",
    "construction_type": "Non-Combustible",
    "occupancy_type": "Office",
    "sprinkler_system": "Y",
    "cat_zone": "None",
    "seismic_zone": "II",
    "roof_age_years": 10,
    "distance_to_coast_miles": 20.0,
    "distance_to_fire_zone_miles": 20.0,
    "prior_claims_count_5yr": 0,
    "square_footage": 60000,
    "year_built": 2008,
    "num_stories": 4,
    "tiv": 10_000_000,
}

ROOF_OLD = {"roof_age_years": 35}
FRAME = {"construction_type": "Frame"}
FLOOD = {"cat_zone": "Flood"}
CLAIMS = {"prior_claims_count_5yr": 4}
HIGH_TIV = {"tiv": 30_000_000}

CASES = [
    ("baseline", {}, "Accept", [], ["G6"]),
    ("aging_roof", {"roof_age_years": 25}, "Accept", ["aging_roof"], ["G2"]),
    ("old_roof", ROOF_OLD, "Accept", ["roof_replacement_likely"], ["G2"]),
    ("frame", FRAME, "Accept", ["combustible_construction"], ["G1"]),
    ("warehouse_no_sprinkler", {"occupancy_type": "Warehouse", "sprinkler_system": "N"}, "Accept", ["no_sprinkler_high_hazard_occupancy"], ["G1", "G9"]),
    ("flood_zone", FLOOD, "Accept", ["high_cat_zone_exposure"], ["G3"]),
    ("hail_zone", {"cat_zone": "Hail"}, "Accept", ["moderate_cat_zone_captured"], ["G3"]),
    ("seismic_v", {"seismic_zone": "V"}, "Accept", ["high_seismic_zone"], ["G7"]),
    ("coastal", {"distance_to_coast_miles": 0.5}, "Accept", ["coastal_wind_surge_exposure"], ["G8"]),
    ("wildland", {"distance_to_fire_zone_miles": 0.4}, "Accept", ["wildland_urban_interface"], ["G8"]),
    ("adverse_claims", CLAIMS, "Accept", ["adverse_loss_history"], ["G4"]),
    ("high_tiv", HIGH_TIV, "Accept", ["high_tiv_concentration"], ["G5", "G10"]),
    ("boundary_30", {"roof_age_years": 25, "seismic_zone": "IV"}, "Accept", ["aging_roof", "high_seismic_zone"], ["G2", "G7"]),
    ("wind_claims", {"cat_zone": "Wind", "prior_claims_count_5yr": 3}, "Refer", ["high_cat_zone_exposure", "adverse_loss_history"], ["G3", "G4"]),
    ("frame_old_roof", {**FRAME, **ROOF_OLD}, "Refer", ["roof_replacement_likely", "combustible_construction"], ["G1", "G2"]),
    ("flood_coast_tiv", {**FLOOD, "distance_to_coast_miles": 0.5, **HIGH_TIV}, "Refer", ["high_cat_zone_exposure", "coastal_wind_surge_exposure", "high_tiv_concentration"], ["G3", "G8", "G5"]),
    (
        "seismic_wildfire",
        {"seismic_zone": "IV", "cat_zone": "Wildfire", "distance_to_fire_zone_miles": 0.5},
        "Refer",
        ["high_cat_zone_exposure", "high_seismic_zone", "wildland_urban_interface"],
        ["G7", "G3", "G8"],
    ),
    ("boundary_60", {**ROOF_OLD, "cat_zone": "Wind", "prior_claims_count_5yr": 3}, "Refer", ["roof_replacement_likely", "high_cat_zone_exposure", "adverse_loss_history"], ["G2", "G3", "G4"]),
    (
        "decline_tiv",
        {**ROOF_OLD, "cat_zone": "Wind", "prior_claims_count_5yr": 3, **HIGH_TIV},
        "Decline (mitigation possible)",
        ["roof_replacement_likely", "high_cat_zone_exposure", "adverse_loss_history", "high_tiv_concentration"],
        ["G2", "G3", "G4", "G5"],
    ),
    (
        "decline_coastal_frame",
        {**FRAME, **ROOF_OLD, **FLOOD, "distance_to_coast_miles": 0.5},
        "Decline (mitigation possible)",
        ["roof_replacement_likely", "combustible_construction", "high_cat_zone_exposure", "coastal_wind_surge_exposure"],
        ["G1", "G2", "G3", "G8"],
    ),
    (
        "decline_warehouse_wildfire",
        {"occupancy_type": "Warehouse", "sprinkler_system": "N", **FRAME, "roof_age_years": 25, "cat_zone": "Wildfire", "distance_to_fire_zone_miles": 0.5},
        "Decline (mitigation possible)",
        ["aging_roof", "combustible_construction", "no_sprinkler_high_hazard_occupancy", "high_cat_zone_exposure", "wildland_urban_interface"],
        ["G1", "G9", "G2", "G3", "G8"],
    ),
    (
        "decline_loss_tiv",
        {**ROOF_OLD, **FRAME, **FLOOD, **CLAIMS, **HIGH_TIV},
        "Decline (mitigation possible)",
        ["roof_replacement_likely", "combustible_construction", "high_cat_zone_exposure", "adverse_loss_history", "high_tiv_concentration"],
        ["G2", "G1", "G3", "G4", "G5"],
    ),
    (
        "auto_decline",
        {"occupancy_type": "Industrial", "sprinkler_system": "N", **FRAME, **ROOF_OLD, **FLOOD, **CLAIMS, **HIGH_TIV},
        "Auto-Decline",
        ["roof_replacement_likely", "combustible_construction", "no_sprinkler_high_hazard_occupancy", "high_cat_zone_exposure", "adverse_loss_history", "high_tiv_concentration"],
        ["G1", "G2", "G3", "G4", "G5", "G9"],
    ),
    (
        "auto_decline_capped",
        {
            "occupancy_type": "Industrial",
            "sprinkler_system": "N",
            **FRAME,
            **ROOF_OLD,
            **FLOOD,
            **CLAIMS,
            **HIGH_TIV,
            "seismic_zone": "V",
            "distance_to_coast_miles": 0.5,
            "distance_to_fire_zone_miles": 0.5,
        },
        "Auto-Decline",
        [
            "roof_replacement_likely",
            "combustible_construction",
            "no_sprinkler_high_hazard_occupancy",
            "high_cat_zone_exposure",
            "high_seismic_zone",
            "coastal_wind_surge_exposure",
            "wildland_urban_interface",
            "adverse_loss_history",
            "high_tiv_concentration",
        ],
        ["G1", "G2", "G3", "G7", "G8"],
    ),
]


def golden_cases() -> list[dict]:
    return [
        {
            "id": case_id,
            "facts": {**BASELINE, **overrides, "property_id": f"EVAL-{case_id}"},
            "expected_decision": decision,
            "expected_flags": flags,
            "relevant_guidelines": relevant,
        }
        for case_id, overrides, decision, flags, relevant in CASES
    ]
