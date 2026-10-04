import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI

from app.api.main import app as backend
from app.api.main import lifespan

app = FastAPI(title="UW Risk Copilot", lifespan=lifespan)
app.mount("/api", backend)
