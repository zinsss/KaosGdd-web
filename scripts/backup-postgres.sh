#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${POSTGRES_BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
COMPOSE_SERVICE="${POSTGRES_SERVICE:-postgres}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/kaosgdd-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose --project-directory "$ROOT_DIR" ps -q "$COMPOSE_SERVICE" >/dev/null 2>&1; then
    echo "Writing Postgres dump from compose service '$COMPOSE_SERVICE' to $OUT"
    docker compose --project-directory "$ROOT_DIR" exec -T "$COMPOSE_SERVICE" \
      sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$OUT"
    ls -lh "$OUT"
    exit 0
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: no running compose Postgres service found and DATABASE_URL is not set." >&2
  echo "Start the stack or export DATABASE_URL before running this script." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is not installed and compose service '$COMPOSE_SERVICE' is unavailable." >&2
  exit 1
fi

echo "Writing Postgres dump from DATABASE_URL to $OUT"
pg_dump -Fc "$DATABASE_URL" > "$OUT"
ls -lh "$OUT"
