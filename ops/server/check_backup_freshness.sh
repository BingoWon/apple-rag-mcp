#!/usr/bin/env bash

set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/apple_rag_stack/backups}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-36}"

latest_backup="$(
	find "$BACKUP_DIR" -maxdepth 1 -type f -name 'apple_rag_db_backup_*.dump' \
		-printf '%T@ %p\n' |
		sort -nr |
		head -n 1 |
		cut -d ' ' -f 2-
)"

if [[ -z "$latest_backup" ]]; then
	echo "No PostgreSQL backup archive found." >&2
	exit 1
fi

latest_mtime="$(stat -c %Y "$latest_backup")"
current_time="$(date +%s)"
age_seconds=$((current_time - latest_mtime))
max_age_seconds=$((MAX_AGE_HOURS * 60 * 60))

if ((age_seconds > max_age_seconds)); then
	echo "Latest PostgreSQL backup is older than ${MAX_AGE_HOURS} hours: ${latest_backup}" >&2
	exit 1
fi

base_path="${latest_backup%.dump}"
for required_file in \
	"$latest_backup" \
	"${base_path}.globals.sql" \
	"${base_path}.config.tar.gz" \
	"${base_path}.sha256"; do
	if [[ ! -s "$required_file" ]]; then
		echo "Required backup artifact is missing or empty: ${required_file}" >&2
		exit 1
	fi
done

echo "Latest PostgreSQL backup is fresh and complete: ${latest_backup}"
