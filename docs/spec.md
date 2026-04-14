# KaosGdd Web Spec

## Core rules
- DB > Engine > UI
- Web app is a client, not the source of truth
- Tailscale-only access for v0
- Mobile-first, text-heavy interface

## v0 scope
- dashboard
- active tasks list
- task detail view
- add task input
- toggle done
- edit title / due / reminder

## Later
- parser integration
- reminders UI
- notes/files/mail modules
- smarter auth layer inside tailnet

## SQLite schema evolution note
- The backend now includes a startup migration for legacy SQLite databases whose `items.item_type` check only allowed `task` and `reminder`.
- If you are running an older local DB and see event-creation failures, either:
  - let the app start once so the migration can run, or
  - reset the DB file in disposable environments.
