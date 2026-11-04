CREATE TABLE subscription_receipts (
 invoice_id TEXT PRIMARY KEY,
 customer_key TEXT NOT NULL,
 billing_reason TEXT NOT NULL,
 currency TEXT NOT NULL,
 amount_paid INTEGER NOT NULL CHECK(amount_paid > 0),
 paid_at TEXT NOT NULL
);
CREATE INDEX idx_subscription_receipts_paid ON subscription_receipts(paid_at);
CREATE TABLE billing_history_sync (id INTEGER PRIMARY KEY CHECK(id = 1), completed_at TEXT NOT NULL);
