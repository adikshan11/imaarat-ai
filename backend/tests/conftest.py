from io import BytesIO
from queue import Empty

import pytest
from app import db, telemetry
from PIL import Image


@pytest.fixture
def photo():
    def encode(kind="JPEG", size=(32, 24)):
        output = BytesIO()
        Image.new("RGB", size, "teal").save(output, kind)
        return output.getvalue()

    return encode


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")


@pytest.fixture(autouse=True)
def empty_telemetry_queue():
    with telemetry.flush_lock:
        while True:
            try:
                telemetry.pending.get_nowait()
            except Empty:
                break
