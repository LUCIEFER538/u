CREATE TABLE IF NOT EXISTS activity_events (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
    repository_id UUID REFERENCES repositories (id) ON DELETE CASCADE,
    kind          TEXT NOT NULL,
    summary       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_events_user_idx ON activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_repo_idx ON activity_events (repository_id, created_at DESC);

-- Written by the Go gateway for every proxied API request.
CREATE TABLE IF NOT EXISTS gateway_requests (
    id          BIGSERIAL PRIMARY KEY,
    method      TEXT NOT NULL,
    path        TEXT NOT NULL,
    status      INT NOT NULL,
    duration_ms INT NOT NULL,
    ip_address  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gateway_requests_created_idx ON gateway_requests (created_at DESC);
