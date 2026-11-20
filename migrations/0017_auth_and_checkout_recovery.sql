ALTER TABLE checkout_attempts ADD COLUMN check_after INTEGER NOT NULL DEFAULT 0;

CREATE TABLE oauth_attempts (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    browser_key TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_attempts_expiry ON oauth_attempts(expires_at);
