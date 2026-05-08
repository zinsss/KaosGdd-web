# KaosGdd Web Core Freeze v0

## 1. Product identity
- KaosGdd is web-only.
- Single-user.
- Private.
- Accessed through Tailscale only.
- Hosted on a Debian server with systemd.
- No Telegram support.
- No Discord support.

## 2. Core architecture
- SQLite is the source of truth.
- DB > Engine > UI.
- Backend owns validation, parsing, scheduling, state transitions, sorting, and reminder dispatch.
- Frontend is a client surface and must not invent business truth.

## 3. Module order
1. Tasks + Reminders
2. Events
3. Notes

## 4. Navigation
- One main list.
- Back button returns to main.
- Main list is tasks.
- Reminders affect tasks and alerts, but reminders are not the home screen object.

## 5. Capture model
- Hybrid.
- Fast capture input is important.
- Structured forms are used where helpful.
- The product is not a fake chat app.

## 6. Notification routing
- Reminder transport is not the web page itself.
- App-wise/item-wise workflow notifications are delivered by Web Push and should deep-link into the app where possible.
- Web Push app events include reminder fired, reminder missed, task became overdue, fax received, and item-level fax send failed.
- Pushover is reserved for system-wise/admin/out-of-band alarms such as backend startup failure, scheduler crashes, reminder scan crashes, backup or migration failure, disk pressure, repeated Web Push delivery-system failure, fax modem offline, fax daemon crashes, fax temp-file cleanup failure, and other server maintenance alerts.
- Do not send both Web Push and Pushover for the same ordinary app item event.
- Backend scheduler reads due reminders and dispatches Web Push notifications.

## 7. Schema direction
The temporary scaffold schema in KaosGdd-web is disposable.
The real v0 direction is:
- items
- task_items
- task_subtasks
- reminder_items
- item_reminders
- item_tags
- reminder_events

The current kaoticgdd shape is a useful base, but bot-facing tables are not part of KaosGdd.

## 8. Canonical entities
### items
Purpose:
- canonical identity
- item type
- title
- lifecycle timestamps/status

Frozen direction:
- id
- item_type
- title
- status
- created_at
- updated_at
- archived_at
- deleted_at

Allowed item_type for v0:
- task
- reminder

Later:
- event
- note

Allowed status for v0:
- active
- removed
- archived
- deleted

### task_items
Frozen direction:
- item_id
- due_at
- memo
- is_done
- done_at

### task_subtasks
Frozen direction:
- id
- task_item_id
- content
- position
- is_done
- done_at
- removed_at
- created_at
- updated_at

### reminder_items
Frozen direction:
- item_id
- remind_at
- state
- alert_policy
- last_fired_at
- acked_at
- snoozed_until

Allowed state:
- scheduled
- fired
- acked
- missed
- cancelled
- snoozed

### item_reminders
Frozen direction:
- a reminder belongs to one parent item
- a parent item can have multiple reminders over time

### item_tags
Frozen direction:
- tags are independent from the task row
- tags are normalized lowercase text links for v0

### reminder_events
Frozen direction:
- reminder history is preserved
- event rows record created, fired, snoozed, acked, missed, and cancelled transitions

## 9. Behavioral rules
### task lifecycle
- A task has separate concepts of lifecycle status and completion.
- Main list shows active tasks.
- Done tasks are still tasks, not a different entity.

### reminder ownership
- Reminders are independent items targeting tasks.
- Tasks do not embed reminders as blobs.
- Reminder state changes are recorded in DB.

### scheduler model
- Scheduler is backend-side.
- Dispatcher reads due reminders.
- Dispatcher sends ordinary app item events through Web Push with app deep links.
- Pushover is an admin/system alarm channel only and is not used for ordinary reminder, task-overdue, fax-received, or item-level fax-send-failed workflow events.
- UI reflects DB state; it does not define it.

### main list behavior
- Main list is tasks.
- Task rows may show done/active state, due, reminder presence, missed state, subtask progress, and tags.
- Reminder rows are not the main operational surface.

## 10. What is explicitly excluded from the inherited design
Do not carry over from kaoticgdd as architecture:
- bot_messages
- ui_state
- channel/message-id driven UI assumptions
- slash-command index resolution as the core interaction model
- Discord bootstrap/panel/message-ops shell

## 11. What remains open
Not frozen yet:
- exact main-list sorting rules
- whether tasks done today stay in active list or move immediately
- exact quick-capture grammar for the web command bar
- event schema
- note schema
- whether tags become global normalized entities later
- search schema

## 12. Immediate implementation consequence
KaosGdd-web should stop deepening the temporary simple tasks table.
The next real backend refactor should move toward:
- items
- task_items
- task_subtasks
- reminder_items
- item_reminders
- item_tags
- reminder_events

The frontend can continue to evolve, but backend/domain work should follow this freeze.
