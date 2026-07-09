# KaosGdd Documentation

Start here when changing architecture, capture behavior, or module boundaries.

## Current Docs

- [Current Spec](spec.md): product scope and high-level rules.
- [Architecture](architecture.md): backend/frontend relationships, module map, data ownership, operational services.
- [Core Freeze](core-freeze-v0.md): invariants that should not drift during feature work.
- [Capture Grammar](capture-grammar.md): separate capture grammars with examples.
- [Development Plan](development-plan.md): checkbox-based implementation plan.
- [Shared Weather Cache](weather-cache.md): backend-owned weather cache design and frontend consumption.
- [Fax Settings](fax-settings.md): HylaFAX host/container setup, outgoing send settings, and verification.
- [Systemd](systemd.md): service/timer deployment notes.
- [Postgres Migration Notes](postgres-migration-32gb.md): prepared-service notes; production cutover depends on deployed `DATABASE_URL`.

## Current Product Direction

- Backend is the shared source of truth.
- Frontend is a client surface plus explicitly local Family UI storage.
- SQLite remains the safe fallback. Postgres is prepared in compose and `.env.example`, but production data source is whichever `DATABASE_URL` is deployed.
- `list` is not a product module and is not planned.

## Current Operational Notes

- Fax sending is active through HylaFAX. Quick selected-file `fax:{number}` creates a fax record, converts the source to app PDF, submits a temporary fax-ready TIFF, and reconciles outgoing status from HylaFAX `doneq` when fax lists/details are read.
- The fax inbox is list-first: rows are collapsed by default, one row expands at a time, and destructive actions are hidden until expansion.
- Family can be served through `family.kaosgdd.net`; the frontend proxy rewrites short Family paths to `/family/...` while leaving API and static asset paths alone.
- Family tasks now support a memo-title checkbox that turns each memo line into a checkable list line. This is still Family-local browser data.

## Documentation Rules

- Update [Architecture](architecture.md) when adding backend routes, frontend proxy routes, database tables, or module boundaries.
- Update [Capture Grammar](capture-grammar.md) before or with grammar changes.
- Update [Development Plan](development-plan.md) when a planned item lands or is explicitly rejected.
- Keep docs aligned with source tests where possible.
