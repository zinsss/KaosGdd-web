# KaosGdd Current Spec

KaosGdd is a private, single-user, web-first personal operations app. The backend is the source of truth for shared application data. The frontend is a client surface that renders modules, proxies browser-safe API requests, and handles local-only Family interactions where explicitly scoped.

This document is the short product spec. For implementation details, see:

- [Architecture](architecture.md)
- [Capture Grammar](capture-grammar.md)
- [Development Plan](development-plan.md)
- [Shared Weather Cache](weather-cache.md)

## Core Rules

- Backend owns shared data truth: validation, parsing, state transitions, scheduling, notifications, weather cache, and durable records.
- Frontend owns presentation, browser interaction, local page state, and explicitly local Family-only storage.
- SQLite remains the production database for now.
- The app is private and Tailscale-oriented.
- Mobile-first behavior matters, but desktop validation should keep working.
- `list` is not a product module and is not planned.

## Product Surfaces

Shared KaosGdd surfaces:

- Dashboard
- Capture bar
- Tasks
- Events
- Reminders
- Journals
- Notes
- Files
- Fax
- Supplies
- Scribble
- Settings

Family surfaces:

- Family dashboard
- Family calendar
- Family tasks
- 로운이 timetable templates
- Memo
- Caregiver hours and monthly review

## Data Ownership

Backend-owned durable data:

- Tasks, task metadata, subtasks, and reminders
- Events, recurrence, classification, public holiday sync
- Journals and notes
- Files and fax records
- Supplies and presets
- Scribbles
- Push subscriptions, notification preferences, diagnostics
- Weather locations and weather cache

Frontend-local Family data:

- Family calendar events and all-day items
- 로운이 timetable templates and assignments
- 로운이 calendar overrides
- Family task ordering and Family-only task fields
- Memo/checklist content
- Caregiver date-specific hours and hourly wage

Frontend-local data should stay local unless a future PR explicitly migrates it into backend storage.

## Capture Model

Capture is prefix-based. The user can type structured grammar directly, and module pages can imply grammar for unprefixed text.

Examples:

```text
-- 약 사기
d:2026-06-30
r:2026-06-30 09:00
#family
```

```text
^^ 2026-07-01 병원
r:2026-07-01 08:30
```

```text
fax:02-1234-5678
```

For full grammar details and examples, see [Capture Grammar](capture-grammar.md).

## Notification Routing

- Web Push handles ordinary app workflow events: reminders, missed reminders, overdue tasks, received faxes, failed fax sends, and status attention.
- Pushover is reserved for admin/system/out-of-band alarms and configured escalation paths.
- The backend scheduler/systemd timers trigger due reminder scans, missed reminder scans, daily summaries, lifecycle maintenance, and claim-day task creation.

## Weather

Weather is one shared backend subsystem. Frontend pages request KaosGdd weather through `/api/weather`; frontend code must not call the external provider directly. Main Events and Family Calendar use the same cached payload.

## Explicit Non-Goals

- No `list` module.
- No Telegram or Discord integration.
- No Postgres requirement for current production.
- No separate Family weather backend.
- No frontend-owned external weather fetching.
