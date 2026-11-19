CREATE TABLE browse_logs (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
 user_id TEXT NOT NULL, channel TEXT NOT NULL CHECK (channel IN ('mcp','cli')),
 credential_id TEXT, session_id TEXT, auth_method TEXT, request_id TEXT, client_name TEXT, client_version TEXT,
 requested_url TEXT NOT NULL, result_count INTEGER NOT NULL DEFAULT 0, response_time_ms INTEGER,
 status_code INTEGER, error_code TEXT, outcome TEXT NOT NULL, ip_address TEXT, country_code TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_browse_logs_created ON browse_logs(created_at);
CREATE INDEX idx_browse_logs_user_created ON browse_logs(user_id,created_at);
CREATE VIEW tool_activity AS
 SELECT user_id,created_at,status_code,result_count FROM search_logs
 UNION ALL SELECT user_id,created_at,status_code,1 FROM fetch_logs
 UNION ALL SELECT user_id,created_at,status_code,result_count FROM browse_logs;
