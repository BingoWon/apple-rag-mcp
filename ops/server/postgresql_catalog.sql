BEGIN;
CREATE TABLE IF NOT EXISTS catalog_sources (
 url text PRIMARY KEY, page_id uuid, source_stamp timestamptz, groups jsonb
);
CREATE TABLE IF NOT EXISTS catalog_nodes (
 url text PRIMARY KEY, readable boolean NOT NULL, child_count integer,
 members text[] NOT NULL, digest text NOT NULL, directory boolean NOT NULL,
 CHECK (child_count IS NULL OR child_count=cardinality(members))
);
GRANT SELECT ON catalog_sources, catalog_nodes TO apple_rag_user;
COMMIT;
