\set ON_ERROR_STOP on

ALTER TABLE public.pages SET (
	autovacuum_vacuum_scale_factor = 0.02,
	autovacuum_analyze_scale_factor = 0.01,
	autovacuum_vacuum_threshold = 500,
	autovacuum_analyze_threshold = 500
);

ALTER TABLE public.chunks SET (
	autovacuum_vacuum_scale_factor = 0.02,
	autovacuum_analyze_scale_factor = 0.01,
	autovacuum_vacuum_threshold = 500,
	autovacuum_analyze_threshold = 500
);

REVOKE INSERT, UPDATE, DELETE ON public.pages_stats FROM apple_rag_user;
REVOKE INSERT, UPDATE, DELETE ON public.pg_stat_statements FROM apple_rag_user;
REVOKE INSERT, UPDATE, DELETE ON public.pg_stat_statements_info FROM apple_rag_user;
