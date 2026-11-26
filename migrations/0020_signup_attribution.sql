-- Capture first-touch signup acquisition source (ref / utm_source / referrer host)
ALTER TABLE users ADD COLUMN signup_source TEXT;
ALTER TABLE oauth_attempts ADD COLUMN signup_source TEXT;

CREATE INDEX IF NOT EXISTS idx_users_signup_source ON users(signup_source);
