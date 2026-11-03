-- Preserve all existing log rows and indexes while extending the outcome CHECK.
CREATE TABLE search_logs_new (
    id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    user_id TEXT NOT NULL,
    mcp_token TEXT,
    requested_query TEXT NOT NULL,
    actual_query TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_code TEXT,
    ip_address TEXT,
    country_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    outcome TEXT NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('success','degraded','no_content','limited','invalid','failed','cancelled','unknown'))
);

INSERT INTO search_logs_new (id,user_id,mcp_token,requested_query,actual_query,result_count,response_time_ms,status_code,error_code,ip_address,country_code,created_at,outcome)
SELECT id,user_id,mcp_token,requested_query,actual_query,result_count,response_time_ms,status_code,error_code,ip_address,country_code,created_at,outcome FROM search_logs;

DROP TABLE search_logs;

ALTER TABLE search_logs_new RENAME TO search_logs;

CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_country ON search_logs(country_code);
CREATE INDEX IF NOT EXISTS idx_search_logs_rate_limit
ON search_logs(user_id, created_at)
WHERE status_code = 200;

CREATE TABLE fetch_logs_new (
    id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    user_id TEXT NOT NULL,
    mcp_token TEXT,
    requested_url TEXT NOT NULL,
    actual_url TEXT,
    page_id TEXT,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_code TEXT,
    ip_address TEXT,
    country_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    outcome TEXT NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('success','degraded','no_content','limited','invalid','failed','cancelled','unknown')),
    content_source TEXT,
    provider TEXT,
    upstream_status INTEGER,
    cache_hit INTEGER NOT NULL DEFAULT 0
);

INSERT INTO fetch_logs_new (id,user_id,mcp_token,requested_url,actual_url,page_id,response_time_ms,status_code,error_code,ip_address,country_code,created_at,outcome,content_source,provider,upstream_status,cache_hit)
SELECT id,user_id,mcp_token,requested_url,actual_url,page_id,response_time_ms,status_code,error_code,ip_address,country_code,created_at,outcome,content_source,provider,upstream_status,cache_hit FROM fetch_logs;

DROP TABLE fetch_logs;

ALTER TABLE fetch_logs_new RENAME TO fetch_logs;

CREATE INDEX IF NOT EXISTS idx_fetch_logs_user_id ON fetch_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_created_at ON fetch_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_country ON fetch_logs(country_code);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_rate_limit
ON fetch_logs(user_id, created_at)
WHERE status_code = 200;
