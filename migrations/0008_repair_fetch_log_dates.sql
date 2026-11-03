-- 0007 copied by physical position on a legacy production table whose final
-- two original columns were created_at, country_code. New rows are unaffected.
UPDATE fetch_logs
SET created_at = country_code,
    country_code = created_at
WHERE julianday(created_at) IS NULL
  AND julianday(country_code) IS NOT NULL
  AND (created_at IS NULL OR created_at = '' OR created_at GLOB '[A-Z][A-Z]');
