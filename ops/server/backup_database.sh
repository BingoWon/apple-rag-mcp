#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/root/apple_rag_stack/backups}"
CONTAINER="${POSTGRES_CONTAINER:-postgres_db}"
DB_NAME="${POSTGRES_DB:-apple_rag_db}"
DB_USER="${POSTGRES_USER:-apple_rag_user}"
ADMIN_USER="${POSTGRES_ADMIN_USER:-apple_rag_local_admin}"
RETENTION_COUNT="${RETENTION_COUNT:-3}"
LOCK_FILE="${LOCK_FILE:-/var/lock/apple-rag-postgres-backup.lock}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_BASENAME="apple_rag_db_backup_${TIMESTAMP}"
FINAL_PATH="${BACKUP_DIR}/${BACKUP_BASENAME}.dump"
GLOBALS_PATH="${BACKUP_DIR}/${BACKUP_BASENAME}.globals.sql"
CONFIG_PATH="${BACKUP_DIR}/${BACKUP_BASENAME}.config.tar.gz"
CHECKSUM_PATH="${BACKUP_DIR}/${BACKUP_BASENAME}.sha256"
PARTIAL_PATH="${FINAL_PATH}.partial"
GLOBALS_PARTIAL="${GLOBALS_PATH}.partial"
CONFIG_PARTIAL="${CONFIG_PATH}.partial"

log() {
	printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

cleanup_partial() {
	rm -f "$PARTIAL_PATH" "$GLOBALS_PARTIAL" "$CONFIG_PARTIAL"
}

notify_failure() {
	local status="$1"
	local message="Apple RAG PostgreSQL backup failed on $(hostname) with status ${status}"

	log "$message"
	if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
		curl --fail --silent --show-error \
			--max-time 15 \
			-H "Content-Type: text/plain" \
			--data-binary "$message" \
			"$ALERT_WEBHOOK_URL" >/dev/null || true
	fi
}

on_exit() {
	local status="$?"
	cleanup_partial
	if ((status != 0)); then
		notify_failure "$status"
	fi
	exit "$status"
}

trap on_exit EXIT

mkdir -p "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
	log "Another backup is already running; exiting."
	exit 0
fi

if [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER")" != "healthy" ]]; then
	log "PostgreSQL container is not healthy."
	exit 1
fi

docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null

database_bytes="$(
	docker exec "$CONTAINER" \
		psql -X -At -U "$DB_USER" -d "$DB_NAME" \
		-c "SELECT pg_database_size(current_database())"
)"
available_bytes="$(df -B1 --output=avail "$BACKUP_DIR" | tail -n 1 | tr -d ' ')"
required_bytes=$((database_bytes + 2 * 1024 * 1024 * 1024))

if ((available_bytes < required_bytes)); then
	log "Insufficient disk space: available=${available_bytes}, required=${required_bytes}."
	exit 1
fi

log "Starting custom-format backup of ${DB_NAME}."
docker exec "$CONTAINER" \
	pg_dump -U "$DB_USER" -d "$DB_NAME" \
	--format=custom \
	--compress=1 \
	--no-password >"$PARTIAL_PATH"

docker exec "$CONTAINER" \
	pg_dumpall -U "$ADMIN_USER" \
	--globals-only >"$GLOBALS_PARTIAL"

tar -czf "$CONFIG_PARTIAL" \
	-C /root/apple_rag_stack \
	docker-compose.yml \
	config/postgresql/postgresql.conf \
	-C /root/apple_rag_stack/data/pg_data \
	pg_hba.conf \
	server.crt

if [[ ! -s "$PARTIAL_PATH" ]]; then
	log "Backup archive is empty."
	exit 1
fi

if [[ ! -s "$GLOBALS_PARTIAL" || ! -s "$CONFIG_PARTIAL" ]]; then
	log "Globals or configuration archive is empty."
	exit 1
fi

docker exec -i "$CONTAINER" pg_restore --file=/dev/null <"$PARTIAL_PATH"
mv "$PARTIAL_PATH" "$FINAL_PATH"
mv "$GLOBALS_PARTIAL" "$GLOBALS_PATH"
mv "$CONFIG_PARTIAL" "$CONFIG_PATH"

(
	cd "$BACKUP_DIR"
	sha256sum \
		"$(basename "$FINAL_PATH")" \
		"$(basename "$GLOBALS_PATH")" \
		"$(basename "$CONFIG_PATH")"
) >"$CHECKSUM_PATH"

mapfile -d '' backups < <(
	find "$BACKUP_DIR" -maxdepth 1 -type f -name 'apple_rag_db_backup_*.dump' \
		-printf '%T@ %p\0' |
		sort -z -nr |
		cut -z -d ' ' -f 2-
)

if ((${#backups[@]} > RETENTION_COUNT)); then
	for old_backup in "${backups[@]:RETENTION_COUNT}"; do
		old_basename="${old_backup%.dump}"
		rm -f \
			"$old_backup" \
			"${old_basename}.globals.sql" \
			"${old_basename}.config.tar.gz" \
			"${old_basename}.sha256" \
			"${old_backup}.sha256"
		log "Removed expired backup ${old_backup}."
	done
fi

archive_size="$(du -h "$FINAL_PATH" | cut -f 1)"
backup_dir_size="$(du -sh "$BACKUP_DIR" | cut -f 1)"
log "Backup verified: ${FINAL_PATH} (${archive_size}); backup directory=${backup_dir_size}."

trap - EXIT
