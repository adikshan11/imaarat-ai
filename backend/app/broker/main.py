import os
from pathlib import Path
from uuid import UUID

from cryptography.hazmat.primitives import serialization
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from app.broker import envelope
from app.broker.vault import VaultClient
from app.connections import ConnectionService
from app.db import get_engine


class CreateConnection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str = Field(pattern="^gemini$")
    credential: SecretStr


class ChangeConnection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(strict=True, ge=1)
    credential: SecretStr | None = None


def create_app(service=None, keys=None):
    app = FastAPI(title="imaarat private credential broker", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.service = service
    app.state.keys = keys

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        try:
            if request.url.scheme != "https" or request.query_params:
                raise HTTPException(403, "broker_transport_invalid")
            if app.state.service is None or app.state.keys is None:
                raise HTTPException(503, "broker_unavailable")
            chunks = []
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 8192:
                    raise HTTPException(413, "request_too_large")
                chunks.append(chunk)
            body = b"".join(chunks)
            principal = envelope.verify(app.state.service.engine, app.state.keys, request.headers, request.method, request.url.path, body)
            request.scope["broker_principal"] = principal
            request.scope["broker_body"] = body
            response = await call_next(request)
            response.headers["Cache-Control"] = "no-store"
            return response
        except HTTPException as error:
            return JSONResponse({"detail": error.detail}, status_code=error.status_code, headers={"Cache-Control": "no-store"})
        except Exception:
            return JSONResponse({"detail": "broker_unavailable"}, status_code=503, headers={"Cache-Control": "no-store"})

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse({"detail": error.detail}, status_code=error.status_code, headers={"Cache-Control": "no-store"})

    @app.get("/connections")
    def listing(request: Request):
        return app.state.service.list(request.scope["broker_principal"])

    @app.post("/connections", status_code=201)
    def create(request: Request):
        try:
            value = CreateConnection.model_validate_json(request.scope["broker_body"])
        except ValidationError:
            raise HTTPException(422, "connection_input_invalid") from None
        return app.state.service.create(request.scope["broker_principal"], value.credential.get_secret_value(), value.provider)

    @app.api_route("/connections/{connection_id}/{operation}", methods=["POST"])
    def change(connection_id: UUID, operation: str, request: Request):
        if operation not in {"replace", "disable", "verify"}:
            raise HTTPException(404, "not_found")
        if operation == "verify":
            raise HTTPException(503, "provider_verification_unavailable")
        try:
            value = ChangeConnection.model_validate_json(request.scope["broker_body"])
        except ValidationError:
            raise HTTPException(422, "connection_input_invalid") from None
        principal = request.scope["broker_principal"]
        if operation == "replace" and value.credential is not None:
            return app.state.service.replace(principal, str(connection_id), value.version, value.credential.get_secret_value())
        if operation == "disable" and value.credential is None:
            return app.state.service.disable(principal, str(connection_id), value.version)
        raise HTTPException(422, "connection_input_invalid")

    @app.delete("/connections/{connection_id}")
    def delete(connection_id: UUID, request: Request):
        try:
            value = ChangeConnection.model_validate_json(request.scope["broker_body"])
        except ValidationError:
            raise HTTPException(422, "connection_input_invalid") from None
        if value.credential is not None:
            raise HTTPException(422, "connection_input_invalid")
        return app.state.service.delete(request.scope["broker_principal"], str(connection_id), value.version)

    return app


def configured_app():
    try:
        public_key = serialization.load_pem_public_key(Path(os.environ["BROKER_API_PUBLIC_KEY_FILE"]).read_bytes())
        secret_id = Path(os.environ["BAO_SECRET_ID_FILE"]).read_text(encoding="utf-8").strip()
        vault = VaultClient(os.environ["BAO_ADDR"], os.environ["BAO_ROLE_ID"], secret_id, ca_file=os.environ["BAO_CACERT"])
        return create_app(ConnectionService(get_engine(), vault), {"api": public_key})
    except Exception:
        raise RuntimeError("broker_configuration_unavailable") from None


app = create_app()