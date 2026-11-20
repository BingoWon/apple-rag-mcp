ALTER TABLE search_logs ADD COLUMN reported_client TEXT;
ALTER TABLE browse_logs ADD COLUMN reported_client TEXT;
ALTER TABLE fetch_logs ADD COLUMN reported_client TEXT;
