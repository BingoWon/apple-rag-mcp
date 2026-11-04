-- Legacy MCP writers were retired before 0010 applied at this UTC cutover.
-- CLI requests already carry a request_id; never infer their source from a missing channel.
UPDATE search_logs SET channel='mcp'
WHERE channel='unknown' AND request_id IS NULL
  AND julianday(created_at) < julianday('2026-11-03T08:39:15Z');
UPDATE fetch_logs SET channel='mcp'
WHERE channel='unknown' AND request_id IS NULL
  AND julianday(created_at) < julianday('2026-11-03T08:39:15Z');
