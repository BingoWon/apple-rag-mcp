# Production Operations

`ops/server` contains the reproducible PostgreSQL configuration used by the production VPS.

## Database

- `docker-compose.yml` runs PostgreSQL 16 with pgvector (`mem_limit: 3g`).
- `postgresql.conf` contains the production tuning and observability settings (updated 2026-11-24 to fit the 3 GB container budget: `shared_buffers = 1GB`, `effective_cache_size = 2GB`, `maintenance_work_mem = 256MB`, `autovacuum_work_mem = 128MB`).
- `pg_hba.conf` requires TLS (`hostssl`) + SCRAM authentication for remote connections (updated 2026-11-24; apply on VPS per [2026-11-24 review](reviews/2026-11-24-global-review-and-remediation.md)).
- `configure_firewall.sh` exposes PostgreSQL through UFW and removes conflicting Docker reset rules.
- `postgresql_canonicalize_urls.sql` is the one-time Apple URL deduplication migration.
- `postgresql_indexes.sql`, `postgresql_keyword_symbols.sql`, `postgresql_catalog.sql`, `postgresql_web_retrieval.sql`, `postgresql_harden_roles.sql`, and `postgresql_runtime_maintenance.sql` contain schema, indexing, and maintenance scripts.
- `publish_catalog.py` and `systemd/apple-rag-catalog.*` publish the read-only `browse` topic catalog hourly.

## Backups

The systemd timers run and verify a daily custom-format backup. Production secrets and generated
backup data are intentionally excluded from Git.

```bash
systemctl enable --now apple-rag-postgres-backup.timer
systemctl enable --now apple-rag-postgres-backup-check.timer
```

## Deployment

Run `pnpm build` (lint, type checking, tests and build), then commit and push to
`main`; Cloudflare Workers deploys that commit automatically. Do not run manual
`wrangler deploy` for routine changes. Apply D1 migrations with `pnpm db:migrate`
after inspecting the live schema, Time Travel point and write budget. Table copies
must name columns explicitly. Rebuilds and index work can exhaust D1's free daily
write allowance even on small databases. Verify real MCP tool results after release;
`/health` only establishes liveness. See the [2026-11-03 incident](incidents/2026-11-03-admin-log-recovery.md).

## Releases

Update `package.json` and `server.json` to the same new version, then push to `main`.
After CI succeeds, `.github/workflows/release.yml` creates its `vX.Y.Z` tag and release.
An existing tag is skipped. `chore(release): vX.Y.Z` is the release commit naming convention,
not the trigger; changing the commit message without changing the version does not publish a release.

The independent npm CLI package, account/quota contract, artifact checks and
owner-operated first publication are documented in [CLI operations](cli.md).

## Interface Checks

After `pnpm build`, run `node ops/ui/check-jev-copy.mjs` with
[Playwright](https://github.com/microsoft/playwright) and
[live-server](https://github.com/tapio/live-server) available on the
[Node.js](https://github.com/nodejs/node) module path,
and [Google Chrome](https://www.google.com/chrome/) installed.
The check covers bilingual headings, default desktop expansion, mobile menu closing, saved choices,
label/icon hover synchronization, theme and language switching, alignment, overflow, and short screens.
Generated results stay in the ignored `ops/ui/results/` directory.
The temporary server chooses an available port and closes automatically.
