import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI

from app.api.main import app as backend
from app.db import init_db, seed_demo_database

seed_demo_database()
init_db()

app = FastAPI(title="UW Risk Copilot")
app.mount("/api", backend)
