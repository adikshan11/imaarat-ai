import os
from secrets import token_urlsafe
import socket
import ssl
import subprocess
from threading import Event
import time
from uuid import uuid4

import httpx2
import pytest
from fastapi import HTTPException

from app.broker.vault import VaultClient


@pytest.fixture
def remote_vault(tmp_path):
    if os.getenv("GITHUB_ACTIONS") != "true":
        pytest.skip("Real vault execution is restricted to the personal remote CI runner")
    binary = os.environ["BAO_TEST_BINARY"]
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    root = token_urlsafe(32)
    process = subprocess.Popen([binary, "server", "-dev-tls", "-dev-no-store-token", "-dev-tls-cert-dir=" + str(tmp_path), "-dev-listen-address=127.0.0.1:" + str(port)], env=os.environ | {"BAO_DEV_ROOT_TOKEN_ID": root}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    client = vault = None
    try:
        ca = tmp_path / "vault-ca.pem"
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if process.poll() is not None:
                pytest.fail("Isolated vault process exited")
            if ca.exists():
                try:
                    if client is None:
                        client = httpx2.Client(base_url=f"https://127.0.0.1:{port}", verify=ssl.create_default_context(cafile=str(ca)), trust_env=False, timeout=1, headers={"X-Vault-Token": root})
                    if client.get("/v1/sys/health").status_code == 200:
                        break
                except (OSError, httpx2.HTTPError):
                    pass
            Event().wait(0.05)
        else:
            pytest.fail("Isolated vault readiness deadline exceeded")

        def configure(method, path, **kwargs):
            response = client.request(method, path, **kwargs)
            if response.status_code not in {200, 204}:
                pytest.fail("Isolated vault setup failed")
            return response.json() if response.status_code == 200 else {}

        configure("POST", "/v1/sys/mounts/imaarat", json={"type": "kv", "options": {"version": "2"}})
        configure("POST", "/v1/imaarat/config", json={"cas_required": True, "max_versions": 10})
        policy = 'path "imaarat/data/owners/+/connections/+" { capabilities = ["create", "update"] }\npath "imaarat/metadata/owners/+/connections/+" { capabilities = ["read"] }\npath "imaarat/destroy/owners/+/connections/+" { capabilities = ["update"] }'
        configure("PUT", "/v1/sys/policies/acl/imaarat-broker", json={"policy": policy})
        configure("POST", "/v1/sys/auth/approle", json={"type": "approle"})
        configure("POST", "/v1/auth/approle/role/broker", json={"token_policies": ["imaarat-broker"], "token_ttl": "600s", "token_max_ttl": "1800s"})
        role = configure("GET", "/v1/auth/approle/role/broker/role-id")["data"]["role_id"]
        secret = configure("POST", "/v1/auth/approle/role/broker/secret-id")["data"]["secret_id"]
        vault = VaultClient(f"https://127.0.0.1:{port}", role, secret, ca_file=str(ca))
        yield vault, client
    finally:
        if vault is not None:
            vault.close()
        if client is not None:
            client.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def test_real_version_retirement(remote_vault):
    vault, inspector = remote_vault
    owner, connection = str(uuid4()), str(uuid4())
    assert vault.write(owner, connection, "isolated-canary-credential", 0) == 1
    assert vault.write(owner, connection, "replacement-test-credential", 1) == 2
    path = vault.path(owner, connection)
    assert inspector.delete("/v1/imaarat/metadata/" + path, headers={"X-Vault-Token": vault.authenticate()}).status_code == 403
    vault.destroy(owner, connection)
    metadata = inspector.get("/v1/imaarat/metadata/" + path).json()["data"]
    assert metadata["current_version"] == 3
    assert all(value["destroyed"] for value in metadata["versions"].values())
    assert inspector.get("/v1/imaarat/data/" + path + "?version=1").status_code == 404
    with pytest.raises(HTTPException):
        vault.write(owner, connection, "late-old-create-credential", 0)
    with pytest.raises(HTTPException):
        vault.write(owner, connection, "late-replace-credential", 2)


def test_real_fence_race(remote_vault, monkeypatch):
    vault, inspector = remote_vault
    owner, connection = str(uuid4()), str(uuid4())
    assert vault.write(owner, connection, "isolated-test-credential", 0) == 1
    response = vault.response
    raced = []

    def competing(method, path, **kwargs):
        result = response(method, path, **kwargs)
        if method == "GET" and "/metadata/" in path and not raced:
            raced.append(True)
            assert vault.write(owner, connection, "late-replacement-credential", 1) == 2
        return result

    monkeypatch.setattr(vault, "response", competing)
    with pytest.raises(HTTPException):
        vault.destroy(owner, connection)
    vault.destroy(owner, connection)
    path = vault.path(owner, connection)
    metadata = inspector.get("/v1/imaarat/metadata/" + path).json()["data"]
    assert metadata["current_version"] == 3
    assert all(value["destroyed"] for value in metadata["versions"].values())