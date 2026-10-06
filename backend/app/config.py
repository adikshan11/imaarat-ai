from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=str(ENV_FILE))

DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
DEMO_DB_PATH = DATA_DIR / "demo" / "uw_risk.db"
WRITABLE_DIR = Path("/tmp/imaarat") if os.getenv("VERCEL") else DATA_DIR
DB_DIR = WRITABLE_DIR / "db"

DB_PATH = DB_DIR / "uw_risk.db"
PROPERTIES_CSV = RAW_DIR / "properties.csv"
GUIDELINES_PDF = RAW_DIR / "underwriting_guidelines.pdf"
GUIDELINES_MD = RAW_DIR / "underwriting_guidelines.md"
HAZARD_JSON = DATA_DIR / "hazard" / "pincode_hazard.json"

GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
PROMPT_FORMAT = os.getenv("PROMPT_FORMAT", "toon")
GEMINI_EMBEDDING_MODEL_NAME = "models/gemini-embedding-001"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION = "underwriting_guidelines"
GEMINI_TIMEOUT_MS = 25_000
AI_REQUEST_SECONDS = 50
STAGE_THINKING = {"paper_form": "LOW", "vision": "LOW"}
GEMINI_ATTEMPTS = 2
AI_DAILY_ADMISSIONS = int(os.getenv("AI_DAILY_ADMISSIONS", "15"))
AI_CLIENT_DAILY_ADMISSIONS = int(os.getenv("AI_CLIENT_DAILY_ADMISSIONS", "3"))
AI_DAILY_CALLS = int(os.getenv("AI_DAILY_CALLS", "200"))
AI_DAILY_GENERATIONS = int(os.getenv("AI_DAILY_GENERATIONS", "20"))
AI_MINUTE_GENERATIONS = int(os.getenv("AI_MINUTE_GENERATIONS", "5"))
AI_STAGE_OUTPUT_TOKENS = int(os.getenv("AI_STAGE_OUTPUT_TOKENS", "2048"))
