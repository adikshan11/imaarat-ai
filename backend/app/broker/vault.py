import ssl
from threading import Lock
import time
from uuid import UUID

import httpx2
from fastapi import HTTPException

from app.settings import dependency_url


class VaultClient:
    def __init__(self, url, role_id, secret_id, ca_file=None, transport=None):
        self.url = dependency_url(url, "production")
        if not self.url or not role_id or not secret_id:
            raise HTTPException(503, "vault_unavailable")
        self.role_id = role_id
        self.secret_id = secret_id
        self.token = None
        self.expires_at = 0
        self.lock = Lock()
        verify = ssl.create_default_context(cafile=ca_file) if ca_file else True
        self.client = httpx2.Client(base_url=self.url, verify=verify, timeout=5, follow_redirects=False, trust_env=False, transport=transport)

    def response(self, method, path, **kwargs):
        try:
            response = self.client.request(method, path, **kwargs)
            if response.status_code not in {200, 204}:
                raise HTTPException(503, "vault_unavailable")
            return response.json() if response.status_code != 204 else {}
        except Exception:
            raise HTTPException(503, "vault_unavailable") from None

    def authenticate(self):
        with self.lock:
            if self.token and time.time() < self.expires_at - 30:
                return self.token
            if self.token and time.time() < self.expires_at:
                result = self.response("POST", "/v1/auth/token/renew-self", headers={"X-Vault-Token": self.token}, json={"increment": 600})
            else:
                result = self.response("POST", "/v1/auth/approle/login", json={"role_id": self.role_id, "secret_id": self.secret_id})
            details = result.get("auth") or {}
            ttl = details.get("lease_duration")
            policies = details.get("policies", details.get("token_policies", []))
            if not details.get("client_token") or type(ttl) is not int or not 60 <= ttl <= 1800 or details.get("renewable") is not True or "root" in policies or "imaarat-broker" not in policies:
                self.token = None
                raise HTTPException(503, "vault_unavailable")
            self.token = details["client_token"]
            self.expires_at = time.time() + ttl
            return self.token

    def path(self, owner_id, connection_id):
        try:
            owner = str(UUID(owner_id))
            connection = str(UUID(connection_id))
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(422, "connection_id_invalid") from None
        return "owners/" + owner + "/connections/" + connection

    def write(self, owner_id, connection_id, credential, cas):
        path = self.path(owner_id, connection_id)
        result = self.response("POST", "/v1/imaarat/data/" + path, headers={"X-Vault-Token": self.authenticate()}, json={"options": {"cas": cas}, "data": {"credential": credential}})
        version = (result.get("data") or {}).get("version")
        if type(version) is not int or version != cas + 1:
            raise HTTPException(503, "vault_version_invalid")
        return version

    def destroy(self, owner_id, connection_id):
        path = self.path(owner_id, connection_id)
        self.response("DELETE", "/v1/imaarat/metadata/" + path, headers={"X-Vault-Token": self.authenticate()})

    def close(self):
        self.token = None
        self.client.close()