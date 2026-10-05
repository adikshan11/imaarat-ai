import os
from pathlib import Path
import ssl
from uuid import UUID

from cryptography.hazmat.primitives import serialization
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import httpx2

from app import auth
from app.broker.envelope import sign
from app.settings import dependency_url


router = APIRouter(prefix="/connections")


async def relay(request, path):
    principal = auth.resolve_principal(request)
    auth.require_recent_auth(principal)
    if request.method != "GET":
        auth.require_csrf(request, principal)
    if request.query_params:
        raise HTTPException(422, "connection_input_invalid")
    chunks = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > 8192:
            raise HTTPException(413, "request_too_large")
        chunks.append(chunk)
    body = b"".join(chunks)
    try:
        url = dependency_url(os.environ["BROKER_URL"], "production")
        private = serialization.load_pem_private_key(Path(os.environ["BROKER_API_PRIVATE_KEY_FILE"]).read_bytes(), password=None)
        verify = ssl.create_default_context(cafile=os.environ["BROKER_CACERT"])
        headers = sign(private, "api", request.method, path, principal.session_id, body)
        headers["Content-Type"] = "application/json"
        async with httpx2.AsyncClient(verify=verify, timeout=15, follow_redirects=False, trust_env=False) as client:
            response = await client.request(request.method, url + path, headers=headers, content=body)
            if response.status_code not in {200, 201}:
                raise HTTPException(response.status_code if response.status_code in {401, 403, 404, 409, 413, 422, 429} else 503, "connection_operation_unavailable")
            payload = response.json()
        return JSONResponse(payload, status_code=response.status_code, headers={"Cache-Control": "no-store"})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "broker_unavailable") from None


@router.api_route("", methods=["GET", "POST"])
async def connections(request: Request):
    return await relay(request, "/connections")


@router.post("/{connection_id}/{operation}")
async def change(connection_id: UUID, operation: str, request: Request):
    if operation not in {"replace", "disable", "verify"}:
        raise HTTPException(404, "not_found")
    return await relay(request, "/connections/" + str(connection_id) + "/" + operation)


@router.delete("/{connection_id}")
async def delete(connection_id: UUID, request: Request):
    return await relay(request, "/connections/" + str(connection_id))