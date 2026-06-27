# Development Plan

This is the current implementation checklist. It uses checkboxes so PRs can update the plan as work lands.

`list` is intentionally absent. It is not planned.

## Current Foundation

- [x] FastAPI backend with SQLite schema initialization.
- [x] Next.js frontend with app-router pages and frontend API proxy routes.
- [x] Global capture bar with explicit grammar parsing.
- [x] Module-implied grammar for known module pages.
- [x] Tasks backend and frontend.
- [x] Events backend and frontend.
- [x] Reminders backend and frontend.
- [x] Journals backend and frontend.
- [x] Notes backend and frontend.
- [x] Files backend and frontend.
- [x] Fax backend and frontend.
- [x] Supplies backend and frontend.
- [x] Scribble temporary workspace.
- [x] Web Push workflow notifications.
- [x] Pushover system/admin notification path.
- [x] Korean public holiday sync.
- [x] Shared backend weather cache.
- [x] Family UI section.
- [x] Family calendar local event model.
- [x] Family all-day event support.
- [x] Family weather display using shared backend weather.
- [x] Family caregiver hour entry and monthly review.
- [x] 로운이 timetable templates and date-based assignments.
- [x] Family local drag/drop for calendar and timetable where implemented.

## Near-Term Stabilization

- [ ] Keep frontend validation green after each PR.
- [ ] Add backend test dependencies to the local dev environment so backend pytest can run consistently.
- [ ] Keep source tests less brittle by avoiding CSS property-order assertions.
- [ ] Audit docs after major module changes.
- [ ] Keep Family UI Korean wording standard, soft, and non-dialect.
- [ ] Keep Family localStorage compatibility tests for renamed concepts such as `roni` -> `rouny`.
- [ ] Keep selected-file fax grammar separate from File save grammar.
- [ ] Confirm desktop Firefox date/time picker fallbacks remain usable.

## Backend Plans

- [ ] Continue SQLite-first schema evolution.
- [ ] Keep repositories SQL-only and services behavior-focused.
- [ ] Add backend tests for each new service behavior.
- [ ] Make weather cache provider easier to swap without frontend changes.
- [ ] Improve observability for internal scheduled endpoints.
- [ ] Keep Pushover reserved for system/admin alarms unless explicitly escalated.
- [ ] Harden fax temp-file retention and cleanup reporting.
- [ ] Add migration notes when local or durable storage keys change.

## Frontend Plans

- [ ] Keep API route handlers thin proxies.
- [ ] Keep module pages compact and task-specific.
- [ ] Avoid duplicating backend domain rules in browser code.
- [ ] Keep shared capture behavior centralized in `TopCaptureBar` and `module-implied-capture.js`.
- [ ] Keep weather reads centralized in `frontend/app/lib/weather-client.js`.
- [ ] Keep Family font/color conventions centralized in Family CSS.
- [ ] Avoid horizontal overflow on mobile forms and calendars.

## Family Plans

- [ ] Preserve Family localStorage keys or provide compatibility migrations.
- [ ] Keep 로운이 timetable templates distinct from calendar overrides.
- [ ] Keep caregiver monthly review fixed-width and calculation-focused.
- [ ] Keep Family calendar weather compact and optional in expanded week rows.
- [ ] Keep drag/drop behavior consistent across Family calendar and 로운이 timetable.
- [ ] Consider backend migration only with explicit scope, migration, and rollback plan.

## Capture Grammar Plans

- [x] Document current explicit prefixes.
- [x] Document selected-file behavior for File and Fax.
- [x] Document module-implied capture behavior.
- [x] Mark `==`/list as deprecated and not planned.
- [ ] Add backend tests for any new grammar before UI wiring.
- [ ] Keep capture error messages module-specific when selected files are involved.

## Not Planned

- [ ] Generic `list` module.
- [ ] Discord bot architecture.
- [ ] Telegram bot architecture.
- [ ] Frontend direct weather-provider calls.
- [ ] Postgres requirement for current deployment.
- [ ] A separate Family weather backend.
