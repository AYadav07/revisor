#!/usr/bin/env bash
# Postgres backup (DEPLOYMENT.md "Backups"): pg_dump → encrypted, deduplicated restic snapshot in
# object storage → retention. Run nightly by the revisor-backup systemd timer; safe to run by hand.
#
#   ./backup.sh              take a backup now
#   ./backup.sh init         create the restic repository (once, before the first backup)
#   ./backup.sh <command>    any other restic command, e.g. `snapshots`, or `dump ...` to restore
#
# The dump is written to a local file first and checked before upload, so a failed or truncated
# dump fails the run instead of being saved as a snapshot. The file is deleted as soon as it's
# uploaded — nothing accumulates on the VM's small disk. restic encrypts on the VM, so the storage
# provider never sees the data (it contains emails, password hashes and notes).
set -Eeuo pipefail
cd "$(dirname "$0")"

# The dump directory is bind-mounted into the restic container. It must exist before any container
# starts, or Docker creates it owned by root and this script can no longer write to it. It stays in
# place between runs; only the dump inside it is removed.
work="$PWD/.backup-work"
install -d -m 700 "$work"
dump="$work/revisor.dump"

restic() { docker compose run --rm -T backup "$@"; }

ping_url="$(grep -s '^BACKUP_PING_URL=' .env | cut -d= -f2- || true)"
ping() { [[ -z "$ping_url" ]] || curl -fsS -m 10 --retry 3 -o /dev/null "$ping_url$1" || true; }

# Any argument is a restic command (init, snapshots, dump, ...), run as-is — always through this
# script, so the dump directory exists with the right owner first.
if [[ $# -gt 0 ]]; then
  restic "$@"
  exit
fi

# Anything below that fails reports to the (optional) dead-man's-switch monitor.
trap 'ping /fail' ERR

trap 'rm -f "$dump"' EXIT

ping /start
# Uncompressed: restic compresses anyway, and only an uncompressed dump lets it deduplicate the
# unchanged tables between nights, so storage grows with changes, not with database size.
docker compose exec -T postgres pg_dump -U revisor -d revisor --format=custom --compress=0 > "$dump"
[[ -s "$dump" ]] || { echo "pg_dump produced an empty file" >&2; false; }
# Reading the archive's table of contents proves it's a complete, well-formed dump.
docker compose exec -T postgres pg_restore --list < "$dump" > /dev/null

restic backup --host revisor --tag postgres /dump/revisor.dump
restic forget --host revisor --tag postgres --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
# Weekly integrity check of the repository itself, reading a sample of the stored data.
if [[ "$(date +%u)" == 7 ]]; then
  restic check --read-data-subset=10%
fi

echo "Backup complete: $(du -h "$dump" | cut -f1) dump"
ping ""
