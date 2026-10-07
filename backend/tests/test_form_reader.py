import json

from app import config
from app.api import main
from app.tools import form_reader
from app.tools.form_reader import validate
from fastapi.testclient import TestClient


def reading(**values):
    return {name: {"value": value, "confidence": "high", "box_2d": [100, 100, 140, 400]} for name, value in values.items()}


def test_values_are_cleaned_and_checked_outside_the_model():
    fields = validate(reading(zip="781 001", year_built="1998", building_value_inr="₹2,50,00,000", construction_type="fire resistive", sprinkler_system="yes", fire_alarm="no"))["fields"]
    assert fields["zip"]["value"] == "781001" and fields["zip"]["issue"] is None
    assert fields["year_built"]["value"] == 1998
    assert fields["building_value_inr"]["value"] == 25000000
    assert fields["construction_type"]["value"] == "Fire Resistive"
    assert fields["sprinkler_system"]["value"] == "Y"
    assert fields["fire_alarm"]["value"] is False


def test_blank_and_invalid_values_are_never_filled():
    fields = validate(reading(zip="12345", year_built="2999", seismic_zone="VI", num_stories=None))["fields"]
    assert fields["zip"]["issue"] == "not_six_digits"
    assert fields["year_built"]["issue"] == "out_of_range"
    assert fields["seismic_zone"]["value"] is None and fields["seismic_zone"]["issue"] == "not_an_option"
    assert fields["num_stories"]["value"] is None and fields["num_stories"]["confidence"] == "low"
    assert fields["address"]["value"] is None


def test_unknown_pincode_is_flagged():
    assert validate(reading(zip="000000"))["fields"]["zip"]["issue"] == "unknown_pincode"


def test_money_pincode_and_year_need_confirmation():
    fields = validate(reading(zip="781001", year_built="1998", city="Guwahati"))["fields"]
    assert fields["zip"]["needs_confirmation"] and fields["year_built"]["needs_confirmation"]
    assert not fields["city"]["needs_confirmation"]


def test_endpoint_is_off_without_a_key(monkeypatch):
    monkeypatch.setattr(config, "AI_API_KEY", "")
    response = TestClient(main.app).post("/underwrite/read-form", files={"image": ("page.jpg", b"x", "image/jpeg")})
    assert response.status_code == 503


def test_endpoint_returns_checked_reading(monkeypatch):
    monkeypatch.setattr(config, "AI_API_KEY", "set")
    monkeypatch.setattr(form_reader.llm, "generate", lambda *args, **kwargs: {"text": json.dumps(reading(zip="700001", city="Kolkata")), "model": "test-model"})
    response = TestClient(main.app).post("/underwrite/read-form", files={"image": ("page.jpg", b"x", "image/jpeg")})
    body = response.json()
    assert response.status_code == 200
    assert body["fields"]["zip"]["value"] == "700001"
    assert body["fields"]["city"]["value"] == "Kolkata"
    assert body["model"] == "test-model"


def test_endpoint_rejects_other_file_types(monkeypatch):
    monkeypatch.setattr(config, "AI_API_KEY", "set")
    response = TestClient(main.app).post("/underwrite/read-form", files={"image": ("page.pdf", b"x", "application/pdf")})
    assert response.status_code == 415


def test_letters_in_numbers_are_flagged_not_dropped():
    fields = validate(reading(year_built="2O19", building_value_inr="2,5O,00,000", stock_inventory_value_inr="Rs. 80,00,000/-"))["fields"]
    assert fields["year_built"]["value"] is None and fields["year_built"]["issue"] == "not_a_number"
    assert fields["building_value_inr"]["value"] is None and fields["building_value_inr"]["issue"] == "not_a_number"
    assert fields["stock_inventory_value_inr"]["value"] == 8000000


def test_printed_option_wording_maps_to_the_option():
    assert form_reader.check("construction_type", "Fire resistive (RCC)") == ("Fire Resistive", None)
    assert form_reader.check("construction_type", "Masonry non-combustible") == ("Masonry Non-Combustible", None)
    assert form_reader.check("construction_type", "फ्रेम (लकड़ी) · Frame") == ("Frame", None)
    assert form_reader.check("cat_zone", "Wind / cyclone") == ("Wind", None)
    assert form_reader.check("seismic_zone", "III") == ("III", None)
    assert form_reader.check("seismic_zone", "IV") == ("IV", None)
    assert form_reader.check("cat_zone", "बाढ़") == (None, "not_an_option")
