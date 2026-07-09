# 32GB Odroid Postgres preparation

This is preparation for KaosGdd Postgres migration on the 32GB Odroid Docker host.
It does not by itself prove that production data has been migrated.

Orthanc is intentionally out of scope. Do not share an Orthanc database, schema, or
Postgres volume with KaosGdd. Orthanc remains separate on the 64GB host.

## Current state

- Backend persistence can run against SQLite or Postgres depending on `DATABASE_URL`.
- Family UI data is still browser `localStorage`.
- Postgres is prepared as a separate Docker service and volume.
- `.env.example` now shows Postgres as the primary example and keeps SQLite as the documented fallback.
- `docker-compose.yml` starts the `postgres` service and makes the backend wait for it to be healthy.
- Fresh Postgres init creates schemas:
  - `main`
  - `family`
- Backend schema bootstrap is Postgres-aware through `DATABASE_SCHEMA`/search path.
- Full existing SQLite data migration still requires an explicit runbook and verification.

## Services and volume

Docker Compose services:

- `postgres`: `postgres:16`, private Docker-network database service.
- `backend`: KaosGdd FastAPI backend container.
- `frontend`: KaosGdd Next.js frontend container.

Persistent Docker volume:

- `kaosgdd_postgres_data` mounted at `/var/lib/postgresql/data` inside `postgres`.

Repo backup folder:

- `backups/postgres/`

## Environment

Copy `.env.example` to `.env` and change secrets before starting a real host:

```bash
cp .env.example .env
```

Important variables:

```bash
APP_TIMEZONE=Asia/Seoul
POSTGRES_DB=kaosgdd
POSTGRES_USER=kaosgdd
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://kaosgdd:change_me@kaosgdd-postgres:5432/kaosgdd
DATABASE_SCHEMA=main
```

Do not commit real secrets.

SQLite fallback remains valid for local or rollback use:

```bash
DATABASE_URL=sqlite:////data/kaosgdd.db
```

## Start Postgres only

```bash
docker compose up -d postgres
docker compose ps postgres
```

The init SQL in `docker/postgres/init/001_create_schemas.sql` runs only when the
Postgres data volume is first initialized.

## Check connection and schemas

From the backend container context:

```bash
docker compose run --rm backend python scripts/check_postgres_connection.py
```

Or from the host with a reachable `DATABASE_URL` and Python dependencies installed:

```bash
DATABASE_URL=postgresql://kaosgdd:change_me@localhost:5432/kaosgdd \
  python backend/scripts/check_postgres_connection.py
```

Expected output includes:

```text
connected database=kaosgdd user=kaosgdd
schemas=family,main
```

## Start the Docker stack

```bash
docker compose up -d
```

The backend schema bootstrap can create v0 tables under Postgres. Do not treat
that as a completed data migration. Existing SQLite data still needs a verified
copy/check process before production cutover.

## Backup Postgres

Run:

```bash
scripts/backup-postgres.sh
```

Default output:

```text
backups/postgres/kaosgdd-YYYYMMDD-HHMMSS.dump
```

The script prefers `docker compose exec postgres pg_dump`, so Postgres does not
need a public host port.

## Restore a backup

For a fresh database, after starting `postgres`:

```bash
cat backups/postgres/kaosgdd-YYYYMMDD-HHMMSS.dump \
  | docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists'
```

Review the target host and backup file before restore. Restore is destructive when
`--clean` drops objects.

## What remains before actual migration

- Confirm the live deployed `DATABASE_URL` and `DATABASE_SCHEMA`.
- Migrate existing SQLite data from `data/kaosgdd.db`.
- Verify row counts and critical records after migration.
- Run frontend/backend smoke tests against Postgres-backed app data.
- Define rollback: whether to switch `DATABASE_URL` back to SQLite or restore Postgres backup.
- Migrate Family browser `localStorage` data only after a separate product/data plan.
- Add production backup/restore runbooks and timers once data is actually in Postgres.
- Keep Orthanc separate from this KaosGdd database.

## Needs More Information

Before flipping production permanently, collect:

- current production SQLite database path and backup location,
- exact Docker service name used by production compose (`postgres` vs `kaosgdd-postgres` host alias),
- target backup cadence for Postgres dumps,
- acceptable downtime window for migration,
- validation checklist for fax records, files, reminders, weather cache, and task/event counts.
