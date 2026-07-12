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
- SQLite remains the safe fallback. Postgres support is prepared; the active production database is selected by deployed `DATABASE_URL`.
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

## Fax

Fax is a durable backend module with HylaFAX as the transport. Incoming and outgoing records live in the app, while HylaFAX owns modem send/receive queues.

- Selected-file `fax:{number}` is a transient fax send. It creates a Fax record, not a permanent File record.
- File grammar with `x:{number}` creates/saves a File and may send a linked fax.
- The app stores a PDF preview artifact, submits a temporary fax-ready TIFF to HylaFAX, and removes that temporary TIFF after `sendfax` returns.
- Outgoing status can be reconciled from HylaFAX `doneq` when fax lists/details are read.
- Fax inbox rows are collapsed by default; expanded rows expose Details, Open, Download, Save to Files, and Delete.

## Family Subdomain

`family.kaosgdd.net` is a short Family entry point. The frontend proxy rewrites `/`, `/calendar`, `/tasks`, `/roun`, `/memo`, and `/settings` to the corresponding `/family/...` routes. API and static asset paths pass through unchanged.

Family is an independent app surface. `/family/*` and the Family subdomain render the Family shell and Family navigation only, not the main KaosGdd top navigation, capture bar, or attention card.

The only intentional bridges between Family and the main app are the shared backend weather cache, explicit Family task sharing to main tasks, and explicit Family event sharing to main events.

Family content access is separate from main KaosGdd access. Family users should not see the main app. Main users should not browse Family content by default. System-admin access may exist for infrastructure, deployment, health checks, logs, schema checks, and redacted diagnostics, but it must not imply default Family-content access. Temporary developer/support access to Family content is represented by the Family Settings `지원 모드` timer, `support-mode.active`, and `family_support_audit`; Google-login enforcement should use that active timer state as the explicit support-access gate.

## Explicit Non-Goals

- No `list` module.
- No Telegram or Discord integration.
- No mandatory Postgres-only deployment before verified migration and rollback.
- No separate Family weather backend.
- No frontend-owned external weather fetching.
