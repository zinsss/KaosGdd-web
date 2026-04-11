from sqlalchemy import text

from app.config import DbTables

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

-- Current live item types intentionally stay narrow.
-- Parser roadmap includes more kinds, but persisted types remain task/reminder for now.
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
    CHECK (status IN ('active', 'removed', 'archived'))
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

CREATE INDEX IF NOT EXISTS idx_item_reminders_item_id
ON {item_reminders}(item_id);

CREATE INDEX IF NOT EXISTS idx_items_type_status
ON {items}(item_type, status);

CREATE INDEX IF NOT EXISTS idx_items_type_status_deleted_at
ON {items}(item_type, status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_item_id
ON {task_subtasks}(task_item_id);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_position
ON {task_subtasks}(task_item_id, position);

CREATE INDEX IF NOT EXISTS idx_item_tags_tag
ON {item_tags}(tag);

CREATE INDEX IF NOT EXISTS idx_reminder_items_state_time
ON {reminder_items}(state, remind_at, snoozed_until);

CREATE INDEX IF NOT EXISTS idx_task_items_done_state_time
ON {task_items}(is_done, done_at);

CREATE INDEX IF NOT EXISTS idx_reminder_items_state_last_fired
ON {reminder_items}(state, last_fired_at);
""".format(
    items=DbTables.ITEMS,
    task_items=DbTables.TASK_ITEMS,
    task_subtasks=DbTables.TASK_SUBTASKS,
    reminder_items=DbTables.REMINDER_ITEMS,
    reminder_events=DbTables.REMINDER_EVENTS,
    item_reminders=DbTables.ITEM_REMINDERS,
    item_tags=DbTables.ITEM_TAGS,
)


def _sqlite_items_status_contains_deleted(conn) -> bool:
    row = conn.execute(
        text(
            """
            SELECT sql
            FROM sqlite_master
            WHERE type = 'table'
              AND name = :table_name
            LIMIT 1
            """
        ),
        {"table_name": DbTables.ITEMS},
    ).fetchone()
    if not row or not row[0]:
        return False
    return "'deleted'" in str(row[0]).lower()


def _migrate_items_drop_deleted_status(conn) -> None:
    if not _sqlite_items_status_contains_deleted(conn):
        return

    legacy_table = f"{DbTables.ITEMS}__legacy_status_v0"
    conn.execute(text("PRAGMA foreign_keys = OFF"))
    conn.execute(text(f"ALTER TABLE {DbTables.ITEMS} RENAME TO {legacy_table}"))
    conn.execute(
        text(
            """
            CREATE TABLE {items} (
                id TEXT PRIMARY KEY,
                item_type TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                archived_at TEXT,
                deleted_at TEXT,
                CHECK (item_type IN ('task', 'reminder')),
                CHECK (status IN ('active', 'removed', 'archived'))
            )
            """.format(items=DbTables.ITEMS)
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO {items}(id, item_type, title, status, created_at, updated_at, archived_at, deleted_at)
            SELECT
                id,
                item_type,
                title,
                CASE WHEN status = 'deleted' THEN 'removed' ELSE status END,
                created_at,
                updated_at,
                archived_at,
                deleted_at
            FROM {legacy}
            """.format(items=DbTables.ITEMS, legacy=legacy_table)
        )
    )
    conn.execute(text(f"DROP TABLE {legacy_table}"))
    conn.execute(text("PRAGMA foreign_keys = ON"))


def init_schema_v0(engine) -> None:
    with engine.begin() as conn:
        _migrate_items_drop_deleted_status(conn)
        for statement in SCHEMA_SQL.split(";\n\n"):
            sql = statement.strip()
            if not sql:
                continue
            conn.execute(text(sql))
