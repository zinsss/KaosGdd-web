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
- [Postgres Migration Notes](postgres-migration-32gb.md): exploratory notes only; SQLite remains current production.

## Current Product Direction

- Backend is the shared source of truth.
- Frontend is a client surface plus explicitly local Family UI storage.
- SQLite remains current production.
- `list` is not a product module and is not planned.

## Documentation Rules

- Update [Architecture](architecture.md) when adding backend routes, frontend proxy routes, database tables, or module boundaries.
- Update [Capture Grammar](capture-grammar.md) before or with grammar changes.
- Update [Development Plan](development-plan.md) when a planned item lands or is explicitly rejected.
- Keep docs aligned with source tests where possible.
