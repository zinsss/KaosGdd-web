# KaosGdd Architecture

This document describes the current code architecture and the relationship between backend, frontend, local Family data, and operational services.

## System Shape

```text
Browser / PWA
  |
  | Next.js pages and route handlers
  v
Frontend API proxy routes
  |
  | HTTP to backend base URL
  v
FastAPI backend
  |
  | repo/service layer
  v
SQLite database + filesystem storage
```

Systemd timers and services call backend internal endpoints for scheduled maintenance, reminders, daily summaries, and lifecycle work.

## Backend Layers

Backend path: `backend/app`.

### FastAPI entrypoint

File: `backend/app/main.py`

Responsibilities:

- Create repo and service instances.
- Initialize SQLite schema during lifespan startup.
- Define HTTP endpoints.
- Own internal scheduler endpoints used by systemd.
- Keep request handling thin and delegate domain behavior to services.

### Repositories

Path: `backend/app/db/repo`.

Responsibilities:

- SQL reads/writes.
- SQLite-compatible upserts and migrations.
- Return plain dictionaries/lists to services.

Repositories should not own product decisions. They persist and retrieve.

### Services / Engines

Path: `backend/app/engine`.

Responsibilities:

- Domain validation.
- State transitions.
- Capture-created side effects.
- Notification dispatch decisions.
- Weather cache refresh and stale fallback.
- File/fax conversion behavior.

Services should be the place where product behavior lives.

### Utilities and Parsers

Paths:

- `backend/app/parsers`
- `backend/app/utils`

Responsibilities:

- Capture grammar parsing.
- Raw text normalization.
- Date/time parsing.
- Repeat rule normalization.
- Stable ID helpers.

## Frontend Layers

Frontend path: `frontend`.

### App Router pages

Path: `frontend/app`.

Responsibilities:

- Render module pages.
- Host client components where interaction is needed.
- Keep UI module boundaries visible.

Examples:

- `frontend/app/events`
- `frontend/app/tasks`
- `frontend/app/family`
- `frontend/app/settings`

### Frontend API routes

Path: `frontend/app/api`.

Responsibilities:

- Browser-safe proxy to backend.
- Normalize dynamic route params for Next.js.
- Keep secrets and backend URLs out of browser code.
- Never duplicate backend domain behavior.

Examples:

- `/api/capture` proxies backend `/capture`.
- `/api/tasks` proxies backend `/tasks`.
- `/api/weather` proxies backend `/api/weather`.

### Shared frontend libraries

Path: `frontend/lib` and `frontend/app/lib`.

Responsibilities:

- Browser utilities.
- Client-side route/state helpers.
- Module-implied capture behavior.
- Weather client normalization.
- PWA push helpers.

## Backend / Frontend Relationship

The backend is the source of truth for shared app data. The frontend may optimistically render or transform for display, but it should not create alternate domain rules.

```text
Frontend input
  -> Frontend route handler
  -> Backend endpoint
  -> Service validates/transitions
  -> Repo writes SQLite
  -> Backend returns canonical response
  -> Frontend updates display
```

Exceptions are explicitly local Family features. These live in browser localStorage and are not shared backend truth yet.

## Shared Durable Modules

### Dashboard

Backend:

- `DashboardService`
- `/dashboard`
- `/widget/summary`

Frontend:

- `frontend/app/page.js`
- `frontend/app/DashboardPageClient.js`
- `frontend/app/api/dashboard/route.js`
- `frontend/app/api/widget/summary/route.js`

### Capture

Backend:

- `parse_capture_input`
- `parse_capture`
- `/capture`
- module services for final creation

Frontend:

- `TopCaptureBar`
- `module-implied-capture.js`
- `capture-file-attach.js`
- `/api/capture`

Capture creates module records and then frontend navigation follows `post-create-navigation.js`.

### Tasks

Backend:

- `TaskService`
- `TaskRepo`
- `/tasks`
- `/tasks/{id}`
- `/tasks/{id}/toggle`
- `/tasks/{id}/reminders`

Frontend:

- `frontend/app/tasks`
- `frontend/app/api/tasks`

### Events

Backend:

- `EventService`
- `EventRepo`
- `HolidaySyncService`
- `/events`
- `/events/{id}`
- `/events/{id}/classification`
- `/events/{id}/raw`

Frontend:

- `frontend/app/events`
- `frontend/app/api/events`
- Event weather reads through shared weather client.

### Reminders

Backend:

- `ReminderService`
- `ReminderRepo`
- `/reminders`
- `/reminders/{id}/ack`
- `/reminders/{id}/snooze`
- `/reminders/{id}/cancel`
- internal scheduler endpoints

Frontend:

- `frontend/app/reminders`
- `frontend/app/api/reminders`
- push status helpers

### Journals, Notes, Scribbles

Backend:

- `JournalService`
- `NoteService`
- `ScribbleRepo`
- `/journals`
- `/notes`
- `/scribbles`

Frontend:

- `frontend/app/journals`
- `frontend/app/notes`
- `frontend/app/scribble`

Scribble remains a temporary workspace, not a Journal subtype.

### Files and Fax

Backend:

- `FileService`
- `FaxService`
- `FaxPdfConversionService`
- `/files`
- `/fax`
- `/fax/send-from-file`
- `/fax/send-upload`
- internal fax receive/failure endpoints

Frontend:

- `frontend/app/files`
- `frontend/app/fax`
- `frontend/app/api/files`
- `frontend/app/api/fax`

Selected-file `fax:{number}` quick send is fax-only and must not call File save grammar.

### Supplies

Backend:

- `SupplyService`
- `SupplyRepo`
- `/supplies`
- `/supplies/presets`

Frontend:

- `frontend/app/supplies`
- `frontend/app/api/supplies`

### Weather

Backend:

- `WeatherService`
- `WeatherRepo`
- `weather_locations`
- `weather_cache`
- `/api/weather`

Frontend:

- `frontend/app/api/weather/route.js`
- `frontend/app/lib/weather-client.js`
- Main Events and Family Calendar both consume the same helper.

Frontend must not call Open-Meteo or any future external weather provider directly.

## Family Architecture

Family pages are under `frontend/app/family`.

Shared Family UI:

- `FamilyHeader`
- Family CSS under `frontend/app/styles/family*.css`
- Family font handling under `family-fonts.css`

Family local features:

- Calendar: date/week UI, local events, all-day events, weather display via backend cache, caregiver row.
- Tasks: Family-specific task UI and local ordering/presentation.
- 로운이: local timetable templates, assignments, multi-session editor, calendar overrides.
- Memo: local memo/checklist behavior.
- Caregiver review: fixed-width monthly report from local caregiver hour data.

Family localStorage keys remain local contracts. Do not rename or migrate them without compatibility code.

## Database

Schema file: `backend/app/db/schema_v0.py`.

Important tables:

- `items`
- module-specific item tables
- `task_subtasks`
- `item_reminders`
- reminder event/history tables
- file/fax tables
- supply tables
- scribble tables
- push subscription/preference tables
- `weather_locations`
- `weather_cache`
- `weather_daily_snapshots`

SQLite startup migration is the current schema evolution mechanism.

## Operational Services

Systemd files live under `systemd/`.

Timers/services cover:

- backend and frontend service startup
- due reminder firing
- missed reminder scanning
- daily summary push windows
- claim-day task creation
- lifecycle maintenance

Fax hooks live under `ops/hylafax/`.

Backup scripts live under `ops/backup/` and `scripts/`.

## Non-Architecture Concepts

`list` is not a product module and is not planned.

If code still contains `==` or `modal_type="list"` in legacy parser support, treat it as compatibility/deprecation surface only. Do not build new UI, routes, schema, or planning around it.
