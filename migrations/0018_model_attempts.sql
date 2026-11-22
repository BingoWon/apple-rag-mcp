ALTER TABLE model_usage_events ADD COLUMN request_id TEXT;
ALTER TABLE model_usage_events ADD COLUMN provider TEXT;
ALTER TABLE model_usage_events ADD COLUMN attempt_no INTEGER CHECK (attempt_no > 0);
ALTER TABLE model_usage_events ADD COLUMN timeout_ms INTEGER CHECK (timeout_ms > 0);
ALTER TABLE model_usage_events ADD COLUMN elapsed_ms INTEGER CHECK (elapsed_ms >= 0);
ALTER TABLE model_usage_events ADD COLUMN attempt_outcome TEXT;
ALTER TABLE model_usage_events ADD COLUMN http_status INTEGER;

CREATE INDEX idx_model_usage_request ON model_usage_events(request_id)
WHERE request_id IS NOT NULL;
