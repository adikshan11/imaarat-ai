CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL CHECK (provider = 'gemini'),
    data_policy TEXT NOT NULL CHECK (data_policy = 'synthetic'),
    suffix TEXT,
    state TEXT NOT NULL CHECK (state IN ('provisioning', 'unverified', 'active', 'disabled', 'pending_delete', 'deleted')),
    secret_version INTEGER NOT NULL DEFAULT 0,
    pending_version INTEGER,
    pending_suffix TEXT,
    latest_version INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    operation TEXT CHECK (operation IN ('create', 'replace', 'delete'))
);
CREATE INDEX connections_owner ON connections(owner_id);
CREATE TABLE broker_nonces (
    id TEXT PRIMARY KEY,
    expires_at BIGINT NOT NULL
);