from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit


class SettingsError(ValueError):
    pass


@dataclass(frozen=True)
class RuntimeSettings:
    environment: str
    app_origin: str
    database_url: str = field(repr=False)
    broker_url: str = ""
    qdrant_url: str = ""
    demo_generation_model: str = ""
    demo_vision_model: str = ""
    demo_embedding_model: str = ""
    local_generation_model: str = ""
    local_vision_model: str = ""
    local_embedding_model: str = ""
    assessment_deadline_seconds: int = 180
    form_deadline_seconds: int = 60
    provider_attempts: int = 3
    local_parallel_requests: int = 1
    local_context_tokens: int = 4096


def database_secret() -> str:
    value = os.getenv("DATABASE_URL", "").strip()
    filename = os.getenv("DATABASE_URL_FILE", "").strip()
    if value and filename:
        raise SettingsError("database_secret_conflict")
    if filename:
        try:
            value = Path(filename).read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError) as error:
            raise SettingsError("database_secret_unavailable") from error
    return value


def dependency_url(value: str, environment: str) -> str:
    if not value:
        return ""
    try:
        parts = urlsplit(value)
        valid = bool(parts.hostname) and parts.username is None and parts.password is None and not parts.query and not parts.fragment and parts.path in {"", "/"}
        valid_scheme = parts.scheme == "https" or (environment != "production" and parts.scheme == "http" and parts.hostname in {"127.0.0.1", "localhost", "::1"})
        parts.port
    except ValueError:
        valid = valid_scheme = False
    if not valid or not valid_scheme:
        raise SettingsError("dependency_url_invalid")
    return value.rstrip("/")


def load_settings(environment: str | None = None) -> RuntimeSettings:
    environment = environment or os.getenv("APP_ENV", "production")
    if environment not in {"production", "development", "test"}:
        raise SettingsError("environment_invalid")
    database = database_secret()
    if not database:
        raise SettingsError("database_required")
    try:
        parts = urlsplit(database)
        valid_database = parts.scheme in {"postgres", "postgresql", "postgresql+psycopg"} and bool(parts.hostname) and bool(parts.path.strip("/"))
    except ValueError:
        valid_database = False
    if not valid_database:
        raise SettingsError("postgres_required")
    origin = os.getenv("APP_ORIGIN", "").strip()
    try:
        parts = urlsplit(origin)
        valid_origin = bool(parts.hostname) and parts.username is None and parts.password is None and not parts.query and not parts.fragment and parts.path in {"", "/"}
        valid_scheme = parts.scheme == "https" or (environment != "production" and parts.scheme == "http" and parts.hostname in {"127.0.0.1", "localhost", "::1"})
        parts.port
    except ValueError:
        valid_origin = valid_scheme = False
    if not valid_origin or not valid_scheme:
        raise SettingsError("origin_invalid")
    try:
        local_context = int(os.getenv("LOCAL_CONTEXT_TOKENS", "4096"))
    except ValueError as error:
        raise SettingsError("local_context_invalid") from error
    if not 1024 <= local_context <= 8192:
        raise SettingsError("local_context_invalid")
    return RuntimeSettings(
        environment=environment,
        app_origin=origin.rstrip("/"),
        database_url=database.replace("postgres://", "postgresql+psycopg://", 1).replace("postgresql://", "postgresql+psycopg://", 1),
        broker_url=dependency_url(os.getenv("BROKER_URL", "").strip(), environment),
        qdrant_url=dependency_url(os.getenv("QDRANT_URL", "").strip(), environment),
        demo_generation_model=os.getenv("DEMO_GENERATION_MODEL", "").strip(),
        demo_vision_model=os.getenv("DEMO_VISION_MODEL", "").strip(),
        demo_embedding_model=os.getenv("DEMO_EMBEDDING_MODEL", "").strip(),
        local_generation_model=os.getenv("LOCAL_GENERATION_MODEL", "").strip(),
        local_vision_model=os.getenv("LOCAL_VISION_MODEL", "").strip(),
        local_embedding_model=os.getenv("LOCAL_EMBEDDING_MODEL", "").strip(),
        local_context_tokens=local_context,
    )


def readiness(settings: RuntimeSettings, checks: Mapping[str, bool] | None = None) -> dict:
    checks = checks or {}
    requirements = ("database", "migrations", "worker", "broker", "vault", "generation", "vision", "embedding", "index", "security")
    verified = {name: checks.get(name) is True for name in requirements}
    configured = bool(settings.broker_url and settings.qdrant_url and settings.demo_generation_model and settings.demo_vision_model and settings.demo_embedding_model)
    ready = configured and all(verified.values())
    return {
        "ready": ready,
        "ai": ready,
        "vector_store": "qdrant" if verified["index"] and settings.qdrant_url else "unavailable",
        "tracing": False,
        "persistent_storage": verified["database"] and verified["migrations"],
        "reason": None if ready else "dependencies_unverified",
        "private_ai": False,
    }


def runtime_readiness() -> dict:
    try:
        return readiness(load_settings())
    except SettingsError as error:
        return {
            "ready": False,
            "ai": False,
            "vector_store": "unavailable",
            "tracing": False,
            "persistent_storage": False,
            "reason": str(error),
            "private_ai": False,
        }