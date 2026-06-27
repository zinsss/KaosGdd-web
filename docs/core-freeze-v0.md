# KaosGdd Core Freeze

This file records the architectural invariants that should not drift during feature work. `list` is not a product module and is not planned.

## 1. Product Identity

- KaosGdd is web-first.
- Single-user.
- Private.
- Tailscale-oriented.
- Hosted on Debian with systemd.
- SQLite remains the production database for now.
- No Telegram support.
- No Discord support.

## 2. Core Architecture

- DB > Engine > UI.
- Backend owns validation, parsing, scheduling, state transitions, sorting, notification dispatch, weather cache, and durable shared records.
- Frontend is a client surface and must not invent shared business truth.
- Family localStorage features are allowed only where explicitly scoped as Family-local behavior.

## 3. Current Shared Modules

- Dashboard
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
- Weather cache

There is no `list` module. Old parser references to `==` are legacy/deprecated and should not be expanded into product work.

## 4. Family Module Boundary

Family UI is intentionally softer and local-first. Current Family features are:

- Calendar
- Tasks
- 로운이 timetable templates
- Memo
- Caregiver hours/review

Family calendar/timetable/caregiver data is currently localStorage-owned. Do not migrate it into backend storage without an explicit migration PR and compatibility plan.

## 5. Capture Model

- Hybrid capture remains core.
- Prefix grammar is the stable contract.
- Structured forms are used where they reduce mistakes.
- Capture is not a fake chat app.
- Module pages can imply grammar for unprefixed input, but explicit prefixes always win.

## 6. Notification Routing

- Reminder transport is backend-owned.
- Web Push handles normal app workflow events.
- Pushover handles admin/system alarms and specific escalation flows.
- Do not send both Web Push and Pushover for the same ordinary workflow event unless explicitly designed.

## 7. Canonical Backend Data

Backend durable records are built around:

- `items`
- task tables
- reminder tables
- event tables
- journal/note/file/fax/supply/scribble tables
- push/notification tables
- weather tables

The current schema evolves through startup-safe SQLite migrations in `backend/app/db/schema_v0.py`.

## 8. Behavioral Rules

Tasks:

- Task lifecycle and completion are separate concepts.
- Done tasks are still tasks.
- Reminders may attach to tasks but are independent records.

Events:

- Events may be dated, ranged, recurring, classified, and linked with reminders.
- Public holidays are synchronized backend-side.

Files/Fax:

- Files are durable records.
- Fax send records are durable fax records.
- Quick outgoing fax with a selected attachment is transient fax send behavior and must not be routed through File save grammar.

Weather:

- Backend owns weather locations, provider fetching, cache, stale handling, and endpoint response.
- Frontend consumes app weather only.

Scribble:

- Scribble is a transient workspace, not a Journal subtype.
- Scribbles may later be converted or copied into durable modules.

## 9. Excluded Inherited Concepts

Do not carry over:

- Discord/bot message architecture
- channel/message-id driven UI
- slash-command index addressing
- Telegram/Discord bootstrap assumptions
- a generic `list` module

## 10. Open But Constrained

Open decisions must still respect the freeze:

- Exact sorting of module pages.
- Future backend migration for selected Family local data.
- Search/indexing.
- More precise auth beyond Tailscale.
- Scheduler expansion.
