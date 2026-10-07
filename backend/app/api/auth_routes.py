import os

from authlib.integrations.httpx_client import OAuth2Client
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app import auth

router = APIRouter(prefix="/auth")
NO_STORE = {"Cache-Control": "no-store"}
COOKIE = {"secure": True, "httponly": True, "samesite": "lax", "path": "/"}


def oauth_client(**kwargs):
    return OAuth2Client(**kwargs)


def oauth_configuration() -> tuple[str, str, str]:
    client_id = os.getenv("GITHUB_CLIENT_ID", "").strip()
    secret = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
    origin = auth.app_origin()
    if not origin.startswith("https://") or not client_id or not secret:
        raise HTTPException(503, "Sign-in is not configured on this deployment")
    return client_id, secret, origin + "/api/auth/github/callback"


@router.get("/session")
def session(request: Request):
    principal = auth.resolve_principal(request)
    return JSONResponse({"role": principal.role, "github_id": principal.github_id, "csrf_token": auth.csrf_token(request.cookies[auth.SESSION_COOKIE])}, headers=NO_STORE)


@router.post("/logout")
def logout(request: Request):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    auth.revoke_session(principal)
    response = Response(status_code=204, headers=NO_STORE)
    response.delete_cookie(auth.SESSION_COOKIE, **COOKIE)
    return response


@router.post("/github/start")
def github_start(request: Request):
    auth.require_origin(request)
    client_id, _, callback = oauth_configuration()
    flow = auth.create_oauth(callback)
    with oauth_client(client_id=client_id, redirect_uri=callback, scope="", code_challenge_method="S256", timeout=10, follow_redirects=False, trust_env=False) as client:
        url, _ = client.create_authorization_url("https://github.com/login/oauth/authorize", state=flow.state, code_verifier=flow.code_verifier, scope="")
    response = JSONResponse({"authorization_url": url if "scope=" in url else url + "&scope="}, headers=NO_STORE)
    response.set_cookie(auth.OAUTH_COOKIE, flow.browser_token, max_age=600, **COOKIE)
    return response


def github_identity(transaction: dict, code: str) -> int:
    client_id, secret, callback = oauth_configuration()
    if transaction["callback"] != callback or not 1 <= len(code) <= 512:
        raise HTTPException(400, "oauth_invalid")
    try:
        with oauth_client(
            client_id=client_id,
            client_secret=secret,
            redirect_uri=callback,
            token_endpoint_auth_method="client_secret_post",
            timeout=10,
            follow_redirects=False,
            trust_env=False,
            headers={"Accept": "application/json"},
        ) as client:
            token = client.fetch_token("https://github.com/login/oauth/access_token", code=code, code_verifier=transaction["code_verifier"], grant_type="authorization_code")
            if not token.get("access_token") or token.get("scope", "") not in {"", None}:
                raise HTTPException(400, "oauth_scope_invalid")
            response = client.get("https://api.github.com/user")
            response.raise_for_status()
            return response.json().get("id")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "GitHub sign-in is unavailable; try again") from None


@router.get("/github/callback")
def github_callback(request: Request):
    if set(request.query_params) != {"code", "state"} or len(request.query_params.getlist("code")) != 1 or len(request.query_params.getlist("state")) != 1:
        raise HTTPException(400, "oauth_invalid")
    transaction = auth.consume_oauth(request.query_params["state"], request.cookies.get(auth.OAUTH_COOKIE, ""))
    grant = auth.create_member(github_identity(transaction, request.query_params["code"]))
    response = RedirectResponse(auth.app_origin() + "/app/", status_code=303, headers={**NO_STORE, "Referrer-Policy": "no-referrer"})
    response.set_cookie(auth.SESSION_COOKIE, grant.token, max_age=auth.SESSION_SECONDS, **COOKIE)
    response.delete_cookie(auth.OAUTH_COOKIE, **COOKIE)
    return response
