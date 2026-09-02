\set ON_ERROR_STOP on

ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '4GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET autovacuum_work_mem = '256MB';
ALTER SYSTEM SET temp_buffers = '16MB';
ALTER SYSTEM SET max_worker_processes = '8';
ALTER SYSTEM SET max_parallel_workers = '3';
ALTER SYSTEM SET max_parallel_workers_per_gather = '1';
ALTER SYSTEM SET max_parallel_maintenance_workers = '1';
ALTER SYSTEM SET autovacuum_max_workers = '3';

ALTER SYSTEM SET logging_collector = 'on';
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET log_connections = 'off';
ALTER SYSTEM SET log_disconnections = 'off';
ALTER SYSTEM SET log_min_duration_statement = '1000ms';
ALTER SYSTEM SET log_checkpoints = 'on';
ALTER SYSTEM SET log_lock_waits = 'on';
ALTER SYSTEM SET log_temp_files = '64MB';
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
ALTER SYSTEM SET track_functions = 'none';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET ssl = 'on';
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';

SELECT pg_reload_conf();
