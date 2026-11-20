\set ON_ERROR_STOP on

BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE public.pages
    ADD COLUMN IF NOT EXISTS next_check_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_outcome text;
-- Existing rows have unknown history. Only subsequent discoveries start in the new-page lane.
ALTER TABLE public.pages ALTER COLUMN last_outcome SET DEFAULT 'new';
COMMIT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pages_due
    ON public.pages(next_check_at, id) WHERE url LIKE 'https://developer.apple.com/%';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pages_priority_due
    ON public.pages(next_check_at, id) WHERE url LIKE 'https://developer.apple.com/%'
    AND last_outcome IN ('new','updated','retry');
