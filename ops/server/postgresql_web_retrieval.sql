BEGIN;

CREATE TABLE IF NOT EXISTS web_page_cache (
    url text PRIMARY KEY,
    result jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_page_cache_expiry ON web_page_cache (expires_at);

CREATE TABLE IF NOT EXISTS web_page_aliases (
    url text PRIMARY KEY,
    canonical_url text NOT NULL REFERENCES web_page_cache(url) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS web_fetch_budget (
    day date PRIMARY KEY,
    attempts integer NOT NULL CHECK (attempts > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON web_page_cache, web_page_aliases, web_fetch_budget TO apple_rag_user;

COMMIT;
