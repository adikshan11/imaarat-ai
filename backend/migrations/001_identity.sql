CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    property_id TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP::TEXT
);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS decision TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS risk_flags TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS risk_breakdown TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS prototype_mitigation_model TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS memo_json TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS memo_markdown TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS result_json TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS record_type TEXT NOT NULL DEFAULT 'production';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS final_decision TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewer TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_at TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS thread_id TEXT;
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    github_id BIGINT UNIQUE CHECK (github_id > 0),
    role TEXT NOT NULL CHECK (role IN ('guest', 'member', 'reviewer', 'operator')),
    created_at BIGINT NOT NULL,
    disabled_at BIGINT
);
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    csrf_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    authenticated_at BIGINT,
    revoked_at BIGINT
);
CREATE INDEX sessions_owner ON sessions(owner_id);
CREATE TABLE oauth_transactions (
    state_hash TEXT PRIMARY KEY,
    browser_hash TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    callback TEXT NOT NULL,
    previous_session TEXT,
    expected_github_id BIGINT,
    expires_at BIGINT NOT NULL,
    consumed_at BIGINT
);
CREATE TABLE identity_rate_limits (
    id TEXT PRIMARY KEY,
    window_start BIGINT NOT NULL,
    count INTEGER NOT NULL CHECK (count > 0)
);
CREATE TABLE reviewer_assignments (
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (reviewer_id, owner_id)
);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS data_class TEXT NOT NULL DEFAULT 'quarantined' CHECK (data_class IN ('quarantined', 'synthetic', 'private', 'fixture'));
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS record_version INTEGER NOT NULL DEFAULT 1 CHECK (record_version > 0);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX submissions_owner ON submissions(owner_id, id);