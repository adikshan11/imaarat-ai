from pathlib import Path

import app.agents.graph as graph
import pytest
from app import auth, budget, config
from app.api import main
from fastapi.testclient import TestClient


class Stored(Exception):
    pass


def proposal() -> dict:
    return {
        "property_id": "../../escape",
        "address": "1 Road",
        "city": "Pune",
        "state": "Maharashtra",
        "zip": "411001",
        "latitude": "18.5",
        "longitude": "73.8",
        "construction_type": "Frame",
        "year_built": "2000",
        "square_footage": "1000",
        "occupancy_type": "Office",
        "num_stories": "1",
        "sprinkler_system": "N",
        "cat_zone": "None",
        "submission_date": "2026-10-07",
    }


def test_uploaded_photo_gets_a_random_name_inside_the_upload_folder(tmp_path, monkeypatch, photo):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "app.db")

    def capture(raw_input, image_path=None, ai_note=None):
        raise Stored(image_path)

    monkeypatch.setattr(graph, "run_graph", capture)
    with pytest.raises(Stored) as stored:
        TestClient(main.app).post("/underwrite/submit", data=proposal(), files={"image": ("../../../evil.png", photo("PNG"), "image/png")})
    path = Path(stored.value.args[0])
    assert path.parent == tmp_path / "images_uploads"
    assert path.suffix == ".png" and "evil" not in path.name and "escape" not in path.name
    assert path.read_bytes() == photo("PNG")


def test_property_photo_must_be_a_real_small_image(monkeypatch, photo):
    monkeypatch.setattr(main.images, "PROPERTY", main.images.ImageRule("property photo", 2000))
    client = TestClient(main.app)
    assert client.post("/underwrite/submit", data=proposal(), files={"image": ("a.png", b"\x89PNG", "image/png")}).status_code == 415
    assert client.post("/underwrite/submit", data=proposal(), files={"image": ("a.png", b"\x89PNG" + bytes(3000), "image/png")}).status_code == 413
    assert client.get("/uploads/limits").json()["types"] == ["image/jpeg", "image/png", "image/webp"]


@pytest.mark.parametrize(("required", "member", "note"), [(False, False, None), (True, False, budget.SIGN_IN_NOTE), (True, True, None)])
def test_live_ai_sign_in_switch(monkeypatch, required, member, note):
    monkeypatch.setattr(config, "AI_SIGN_IN_REQUIRED", required)
    monkeypatch.setattr(auth, "signed_in", lambda request: member)
    monkeypatch.setattr(budget, "admission_note", lambda address: None)

    def capture(raw_input, image_path=None, ai_note=None):
        raise Stored(ai_note)

    monkeypatch.setattr(graph, "run_graph", capture)
    with pytest.raises(Stored) as stored:
        TestClient(main.app).post("/underwrite/submit", data=proposal())
    assert stored.value.args[0] == note
