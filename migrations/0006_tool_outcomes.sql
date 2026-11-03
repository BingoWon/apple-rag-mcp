ALTER TABLE search_logs ADD COLUMN outcome TEXT NOT NULL DEFAULT 'unknown'
    CHECK (outcome IN ('success','degraded','no_content','limited','invalid','failed','unknown'));
ALTER TABLE fetch_logs ADD COLUMN outcome TEXT NOT NULL DEFAULT 'unknown'
    CHECK (outcome IN ('success','degraded','no_content','limited','invalid','failed','unknown'));
ALTER TABLE fetch_logs ADD COLUMN content_source TEXT;
ALTER TABLE fetch_logs ADD COLUMN provider TEXT;
ALTER TABLE fetch_logs ADD COLUMN upstream_status INTEGER;
ALTER TABLE fetch_logs ADD COLUMN cache_hit INTEGER NOT NULL DEFAULT 0;

UPDATE search_logs SET outcome = CASE
    WHEN status_code = 200 AND result_count = 0 THEN 'no_content'
    WHEN status_code = 200 THEN 'success'
    WHEN status_code = 429 THEN 'limited'
    WHEN status_code >= 500 THEN 'failed'
    ELSE 'unknown' END;
UPDATE fetch_logs SET outcome = CASE
    WHEN status_code = 200 THEN 'success'
    WHEN status_code = 404 THEN 'no_content'
    WHEN status_code = 429 THEN 'limited'
    WHEN status_code >= 500 THEN 'failed'
    ELSE 'unknown' END;
UPDATE fetch_logs SET error_code = 'INDEX_MISS' WHERE error_code = 'NOT_FOUND';
