import pytest
from fastapi.testclient import TestClient

from app.api import main
from app.tools.hazard_lookup import lookup, verify_location
from app.tools.risk_calculator import risk_score_calculator

# Seismic zones from the IS 1893 (Part 1):2016 town list; cyclone grades from IMD tables 1.1 and 1.2 (June 2023).
GOLDEN = [
    ("110001", "New Delhi", "IV", None),
    ("400001", "Mumbai", "III", None),
    ("600001", "Chennai", "III", "P2"),
    ("560001", "Bengaluru Urban", "II", None),
    ("781001", "Kamrup Metro", "V", None),
    ("370001", "Kachchh", "V", "P2"),
    ("700001", "Kolkata", "III", "P1"),
    ("190001", "Srinagar", "V", None),
    ("500001", "Hyderabad", "II", None),
    ("800001", "Patna", "IV", None),
    ("524001", "Spsr Nellore", "III", "P1"),
    ("754211", "Kendrapara", "III", "P1"),
    ("530001", "Visakhapatanam", "II", "P2"),
]


@pytest.mark.parametrize(("pincode", "district", "zone", "grade"), GOLDEN)
def test_golden_locations(pincode, district, zone, grade):
    found = lookup(pincode)
    assert found["district"] == district
    assert found["seismic_zone"] == zone
    assert found["cyclone_grade"] == grade


def test_town_list_overrides_the_coarse_map():
    # The IS 1893 Annex E town list puts Shimla in Zone IV; the zone polygons place pincode 171001 in V.
    shimla = lookup("171001")
    assert shimla["seismic_zone"] == "IV"
    assert shimla["seismic_zone_map"] == "V"
    assert shimla["seismic_source"] == "IS 1893 town list: Shimla"


def test_rural_pincode_keeps_the_map_zone():
    kendrapara = lookup("754211")
    assert kendrapara["seismic_source"] == "zone map"
    assert kendrapara["seismic_zone"] == kendrapara["seismic_zone_map"]


def test_flood_share_separates_floodplain_from_dry_city():
    assert lookup("787057")["flood_area_pct"] > 50
    assert lookup("560001")["flood_area_pct"] == 0


def test_unknown_or_malformed_pincode_returns_none():
    assert lookup("000000") is None
    assert lookup("12345") is None
    assert lookup(None) is None


def test_understated_seismic_zone_is_scored_at_official_zone():
    features = verify_location({"zip": "781001", "seismic_zone": "II", "construction_type": "Non-Combustible", "cat_zone": "None"})
    assert features["seismic_zone"] == "V"
    assert features["seismic_zone_declared"] == "II"
    scored = risk_score_calculator(features)
    assert "high_seismic_zone" in scored["flags"]
    assert "declared_seismic_zone_below_official" in scored["flags"]
    assert "flood_history_at_pincode" in scored["flags"]


def test_higher_declared_zone_is_kept():
    features = verify_location({"zip": "560001", "seismic_zone": "IV"})
    assert features["seismic_zone"] == "IV"
    assert features["hazard_flags"] == []


def test_without_pincode_scoring_is_unchanged():
    base = {"seismic_zone": "II", "construction_type": "Frame", "cat_zone": "Flood", "roof_age_years": 32}
    assert risk_score_calculator(verify_location(base))["score"] == risk_score_calculator(base)["score"]


def test_hazard_endpoint():
    client = TestClient(main.app)
    assert client.get("/hazard/700001").json()["cyclone_grade"] == "P1"
    assert client.get("/hazard/000000").status_code == 404
    assert client.get("/hazard/sources").json()["pincodes"] > 19000
