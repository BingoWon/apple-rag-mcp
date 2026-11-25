BEGIN;

-- 1. Non-blocking HTTP conditional-fetch & radar metadata on pages
ALTER TABLE pages ADD COLUMN IF NOT EXISTS http_etag text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS source_modified_at timestamptz;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS radar_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pages_radar_queue
	ON pages (radar_checked_at ASC NULLS FIRST, url ASC)
	WHERE url ~ '^https://developer\.apple\.com/documentation/[^/]+$'
	   OR url LIKE 'https://developer.apple.com/documentation/%-release-notes%'
	   OR url LIKE 'https://developer.apple.com/documentation/updates%';

-- 2. Collector execution heartbeat logs (live freshness transparency)
CREATE TABLE IF NOT EXISTS collector_run_logs (
	id bigserial PRIMARY KEY,
	started_at timestamptz NOT NULL,
	completed_at timestamptz NOT NULL DEFAULT now(),
	duration_ms integer NOT NULL,
	sweep_source text NOT NULL CHECK (sweep_source IN ('radar', 'sweep', 'videos')),
	claimed integer NOT NULL DEFAULT 0,
	not_modified integer NOT NULL DEFAULT 0,
	updated integer NOT NULL DEFAULT 0,
	unchanged integer NOT NULL DEFAULT 0,
	added integer NOT NULL DEFAULT 0,
	deleted integer NOT NULL DEFAULT 0,
	failed integer NOT NULL DEFAULT 0,
	events_recorded integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collector_run_logs_completed_at
	ON collector_run_logs (completed_at DESC);

-- 3. Structured Apple documentation change events + compact unified diff
CREATE TABLE IF NOT EXISTS doc_change_events (
	id bigserial PRIMARY KEY,
	url text NOT NULL,
	framework text NOT NULL,
	title text NOT NULL,
	symbol_kind text,
	change_kind text NOT NULL CHECK (
		change_kind IN (
			'added',
			'removed',
			'deprecated',
			'beta_changed',
			'signature_changed',
			'content_revised',
			'video_added'
		)
	),
	significance text NOT NULL CHECK (significance IN ('high', 'medium', 'low')),
	sweep_source text NOT NULL CHECK (sweep_source IN ('radar', 'sweep', 'videos', 'backfill')),
	summary text NOT NULL,
	change_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
	diff_snippet text,
	source_modified_at timestamptz,
	detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_change_events_detected_at
	ON doc_change_events (detected_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_doc_change_events_framework_detected
	ON doc_change_events (framework, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_change_events_kind_detected
	ON doc_change_events (change_kind, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_change_events_sig_detected
	ON doc_change_events (significance, detected_at DESC);

-- 4. Daily & weekly bilingual AI trend digests
CREATE TABLE IF NOT EXISTS doc_change_digests (
	id bigserial PRIMARY KEY,
	period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly')),
	period_key text NOT NULL,
	window_start timestamptz NOT NULL,
	window_end timestamptz NOT NULL,
	status text NOT NULL CHECK (status IN ('ready', 'fallback')),
	provider text NOT NULL,
	model text NOT NULL,
	neurons_estimated integer NOT NULL DEFAULT 0,
	input_tokens integer,
	output_tokens integer,
	stats jsonb NOT NULL DEFAULT '{}'::jsonb,
	content_en jsonb NOT NULL,
	content_zh jsonb NOT NULL,
	generated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_doc_change_digests_period
	ON doc_change_digests (period_type, period_key DESC);

-- 5. Daily Cloudflare Workers AI free-tier Neuron budget counter
CREATE TABLE IF NOT EXISTS ai_neuron_usage (
	day date PRIMARY KEY,
	neurons_used integer NOT NULL DEFAULT 0,
	calls integer NOT NULL DEFAULT 0,
	updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE
	ON collector_run_logs, doc_change_events, doc_change_digests, ai_neuron_usage
	TO apple_rag_user;

GRANT USAGE, SELECT, UPDATE
	ON SEQUENCE collector_run_logs_id_seq, doc_change_events_id_seq, doc_change_digests_id_seq
	TO apple_rag_user;

COMMIT;
