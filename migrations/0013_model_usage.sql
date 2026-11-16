CREATE TABLE model_usage_events (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('jev', 'embedding', 'reranking')),
    channel TEXT CHECK (channel IN ('mcp', 'cli')),
    input_tokens INTEGER CHECK (input_tokens >= 0),
    currency TEXT CHECK (currency IN ('USD', 'CNY')),
    cost_nanos INTEGER CHECK (cost_nanos >= 0),
    cost_source TEXT CHECK (cost_source IN ('estimated', 'reported')),
    CHECK ((cost_nanos IS NULL AND currency IS NULL AND cost_source IS NULL)
        OR (cost_nanos IS NOT NULL AND currency IS NOT NULL AND cost_source IS NOT NULL))
);

CREATE INDEX idx_model_usage_created_at ON model_usage_events (created_at);
