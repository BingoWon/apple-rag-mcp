-- Apply only after service >=5.5.1 has replaced all writers/readers of these fields.
DROP TRIGGER scrub_search_token_insert;
DROP TRIGGER scrub_fetch_token_insert;
ALTER TABLE search_logs DROP COLUMN mcp_token;
ALTER TABLE fetch_logs DROP COLUMN mcp_token;
