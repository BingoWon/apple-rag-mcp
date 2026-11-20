CREATE TABLE web_sessions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, handoff_until INTEGER
);
CREATE INDEX web_sessions_user ON web_sessions(user_id);
CREATE INDEX web_sessions_expiry ON web_sessions(expires_at);
ALTER TABLE user_subscriptions ADD COLUMN currency TEXT;
ALTER TABLE user_subscriptions ADD COLUMN billing_revision INTEGER NOT NULL DEFAULT 0;
-- Existing recurring price plans in this project were sold in USD.
UPDATE user_subscriptions SET currency='USD' WHERE payment_type='subscription' AND price>0;
CREATE TABLE checkout_attempts (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 attempt_id TEXT NOT NULL UNIQUE, price_id TEXT NOT NULL, expires_at INTEGER NOT NULL, session_id TEXT, parameters TEXT NOT NULL
);
CREATE TABLE fulfilled_passes (session_id TEXT PRIMARY KEY, user_id TEXT, fulfilled_at TEXT NOT NULL);
INSERT INTO fulfilled_passes SELECT object_id,NULL,min(processed_at) FROM stripe_events
 WHERE event_type='checkout.session.completed' GROUP BY object_id;
CREATE TRIGGER pass_requires_free_slot BEFORE INSERT ON fulfilled_passes
WHEN EXISTS(SELECT 1 FROM user_subscriptions WHERE user_id=NEW.user_id AND stripe_subscription_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Recurring entitlement occupies this account'); END;
CREATE TABLE ended_subscriptions (subscription_id TEXT PRIMARY KEY);
INSERT OR IGNORE INTO ended_subscriptions SELECT object_id FROM stripe_events WHERE event_type='customer.subscription.deleted';
CREATE TABLE billing_scan(id INTEGER PRIMARY KEY CHECK(id=1), since INTEGER, until_at INTEGER NOT NULL, cursor TEXT);
CREATE INDEX search_logs_time_page ON search_logs(julianday(created_at) DESC,id DESC);
CREATE INDEX browse_logs_time_page ON browse_logs(julianday(created_at) DESC,id DESC);
CREATE INDEX fetch_logs_time_page ON fetch_logs(julianday(created_at) DESC,id DESC);
CREATE TRIGGER web_sessions_password_changed AFTER UPDATE OF password_hash ON users
WHEN OLD.password_hash IS NOT NEW.password_hash
BEGIN DELETE FROM web_sessions WHERE user_id=NEW.id; END;
CREATE TABLE quota_reservations (
 id TEXT PRIMARY KEY, identifier TEXT NOT NULL, weekly TEXT, minute TEXT,
 refunded INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX quota_reservations_created ON quota_reservations(created_at);
CREATE TRIGGER quota_reserve AFTER INSERT ON quota_reservations WHEN NEW.refunded=0 BEGIN
 INSERT INTO usage_counters(identifier,period,window_start,count,updated_at)
 SELECT NEW.identifier,'weekly',NEW.weekly,1,datetime('now') WHERE NEW.weekly IS NOT NULL
 ON CONFLICT(identifier,period,window_start) DO UPDATE SET count=count+1,updated_at=excluded.updated_at;
 INSERT INTO usage_counters(identifier,period,window_start,count,updated_at)
 SELECT NEW.identifier,'minute',NEW.minute,1,datetime('now') WHERE NEW.minute IS NOT NULL
 ON CONFLICT(identifier,period,window_start) DO UPDATE SET count=count+1,updated_at=excluded.updated_at;
END;
CREATE TRIGGER quota_refund AFTER UPDATE OF refunded ON quota_reservations WHEN OLD.refunded=0 AND NEW.refunded=1 BEGIN
 UPDATE usage_counters SET count=max(0,count-1),updated_at=datetime('now')
 WHERE identifier=NEW.identifier AND ((period='weekly' AND window_start=NEW.weekly) OR (period='minute' AND window_start=NEW.minute));
END;
