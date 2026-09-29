CREATE TABLE IF NOT EXISTS repositories (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    visibility     TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    default_branch TEXT NOT NULL DEFAULT 'main',
    language       TEXT NOT NULL DEFAULT '',
    archived       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS repositories_owner_name_key
    ON repositories (owner_id, LOWER(name));
CREATE INDEX IF NOT EXISTS repositories_visibility_idx ON repositories (visibility);
