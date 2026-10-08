import os

from authlib.integrations.httpx_client import OAuth2Client
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, Field

from app import auth, profile

router = APIRouter(prefix="/auth")
NO_STORE = {"Cache-Control": "no-store"}
# GitHub names itself in the callback (RFC 9207) so a response from another issuer cannot be replayed here.
GITHUB_ISSUER = "https://github.com/login/oauth"
GOOGLE_ISSUER = "https://accounts.google.com"
GOOGLE_CALLBACK_PARAMS = {"code", "state", "scope", "authuser", "prompt", "hd", "iss"}
COOKIE = {"secure": True, "httponly": True, "samesite": "lax", "path": "/"}


class ProfileForm(BaseModel):
    full_name: str = Field(max_length=200)
    phone: str = Field(max_length=40)


def oauth_client(**kwargs):
    return OAuth2Client(**kwargs)


def oauth_configuration(provider: str = "github") -> tuple[str, str, str]:
    client_id = os.getenv(f"{provider.upper()}_CLIENT_ID", "").strip()
    secret = os.getenv(f"{provider.upper()}_CLIENT_SECRET", "").strip()
    origin = auth.app_origin()
    if not origin.startswith("https://") or not client_id or not secret:
        raise HTTPException(503, "Sign-in is not configured on this deployment")
    return client_id, secret, origin + f"/api/auth/{provider}/callback"


def configured(provider: str) -> bool:
    try:
        oauth_configuration(provider)
    except HTTPException:
        return False
    return True


@router.get("/providers")
def providers():
    return JSONResponse({"github": configured("github"), "google": configured("google")}, headers=NO_STORE)


@router.get("/session")
def session(request: Request):
    principal = auth.resolve_principal(request)
    token = auth.csrf_token(request.cookies[auth.SESSION_COOKIE])
    body = {"role": principal.role, "github_id": principal.github_id, "name": principal.name, "csrf_token": token, "profile": profile.read(principal.owner_id)}
    return JSONResponse(body, headers=NO_STORE)


@router.put("/profile")
def save_profile(form: ProfileForm, request: Request):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    return JSONResponse(profile.save(principal.owner_id, form.full_name, form.phone), headers=NO_STORE)


@router.put("/profile/photo")
def save_photo(request: Request, photo: UploadFile = File(...)):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    data = profile.clean_photo(photo.file.read(profile.PHOTO_BYTES + 1), photo.content_type)
    return JSONResponse(profile.save_photo(principal.owner_id, data), headers=NO_STORE)


@router.delete("/profile/photo")
def remove_photo(request: Request):
    principal = auth.resolve_principal(request)
    auth.require_csrf(request, principal)
    return JSONResponse(profile.save_photo(principal.owner_id, None), headers=NO_STORE)


@router.get("/profile/photo")
def show_photo(request: Request):
    data = profile.photo(auth.resolve_principal(request).owner_id)
    if not data:
        raise HTTPException(404, "No photo")
    return Response(data, media_type="image/webp", headers={"Cache-Control": "private, no-cache"})


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


def github_identity(transaction: dict, code: str) -> dict:
    client_id, secret, callback = oauth_configuration()
    if transaction["callback"] != callback or not 1 <= len(code) <= 512:
        raise HTTPException(400, "oauth_invalid")
    try:
        with oauth_client(
            client_id=client_id,
            client_secret=secret,
            redirect_uri=callback,
            token_endpoint_auth_method="client_secret_post",  # noqa: S106 - the name of an OAuth method, not a password
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
            return response.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "GitHub sign-in is unavailable; try again") from None


@router.get("/github/callback")
def github_callback(request: Request):
    params = request.query_params
    if not {"code", "state"} <= set(params) <= {"code", "state", "iss"} or any(len(params.getlist(name)) != 1 for name in params):
        raise HTTPException(400, "oauth_invalid")
    if "iss" in params and params["iss"] != GITHUB_ISSUER:
        raise HTTPException(400, "oauth_issuer_invalid")
    transaction = auth.consume_oauth(request.query_params["state"], request.cookies.get(auth.OAUTH_COOKIE, ""))
    identity = github_identity(transaction, request.query_params["code"])
    grant = auth.create_member(identity.get("id"), name=identity.get("login"))
    return signed_in_redirect(grant)


def signed_in_redirect(grant: auth.SessionGrant) -> RedirectResponse:
    response = RedirectResponse(auth.app_origin() + "/app/", status_code=303, headers={**NO_STORE, "Referrer-Policy": "no-referrer"})
    response.set_cookie(auth.SESSION_COOKIE, grant.token, max_age=auth.SESSION_SECONDS, **COOKIE)
    response.delete_cookie(auth.OAUTH_COOKIE, **COOKIE)
    return response


@router.post("/google/start")
def google_start(request: Request):
    auth.require_origin(request)
    client_id, _, callback = oauth_configuration("google")
    flow = auth.create_oauth(callback)
    with oauth_client(client_id=client_id, redirect_uri=callback, scope="openid", code_challenge_method="S256", timeout=10, follow_redirects=False, trust_env=False) as client:
        url, _ = client.create_authorization_url("https://accounts.google.com/o/oauth2/v2/auth", state=flow.state, code_verifier=flow.code_verifier, prompt="select_account")
    response = JSONResponse({"authorization_url": url}, headers=NO_STORE)
    response.set_cookie(auth.OAUTH_COOKIE, flow.browser_token, max_age=600, **COOKIE)
    return response


def google_identity(transaction: dict, code: str) -> dict:
    client_id, secret, callback = oauth_configuration("google")
    if transaction["callback"] != callback or not 1 <= len(code) <= 512:
        raise HTTPException(400, "oauth_invalid")
    try:
        with oauth_client(
            client_id=client_id,
            client_secret=secret,
            redirect_uri=callback,
            token_endpoint_auth_method="client_secret_post",  # noqa: S106 - the name of an OAuth method, not a password
            timeout=10,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            token = client.fetch_token("https://oauth2.googleapis.com/token", code=code, code_verifier=transaction["code_verifier"], grant_type="authorization_code")
            if not token.get("access_token") or set(str(token.get("scope", "")).split()) != {"openid"}:
                raise HTTPException(400, "oauth_scope_invalid")
            response = client.get("https://openidconnect.googleapis.com/v1/userinfo")
            response.raise_for_status()
            return response.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Google sign-in is unavailable; try again") from None


@router.get("/google/callback")
def google_callback(request: Request):
    params = request.query_params
    if "error" in params:
        response = RedirectResponse(auth.app_origin() + "/app/#signin", status_code=303, headers=NO_STORE)
        response.delete_cookie(auth.OAUTH_COOKIE, **COOKIE)
        return response
    if not {"code", "state"} <= set(params) <= GOOGLE_CALLBACK_PARAMS or any(len(params.getlist(name)) != 1 for name in params):
        raise HTTPException(400, "oauth_invalid")
    if "iss" in params and params["iss"] != GOOGLE_ISSUER:
        raise HTTPException(400, "oauth_issuer_invalid")
    transaction = auth.consume_oauth(params["state"], request.cookies.get(auth.OAUTH_COOKIE, ""))
    identity = google_identity(transaction, params["code"])
    return signed_in_redirect(auth.create_google_member(identity.get("sub")))
