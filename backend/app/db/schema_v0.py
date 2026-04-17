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
    CHECK (item_type IN ('task', 'reminder', 'event', 'journal', 'note', 'file')),
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


CREATE TABLE IF NOT EXISTS {event_items} (
    item_id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT,
    memo TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {journal_items} (
    item_id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {note_items} (
    item_id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {file_items} (
    item_id TEXT PRIMARY KEY,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    memo TEXT,
    fax_number TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS {item_links} (
    source_item_id TEXT NOT NULL,
    target_item_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (source_item_id, target_item_id),
    FOREIGN KEY (source_item_id) REFERENCES {items}(id) ON DELETE CASCADE,
    FOREIGN KEY (target_item_id) REFERENCES {items}(id) ON DELETE CASCADE
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

CREATE INDEX IF NOT EXISTS idx_item_links_source
ON {item_links}(source_item_id);

CREATE INDEX IF NOT EXISTS idx_item_links_target
ON {item_links}(target_item_id);

CREATE INDEX IF NOT EXISTS idx_reminder_items_state_time
ON {reminder_items}(state, remind_at, snoozed_until);

CREATE INDEX IF NOT EXISTS idx_task_items_done_state_time
ON {task_items}(is_done, done_at);

CREATE INDEX IF NOT EXISTS idx_event_items_start_end
ON {event_items}(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_journal_items_created
ON {items}(item_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_note_items_created
ON {items}(item_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_file_items_created
ON {items}(item_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_reminder_items_state_last_fired
ON {reminder_items}(state, last_fired_at);
""".format(
    items=DbTables.ITEMS,
    task_items=DbTables.TASK_ITEMS,
    task_subtasks=DbTables.TASK_SUBTASKS,
    reminder_items=DbTables.REMINDER_ITEMS,
    event_items=DbTables.EVENT_ITEMS,
    journal_items=DbTables.JOURNAL_ITEMS,
    note_items=DbTables.NOTE_ITEMS,
    file_items=DbTables.FILE_ITEMS,
    reminder_events=DbTables.REMINDER_EVENTS,
    item_reminders=DbTables.ITEM_REMINDERS,
    item_tags=DbTables.ITEM_TAGS,
    item_links=DbTables.ITEM_LINKS,
)


def _sqlite_items_table_allows_supported_types(conn) -> bool:
    row = conn.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": DbTables.ITEMS},
    ).fetchone()
    if not row or not row[0]:
        return True
    ddl = str(row[0]).lower()
    return "'event'" in ddl and "'journal'" in ddl and "'note'" in ddl and "'file'" in ddl


def _migrate_sqlite_items_table_add_supported_types(conn) -> None:
    conn.execute(text("PRAGMA foreign_keys = OFF"))
    try:
        conn.execute(text(f"ALTER TABLE {DbTables.ITEMS} RENAME TO {DbTables.ITEMS}__legacy"))
        conn.execute(
            text(
                f"""
                CREATE TABLE {DbTables.ITEMS} (
                    id TEXT PRIMARY KEY,
                    item_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    archived_at TEXT,
                    deleted_at TEXT,
                    CHECK (item_type IN ('task', 'reminder', 'event', 'journal', 'note', 'file')),
                    CHECK (status IN ('active', 'removed', 'archived'))
                )
                """
            )
        )
        conn.execute(
            text(
                f"""
                INSERT INTO {DbTables.ITEMS} (
                    id, item_type, title, status, created_at, updated_at, archived_at, deleted_at
                )
                SELECT
                    id, item_type, title, status, created_at, updated_at, archived_at, deleted_at
                FROM {DbTables.ITEMS}__legacy
                """
            )
        )
        conn.execute(text(f"DROP TABLE {DbTables.ITEMS}__legacy"))
    finally:
        conn.execute(text("PRAGMA foreign_keys = ON"))


def _sqlite_table_columns(conn, table_name: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return {str(row[1]) for row in rows}


def _sqlite_add_column_if_missing(conn, table_name: str, column_sql: str) -> None:
    if not _sqlite_table_columns(conn, table_name):
        return
    column_name = column_sql.split()[0]
    existing = _sqlite_table_columns(conn, table_name)
    if column_name in existing:
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"))


def _migrate_sqlite_legacy_task_reminder_tables(conn) -> None:
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "due_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "memo TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "is_done INTEGER NOT NULL DEFAULT 0")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "done_at TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "position INTEGER NOT NULL DEFAULT 0")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "is_done INTEGER NOT NULL DEFAULT 0")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "done_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "removed_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "created_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "updated_at TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "state TEXT NOT NULL DEFAULT 'scheduled'")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "alert_policy TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "last_fired_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "acked_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "snoozed_until TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.FILE_ITEMS, "memo TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.FILE_ITEMS, "fax_number TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.ITEM_REMINDERS, "created_at TEXT")


def init_schema_v0(engine) -> None:
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite" and not _sqlite_items_table_allows_supported_types(conn):
            _migrate_sqlite_items_table_add_supported_types(conn)
        if engine.dialect.name == "sqlite":
            _migrate_sqlite_legacy_task_reminder_tables(conn)
        for statement in SCHEMA_SQL.split(";\n\n"):
            sql = statement.strip()
            if not sql:
                continue
            conn.execute(text(sql))
