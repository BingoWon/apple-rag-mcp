# Production Operations

`ops/server` contains the reproducible PostgreSQL configuration used by the production VPS.

## Database

- `docker-compose.yml` runs PostgreSQL 16 with pgvector.
- `postgresql.conf` contains the production tuning and observability settings.
- `pg_hba.conf` requires TLS for remote connections.
- `postgresql_canonicalize_urls.sql` is the one-time Apple URL deduplication migration.
- `postgresql_indexes.sql` and `postgresql_runtime_maintenance.sql` contain online maintenance changes.

## Backups

The systemd timers run and verify a daily custom-format backup. Production secrets and generated
backup data are intentionally excluded from Git.

```bash
systemctl enable --now apple-rag-postgres-backup.timer
systemctl enable --now apple-rag-postgres-backup-check.timer
```

## Deployment

Application deployments must run `pnpm build` before `wrangler deploy`. The build command includes
lint, type checking, and tests. Apply D1 migrations with `pnpm db:migrate`.
