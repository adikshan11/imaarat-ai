import json
import os
from pathlib import Path
from uuid import UUID

from authlib.integrations.httpx_client import OAuth2Client
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app import auth
from app import policy
from app.db import get_engine
from app.settings import dependency_url


router = APIRouter(prefix="/auth")


class TokenInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    scopes: list[str] = Field(min_length=1, max_length=2)
    lifetime: int = Field(default=3600, ge=60, le=86400)


@router.post("/tokens")
def create_token(request: Request, body: TokenInput):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    grant = policy.issue_token(get_engine(), principal, set(body.scopes), lifetime=body.lifetime)
    return JSONResponse({"id": grant.id, "token": grant.token, "expires_at": grant.expires_at}, status_code=201, headers={"Cache-Control": "no-store"})


@router.get("/tokens")
def list_tokens(request: Request):
    principal = auth.resolve_principal(request)
    auth.require_recent_auth(principal)
    now = auth.clock(None)
    with get_engine().connect() as conn:
        rows = conn.execute(select(policy.tokens.c.id, policy.tokens.c.scopes, policy.tokens.c.expires_at).where(policy.tokens.c.owner_id == principal.owner_id, policy.tokens.c.revoked_at.is_(None), policy.tokens.c.expires_at > now).limit(10)).all()
    return JSONResponse([{"id": row.id, "scopes": json.loads(row.scopes), "expires_at": row.expires_at} for row in rows], headers={"Cache-Control": "no-store"})


@router.delete("/tokens/{token_id}")
def delete_token(token_id: UUID, request: Request):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    auth.require_recent_auth(principal)
    policy.revoke_token(get_engine(), principal, str(token_id))
    return Response(status_code=204, headers={"Cache-Control": "no-store"})


def oauth_client(**kwargs):
    return OAuth2Client(**kwargs)


def oauth_configuration() -> tuple[str, str, str]:
    origin = dependency_url(os.getenv("APP_ORIGIN", ""), os.getenv("APP_ENV", "production"))
    client_id = os.getenv("GITHUB_CLIENT_ID", "").strip()
    secret = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
    filename = os.getenv("GITHUB_CLIENT_SECRET_FILE", "").strip()
    if secret and filename:
        raise HTTPException(503, "identity_unavailable")
    if filename:
        try:
            secret = Path(filename).read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError):
            raise HTTPException(503, "identity_unavailable") from None
    if not origin or not client_id or not secret:
        raise HTTPException(503, "identity_unavailable")
    return client_id, secret, origin + "/api/auth/github/callback"


def session_response(grant: auth.SessionGrant, status_code: int = 200) -> JSONResponse:
    response = JSONResponse({"owner_id": grant.principal.owner_id, "role": grant.principal.role, "data_policy": grant.principal.data_policy, "csrf_token": grant.csrf_token, "expires_at": grant.expires_at}, status_code=status_code, headers={"Cache-Control": "no-store"})
    response.set_cookie("__Host-imaarat_session", grant.token, max_age=max(0, grant.expires_at - auth.clock(None)), secure=True, httponly=True, samesite="lax", path="/")
    return response


@router.post("/guest")
def guest(request: Request):
    auth.require_origin(request)
    if request.cookies.get("__Host-imaarat_session"):
        raise HTTPException(409, "session_exists")
    return session_response(auth.create_guest(get_engine()), 201)


@router.get("/session")
def session(request: Request):
    principal = auth.resolve_principal(request)
    return JSONResponse({"owner_id": principal.owner_id, "role": principal.role, "data_policy": principal.data_policy, "csrf_token": auth.csrf_token(request.cookies["__Host-imaarat_session"])}, headers={"Cache-Control": "no-store"})


@router.post("/logout")
def logout(request: Request):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    auth.revoke_session(get_engine(), principal)
    response = Response(status_code=204, headers={"Cache-Control": "no-store"})
    response.delete_cookie("__Host-imaarat_session", path="/", secure=True, httponly=True, samesite="lax")
    response.delete_cookie("__Host-imaarat_oauth", path="/", secure=True, httponly=True, samesite="lax")
    return response


@router.post("/github/start")
def github_start(request: Request):
    auth.require_origin(request)
    client_id, secret, callback = oauth_configuration()
    previous = auth.resolve_principal(request) if request.cookies.get("__Host-imaarat_session") else None
    if previous is not None:
        auth.require_csrf(request, previous)
    flow = auth.create_oauth(get_engine(), callback, previous)
    with oauth_client(client_id=client_id, redirect_uri=callback, scope="", code_challenge_method="S256", timeout=10, follow_redirects=False, trust_env=False) as client:
        url, state = client.create_authorization_url("https://github.com/login/oauth/authorize", state=flow.state, code_verifier=flow.code_verifier, scope="")
    if "scope=" not in url:
        url += "&scope="
    response = JSONResponse({"authorization_url": url}, headers={"Cache-Control": "no-store"})
    response.set_cookie("__Host-imaarat_oauth", flow.browser_token, max_age=600, secure=True, httponly=True, samesite="lax", path="/")
    return response


def github_identity(transaction: dict, code: str) -> int:
    client_id, secret, callback = oauth_configuration()
    if transaction["callback"] != callback or not 1 <= len(code) <= 512:
        raise HTTPException(400, "oauth_invalid")
    try:
        with oauth_client(client_id=client_id, client_secret=secret, redirect_uri=callback, token_endpoint_auth_method="client_secret_post", timeout=10, follow_redirects=False, trust_env=False, headers={"Accept": "application/json"}) as client:
            token = client.fetch_token("https://github.com/login/oauth/access_token", code=code, code_verifier=transaction["code_verifier"], grant_type="authorization_code")
            if not token.get("access_token") or token.get("scope", "") not in {"", None}:
                raise HTTPException(400, "oauth_scope_invalid")
            response = client.get("https://api.github.com/user")
            response.raise_for_status()
            github_id = response.json().get("id")
            if type(github_id) is not int or not 0 < github_id <= 9223372036854775807:
                raise HTTPException(401, "identity_invalid")
            return github_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "identity_provider_unavailable") from None


@router.get("/github/callback")
def github_callback(request: Request):
    if set(request.query_params) != {"code", "state"} or len(request.query_params.getlist("code")) != 1 or len(request.query_params.getlist("state")) != 1:
        raise HTTPException(400, "oauth_invalid")
    transaction = auth.consume_oauth(get_engine(), request.query_params["state"], request.cookies.get("__Host-imaarat_oauth", ""))
    github_id = github_identity(transaction, request.query_params["code"])
    grant = auth.create_member(get_engine(), github_id, previous_session=transaction["previous_session"], expected_github_id=transaction["expected_github_id"])
    origin = dependency_url(os.getenv("APP_ORIGIN", ""), os.getenv("APP_ENV", "production"))
    response = RedirectResponse(origin + "/", status_code=303, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
    response.set_cookie("__Host-imaarat_session", grant.token, max_age=43200, secure=True, httponly=True, samesite="lax", path="/")
    response.delete_cookie("__Host-imaarat_oauth", path="/", secure=True, httponly=True, samesite="lax")
    return response