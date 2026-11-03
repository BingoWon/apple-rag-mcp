-- Additive cutover. Temporary triggers prevent the previous Worker from putting
-- secrets back while the new Worker rolls out. Remove the old columns after cutover.
ALTER TABLE search_logs ADD COLUMN channel TEXT NOT NULL DEFAULT 'unknown' CHECK(channel IN ('unknown','mcp','cli'));
ALTER TABLE search_logs ADD COLUMN credential_id TEXT;
ALTER TABLE search_logs ADD COLUMN session_id TEXT;
ALTER TABLE search_logs ADD COLUMN auth_method TEXT;
ALTER TABLE search_logs ADD COLUMN request_id TEXT;
ALTER TABLE search_logs ADD COLUMN client_name TEXT;
ALTER TABLE search_logs ADD COLUMN client_version TEXT;
ALTER TABLE fetch_logs ADD COLUMN channel TEXT NOT NULL DEFAULT 'unknown' CHECK(channel IN ('unknown','mcp','cli'));
ALTER TABLE fetch_logs ADD COLUMN credential_id TEXT;
ALTER TABLE fetch_logs ADD COLUMN session_id TEXT;
ALTER TABLE fetch_logs ADD COLUMN auth_method TEXT;
ALTER TABLE fetch_logs ADD COLUMN request_id TEXT;
ALTER TABLE fetch_logs ADD COLUMN client_name TEXT;
ALTER TABLE fetch_logs ADD COLUMN client_version TEXT;
UPDATE search_logs SET credential_id=(SELECT id FROM mcp_tokens WHERE mcp_tokens.mcp_token=search_logs.mcp_token),mcp_token=NULL WHERE mcp_token IS NOT NULL;
UPDATE fetch_logs SET credential_id=(SELECT id FROM mcp_tokens WHERE mcp_tokens.mcp_token=fetch_logs.mcp_token),mcp_token=NULL WHERE mcp_token IS NOT NULL;
CREATE TRIGGER scrub_search_token_insert AFTER INSERT ON search_logs WHEN NEW.mcp_token IS NOT NULL BEGIN UPDATE search_logs SET mcp_token=NULL WHERE id=NEW.id; END;
CREATE TRIGGER scrub_fetch_token_insert AFTER INSERT ON fetch_logs WHEN NEW.mcp_token IS NOT NULL BEGIN UPDATE fetch_logs SET mcp_token=NULL WHERE id=NEW.id; END;
CREATE INDEX idx_search_logs_channel_created ON search_logs(channel,created_at);
CREATE INDEX idx_fetch_logs_channel_created ON fetch_logs(channel,created_at);

CREATE TABLE cli_authorizations (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('code','device')),
 client_id TEXT NOT NULL,
 device_name TEXT NOT NULL,
 device_code_hash TEXT UNIQUE,
 user_code_hash TEXT UNIQUE,
 code_hash TEXT UNIQUE,
 code_challenge TEXT,
 redirect_uri TEXT,
 state TEXT,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
 expires_at INTEGER NOT NULL,
 next_poll_at INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_cli_authorizations_expiry ON cli_authorizations(expires_at);
CREATE TABLE cli_sessions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('device','api_key')),
 name TEXT NOT NULL,
 access_token_hash TEXT UNIQUE,
 refresh_token_hash TEXT,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE INDEX idx_cli_sessions_user ON cli_sessions(user_id);
CREATE TABLE cli_auth_limits (
 id TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
