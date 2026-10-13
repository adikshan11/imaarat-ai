import json

from app import auth, budget, config, printouts
from app.api import main
from app.tools import form_reader
from fastapi.testclient import TestClient


def read(client, photo, serial=None):
    return client.post("/underwrite/read-form", files={"image": ("page.jpg", photo(), "image/jpeg")}, data={"serial": serial} if serial else None)


def allow_reading(monkeypatch, serial_text=None):
    monkeypatch.setattr(config, "AI_API_KEY", "set")
    monkeypatch.setattr(auth, "signed_in", lambda request: True)
    monkeypatch.setattr(budget, "admit", lambda address: None)
    reading = {"zip": {"value": "700001", "confidence": "high", "box_2d": None}, "serial": {"value": serial_text, "confidence": "high", "box_2d": None}}
    monkeypatch.setattr(form_reader.llm, "generate", lambda *args, **kwargs: {"text": json.dumps(reading), "model": "test-model"})


def test_serial_survives_misreads_and_rejects_typos():
    issued = printouts.issue("1.2.3.4")
    typed = issued["display"].lower().replace("0", "o").replace("1", "l")
    assert printouts.normalise(typed) == issued["serial"]
    assert printouts.normalise(f"https://imaarat-ai.vercel.app/api/paper/printouts/{issued['serial']}") == issued["serial"]
    assert printouts.normalise(issued["serial"][:-1] + ("0" if issued["serial"][-1] != "0" else "1")) is None


def test_a_printout_works_once_and_expires(monkeypatch):
    serial = printouts.issue(None)["serial"]
    assert printouts.state(serial) == "valid"
    assert printouts.consume(serial) is True
    assert printouts.consume(serial) is False
    assert printouts.state(serial) == "used"
    monkeypatch.setattr(config, "PRINTOUT_SECONDS", -5)
    assert printouts.state(printouts.issue(None)["serial"]) == "expired"


def test_reading_needs_a_fresh_printout_and_uses_it_up(monkeypatch, photo):
    client = TestClient(main.app)
    serial = printouts.issue(None)
    allow_reading(monkeypatch)
    assert read(client, photo).status_code == 422
    assert read(client, photo, "IMR-0000-0000-0000").status_code == 422
    first = read(client, photo, serial["display"])
    assert first.status_code == 200 and first.json()["printout"] == serial["display"]
    assert read(client, photo, serial["display"]).status_code == 409


def test_the_serial_can_be_read_from_the_photo_text(monkeypatch, photo):
    serial = printouts.issue(None)
    allow_reading(monkeypatch, serial["display"])
    assert read(TestClient(main.app), photo).status_code == 200


def test_printing_is_limited_per_visitor(monkeypatch):
    monkeypatch.setattr(config, "PRINTOUT_DAILY_PER_CLIENT", 1)
    client = TestClient(main.app)
    first = client.post("/paper/printouts")
    assert first.status_code == 200 and len(first.json()["qr"]) >= 21
    assert client.post("/paper/printouts").status_code == 429
    assert client.get(f"/paper/printouts/{first.json()['serial']}").json() == {"status": "valid"}
