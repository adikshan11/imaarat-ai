from concurrent.futures import ThreadPoolExecutor
import json
import ssl
from threading import BoundedSemaphore, Lock
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
        self.requests = ThreadPoolExecutor(max_workers=4)
        self.capacity = BoundedSemaphore(4)
        verify = ssl.create_default_context(cafile=ca_file) if ca_file else True
        self.client = httpx2.Client(base_url=self.url, verify=verify, timeout=5, follow_redirects=False, trust_env=False, transport=transport)

    def response(self, method, path, missing=False, **kwargs):
        if not self.capacity.acquire(blocking=False):
            raise HTTPException(503, "vault_unavailable")
        try:
            future = self.requests.submit(self.read_response, method, path, missing, kwargs)
        except Exception:
            self.capacity.release()
            raise HTTPException(503, "vault_unavailable") from None
        try:
            return future.result(timeout=10)
        except Exception:
            raise HTTPException(503, "vault_unavailable") from None

    def read_response(self, method, path, missing, kwargs):
        started = time.monotonic()
        try:
            with self.client.stream(method, path, **kwargs) as response:
                if missing and response.status_code == 404:
                    return {"data": {"current_version": 0, "versions": {}}}
                if response.status_code not in {200, 204} or response.headers.get("content-encoding", "identity") != "identity":
                    raise ValueError()
                payload = bytearray()
                for chunk in response.iter_bytes():
                    if len(payload) + len(chunk) > 65536 or time.monotonic() - started >= 10:
                        raise ValueError()
                    payload.extend(chunk)
                if time.monotonic() - started >= 10:
                    raise ValueError()
                return json.loads(payload) if response.status_code != 204 else {}
        finally:
            self.capacity.release()

    def authenticate(self):
        if not self.lock.acquire(timeout=5):
            raise HTTPException(503, "vault_unavailable")
        try:
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
        finally:
            self.lock.release()

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
        headers = {"X-Vault-Token": self.authenticate()}
        metadata_path = "/v1/imaarat/metadata/" + path
        details = self.response("GET", metadata_path, missing=True, headers=headers).get("data") or {}
        current = details.get("current_version")
        if type(current) is not int or current < 0:
            raise HTTPException(503, "vault_unavailable")
        result = self.response("POST", "/v1/imaarat/data/" + path, headers=headers, json={"options": {"cas": current}, "data": {"retired": True}})
        fence = (result.get("data") or {}).get("version")
        if type(fence) is not int or fence != current + 1:
            raise HTTPException(503, "vault_unavailable")
        details = self.response("GET", metadata_path, headers=headers).get("data") or {}
        versions = details.get("versions")
        if details.get("current_version") != fence or not isinstance(versions, dict) or not versions or len(versions) > 100:
            raise HTTPException(503, "vault_unavailable")
        try:
            numbers = [int(value) for value in versions]
        except (ValueError, TypeError):
            raise HTTPException(503, "vault_unavailable") from None
        if any(not 1 <= value <= fence for value in numbers):
            raise HTTPException(503, "vault_unavailable")
        self.response("PUT", "/v1/imaarat/destroy/" + path, headers=headers, json={"versions": numbers})
        confirmed = self.response("GET", metadata_path, headers=headers).get("data") or {}
        states = confirmed.get("versions") or {}
        if confirmed.get("current_version") != fence or set(states) != set(versions) or any(value.get("destroyed") is not True for value in states.values()):
            raise HTTPException(503, "vault_unavailable")

    def close(self):
        self.token = None
        self.requests.shutdown(wait=False, cancel_futures=True)
        self.client.close()