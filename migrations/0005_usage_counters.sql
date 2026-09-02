CREATE TABLE usage_counters (
    identifier TEXT NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('minute', 'weekly')),
    window_start TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (identifier, period, window_start)
);

CREATE INDEX idx_usage_counters_expiry ON usage_counters(period, window_start);

INSERT INTO usage_counters (identifier, period, window_start, count, updated_at)
SELECT
    user_id,
    'weekly',
    strftime('%Y-%m-%dT00:00:00.000Z', 'now', '-' || strftime('%w', 'now') || ' days'),
    COUNT(*),
    datetime('now')
FROM (
    SELECT user_id
    FROM search_logs
    WHERE status_code = 200
      AND created_at >= strftime('%Y-%m-%dT00:00:00.000Z', 'now', '-' || strftime('%w', 'now') || ' days')
    UNION ALL
    SELECT user_id
    FROM fetch_logs
    WHERE status_code = 200
      AND created_at >= strftime('%Y-%m-%dT00:00:00.000Z', 'now', '-' || strftime('%w', 'now') || ' days')
)
GROUP BY user_id;
