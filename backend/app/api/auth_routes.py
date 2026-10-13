import os
import re
import time

from authlib.integrations.httpx_client import OAuth2Client
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, Field

from app import auth, images, partners, profile

router = APIRouter(prefix="/auth")
NO_STORE = {"Cache-Control": "no-store"}
GOOGLE_ISSUER = "https://accounts.google.com"
GOOGLE_CALLBACK_PARAMS = {"code", "state", "scope", "authuser", "prompt", "hd", "iss"}
COOKIE = {"secure": True, "httponly": True, "samesite": "lax", "path": "/"}
EMAIL = re.compile(r"[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s.]{2,}")


class ProfileForm(BaseModel):
    full_name: str = Field(max_length=200)
    phone: str = Field(max_length=40)


class PartnerForm(BaseModel):
    name: str = Field(max_length=40)


class SignupForm(BaseModel):
    name: str = Field(max_length=80)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=8, max_length=128)


class LoginForm(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


def oauth_client(**kwargs):
    return OAuth2Client(**kwargs)


def oauth_configuration(provider: str) -> tuple[str, str, str]:
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
    google = configured("google")
    return JSONResponse({"google": google, "owner": google and bool(auth.owner_emails())}, headers=NO_STORE)


@router.get("/session")
def session(request: Request):
    principal = auth.resolve_principal(request)
    token = auth.csrf_token(request.cookies[auth.SESSION_COOKIE])
    body = {"role": principal.role, "github_id": principal.github_id, "name": principal.name, "csrf_token": token, "profile": profile.read(principal.owner_id)}
    body["timing"] = {"now": int(time.time()), "idle_seconds": auth.IDLE_SECONDS, "max_seconds": auth.SESSION_SECONDS, "expires_at": principal.expires_at}
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
    data = profile.clean_photo(photo.file.read(images.PROFILE.max_bytes + 1), photo.content_type)
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
    response = Response(status_code=204, headers={**NO_STORE, "Clear-Site-Data": '"cache"'})
    response.delete_cookie(auth.SESSION_COOKIE, **COOKIE)
    return response


@router.get("/partner-keys")
def list_partner_keys(request: Request):
    auth.require_operator(request, change=False)
    return JSONResponse(partners.listing(), headers=NO_STORE)


@router.post("/partner-keys")
def create_partner_key(form: PartnerForm, request: Request):
    principal = auth.require_operator(request)
    return JSONResponse(partners.create(form.name, principal.owner_id), status_code=201, headers=NO_STORE)


@router.delete("/partner-keys/{key_id}")
def revoke_partner_key(key_id: str, request: Request):
    auth.require_operator(request)
    partners.revoke(key_id)
    return Response(status_code=204, headers=NO_STORE)


def signed_in_redirect(grant: auth.SessionGrant) -> RedirectResponse:
    response = RedirectResponse(auth.app_origin() + "/app/", status_code=303, headers={**NO_STORE, "Referrer-Policy": "no-referrer"})
    response.set_cookie(auth.SESSION_COOKIE, grant.token, max_age=auth.SESSION_SECONDS, **COOKIE)
    response.delete_cookie(auth.OAUTH_COOKIE, **COOKIE)
    return response


def clean_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL.fullmatch(email):
        raise HTTPException(422, "Enter a valid email address")
    return email


def password_session(grant: auth.SessionGrant) -> JSONResponse:
    response = JSONResponse({"signed_in": True}, headers=NO_STORE)
    response.set_cookie(auth.SESSION_COOKIE, grant.token, max_age=auth.SESSION_SECONDS, **COOKIE)
    return response


@router.post("/signup")
def signup(form: SignupForm, request: Request):
    auth.require_origin(request)
    email = clean_email(form.email) if form.email and form.email.strip() else None
    phone = profile.clean_phone(form.phone) if form.phone and form.phone.strip() else None
    if not email and not phone:
        raise HTTPException(422, "Enter an email address or a mobile number")
    return password_session(auth.register_member(profile.clean_name(form.name), email, phone, form.password))


@router.post("/login")
def login(form: LoginForm, request: Request):
    auth.require_origin(request)
    identifier = form.identifier.strip()
    if "@" in identifier:
        identifier = identifier.lower()
    else:
        try:
            identifier = profile.clean_phone(identifier)
        except HTTPException:
            raise HTTPException(401, "Incorrect email, mobile number or password") from None
    return password_session(auth.login_member(identifier, form.password))


def google_authorization(scope: str, purpose: str | None) -> JSONResponse:
    client_id, _, callback = oauth_configuration("google")
    flow = auth.create_oauth(callback, purpose=purpose)
    with oauth_client(client_id=client_id, redirect_uri=callback, scope=scope, code_challenge_method="S256", timeout=10, follow_redirects=False, trust_env=False) as client:
        url, _ = client.create_authorization_url("https://accounts.google.com/o/oauth2/v2/auth", state=flow.state, code_verifier=flow.code_verifier, prompt="select_account")
    response = JSONResponse({"authorization_url": url}, headers=NO_STORE)
    response.set_cookie(auth.OAUTH_COOKIE, flow.browser_token, max_age=600, **COOKIE)
    return response


@router.post("/google/start")
def google_start(request: Request):
    auth.require_origin(request)
    return google_authorization("openid", None)


@router.post("/owner/start")
def owner_start(request: Request):
    auth.require_origin(request)
    if not auth.owner_emails():
        raise HTTPException(503, "Owner sign-in is not configured on this deployment")
    return google_authorization("openid email", "owner")


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
            granted = {"email" if scope.endswith("/userinfo.email") else scope for scope in str(token.get("scope", "")).split()}
            if not token.get("access_token") or granted != ({"openid", "email"} if transaction.get("purpose") == "owner" else {"openid"}):
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
    if transaction.get("purpose") == "owner":
        if not auth.is_owner(identity):
            raise HTTPException(403, "This Google account is not the owner of this deployment")
        return signed_in_redirect(auth.create_google_member(identity.get("sub"), role="operator"))
    return signed_in_redirect(auth.create_google_member(identity.get("sub")))
