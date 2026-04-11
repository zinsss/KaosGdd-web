from sqlalchemy import text

from app.config import DbTables

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS {items} (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    deleted_at TEXT,
    CHECK (item_type IN ('task', 'reminder')),
    CHECK (status IN ('active', 'removed', 'archived', 'deleted'))
);

CREATE TABLE IF NOT EXISTS {task_items} (
    item_id TEXT PRIMARY KEY,
    due_at TEXT,
    memo TEXT,
    is_done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE,
    CHECK (is_done IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {task_subtasks} (
    id TEXT PRIMARY KEY,
    task_item_id TEXT NOT NULL,
    content TEXT NOT NULL,
    position INTEGER NOT NULL,
    is_done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    removed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_item_id) REFERENCES {task_items}(item_id) ON DELETE CASCADE,
    CHECK (is_done IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {reminder_items} (
    item_id TEXT PRIMARY KEY,
    remind_at TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'scheduled',
    alert_policy TEXT,
    last_fired_at TEXT,
    acked_at TEXT,
    snoozed_until TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE,
    CHECK (state IN ('scheduled', 'fired', 'acked', 'missed', 'cancelled', 'snoozed'))
);

CREATE TABLE IF NOT EXISTS {reminder_events} (
    id TEXT PRIMARY KEY,
    reminder_item_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_at TEXT NOT NULL,
    payload_json TEXT,
    FOREIGN KEY (reminder_item_id) REFERENCES {reminder_items}(item_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {item_reminders} (
    item_id TEXT NOT NULL,
    reminder_item_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (item_id, reminder_item_id),
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE,
    FOREIGN KEY (reminder_item_id) REFERENCES {reminder_items}(item_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {item_tags} (
    item_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (item_id, tag),
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_reminders_one_parent_per_reminder
ON {item_reminders}(reminder_item_id);

CREATE INDEX IF NOT EXISTS idx_items_type_status
ON {items}(item_type, status);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_item_id
ON {task_subtasks}(task_item_id);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_position
ON {task_subtasks}(task_item_id, position);

CREATE INDEX IF NOT EXISTS idx_item_tags_tag
ON {item_tags}(tag);

CREATE INDEX IF NOT EXISTS idx_reminder_items_state_time
ON {reminder_items}(state, remind_at, snoozed_until);
""".format(
    items=DbTables.ITEMS,
    task_items=DbTables.TASK_ITEMS,
    task_subtasks=DbTables.TASK_SUBTASKS,
    reminder_items=DbTables.REMINDER_ITEMS,
    reminder_events=DbTables.REMINDER_EVENTS,
    item_reminders=DbTables.ITEM_REMINDERS,
    item_tags=DbTables.ITEM_TAGS,
)


def init_schema_v0(engine) -> None:
    with engine.begin() as conn:
        for statement in SCHEMA_SQL.split(";\n\n"):
            sql = statement.strip()
            if not sql:
                continue
            conn.execute(text(sql))
