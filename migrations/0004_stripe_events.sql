PRAGMA defer_foreign_keys = ON;

ALTER TABLE user_subscriptions RENAME TO user_subscriptions_legacy;

CREATE TABLE user_subscriptions (
    user_id TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_type TEXT NOT NULL DEFAULT 'hobby' CHECK (plan_type IN ('hobby', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'canceled', 'past_due')),
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    price REAL NOT NULL DEFAULT 0,
    billing_interval TEXT NOT NULL DEFAULT 'month',
    stripe_price_id TEXT,
    payment_type TEXT NOT NULL DEFAULT 'subscription' CHECK (payment_type IN ('subscription', 'one_time')),
    stripe_event_created INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan_type,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    price,
    billing_interval,
    stripe_price_id,
    payment_type,
    updated_at
)
SELECT
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan_type,
    CASE status WHEN 'cancelled' THEN 'canceled' ELSE status END,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    price,
    billing_interval,
    stripe_price_id,
    payment_type,
    updated_at
FROM user_subscriptions_legacy;

DROP TABLE user_subscriptions_legacy;

CREATE INDEX idx_user_subscriptions_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_subscription ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_stripe_price_id ON user_subscriptions(stripe_price_id);

CREATE TABLE stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_stripe_events_object ON stripe_events(event_type, object_id);
