# Production Operations

`ops/server` contains the reproducible PostgreSQL configuration used by the production VPS.

## Database

- `docker-compose.yml` runs PostgreSQL 16 with pgvector.
- `postgresql.conf` contains the production tuning and observability settings.
- `pg_hba.conf` requires SCRAM authentication for remote connections.
- `configure_firewall.sh` exposes PostgreSQL through UFW and removes conflicting Docker reset rules.
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

## Releases

Update `package.json` and `server.json` to the same new version, then push to `main`.
After CI succeeds, `.github/workflows/release.yml` creates its `vX.Y.Z` tag and release.
An existing tag is skipped. `chore(release): vX.Y.Z` is the release commit naming convention,
not the trigger; changing the commit message without changing the version does not publish a release.

## Interface Checks

After `pnpm build`, run `node ops/ui/check-jev-copy.mjs` with
[Playwright](https://github.com/microsoft/playwright) and
[live-server](https://github.com/tapio/live-server) available on the
[Node.js](https://github.com/nodejs/node) module path,
and [Google Chrome](https://www.google.com/chrome/) installed.
The check covers bilingual headings, sidebar folding, alignment, overflow, themes, and short screens.
Generated results stay in the ignored `ops/ui/results/` directory; the temporary server closes automatically.
