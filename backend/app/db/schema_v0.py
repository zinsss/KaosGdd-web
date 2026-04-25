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
    CHECK (item_type IN ('task', 'reminder', 'event', 'journal', 'note', 'file', 'supply')),
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

CREATE TABLE IF NOT EXISTS {supply_items} (
    item_id TEXT PRIMARY KEY,
    normalized_title TEXT NOT NULL,
    done_at TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {supply_presets} (
    name TEXT PRIMARY KEY,
    normalized_name TEXT NOT NULL UNIQUE,
    last_used_at TEXT NOT NULL
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
    CHECK (state IN ('scheduled', 'fired', 'acked', 'missed', 'cancelled', 'snoozed', 'completed'))
);


CREATE TABLE IF NOT EXISTS {push_subscriptions} (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    subscription_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (client_id, endpoint)
);

CREATE TABLE IF NOT EXISTS {push_test_diagnostics} (
    client_id TEXT PRIMARY KEY,
    last_test_at TEXT NOT NULL,
    ok INTEGER NOT NULL,
    sent INTEGER NOT NULL,
    removed INTEGER NOT NULL,
    first_error_summary TEXT,
    updated_at TEXT NOT NULL,
    CHECK (ok IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {push_task_overdue_state} (
    task_item_id TEXT PRIMARY KEY,
    last_due_at TEXT,
    last_is_overdue INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_item_id) REFERENCES {task_items}(item_id) ON DELETE CASCADE,
    CHECK (last_is_overdue IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {push_event_dedupe} (
    event_key TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    created_at TEXT NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_supply_items_done_at
ON {supply_items}(done_at, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supply_items_active_normalized
ON {supply_items}(normalized_title)
WHERE done_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_supply_presets_last_used_at
ON {supply_presets}(last_used_at DESC);

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


CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client
ON {push_subscriptions}(client_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_push_test_diagnostics_updated_at
ON {push_test_diagnostics}(updated_at);

CREATE INDEX IF NOT EXISTS idx_push_task_overdue_state_updated_at
ON {push_task_overdue_state}(updated_at);

CREATE INDEX IF NOT EXISTS idx_push_event_dedupe_type_created
ON {push_event_dedupe}(event_type, created_at);

""".format(
    items=DbTables.ITEMS,
    task_items=DbTables.TASK_ITEMS,
    task_subtasks=DbTables.TASK_SUBTASKS,
    reminder_items=DbTables.REMINDER_ITEMS,
    supply_items=DbTables.SUPPLY_ITEMS,
    supply_presets=DbTables.SUPPLY_PRESETS,
    event_items=DbTables.EVENT_ITEMS,
    journal_items=DbTables.JOURNAL_ITEMS,
    note_items=DbTables.NOTE_ITEMS,
    file_items=DbTables.FILE_ITEMS,
    reminder_events=DbTables.REMINDER_EVENTS,
    item_reminders=DbTables.ITEM_REMINDERS,
    item_tags=DbTables.ITEM_TAGS,
    item_links=DbTables.ITEM_LINKS,
    push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS,
    push_test_diagnostics=DbTables.PUSH_TEST_DIAGNOSTICS,
    push_task_overdue_state=DbTables.PUSH_TASK_OVERDUE_STATE,
    push_event_dedupe=DbTables.PUSH_EVENT_DEDUPE,
)


def _sqlite_items_table_allows_supported_types(conn) -> bool:
    row = conn.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": DbTables.ITEMS},
    ).fetchone()
    if not row or not row[0]:
        return True
    ddl = str(row[0]).lower()
    return "'event'" in ddl and "'journal'" in ddl and "'note'" in ddl and "'file'" in ddl and "'supply'" in ddl


def _sqlite_reminder_items_allows_completed_state(conn) -> bool:
    row = conn.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": DbTables.REMINDER_ITEMS},
    ).fetchone()
    if not row or not row[0]:
        return True
    ddl = str(row[0]).lower()
    return "'completed'" in ddl


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
                    CHECK (item_type IN ('task', 'reminder', 'event', 'journal', 'note', 'file', 'supply')),
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
        _sqlite_rebuild_tables_referencing_legacy_items(conn)
        conn.execute(text(f"DROP TABLE {DbTables.ITEMS}__legacy"))
    finally:
        conn.execute(text("PRAGMA foreign_keys = ON"))


def _sqlite_replace_items_legacy_references(sql: str) -> str:
    return (
        sql.replace(f"REFERENCES {DbTables.ITEMS}__legacy", f"REFERENCES {DbTables.ITEMS}")
        .replace(f'REFERENCES "{DbTables.ITEMS}__legacy"', f'REFERENCES "{DbTables.ITEMS}"')
        .replace(f"references {DbTables.ITEMS}__legacy", f"references {DbTables.ITEMS}")
        .replace(f'references "{DbTables.ITEMS}__legacy"', f'references "{DbTables.ITEMS}"')
    )


def _sqlite_rebuild_tables_referencing_legacy_items(conn) -> None:
    tables = conn.execute(
        text(
            "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE :pattern AND name NOT LIKE 'sqlite_%'"
        ),
        {"pattern": f"%{DbTables.ITEMS}__legacy%"},
    ).fetchall()

    for table_name, table_sql in tables:
        if not table_name or not table_sql:
            continue
        replacement_sql = _sqlite_replace_items_legacy_references(str(table_sql))
        if replacement_sql == table_sql:
            continue

        shadow_table = f"{table_name}__fkfix"
        create_shadow_sql = replacement_sql.replace(f"CREATE TABLE {table_name}", f"CREATE TABLE {shadow_table}", 1)
        create_shadow_sql = create_shadow_sql.replace(
            f"CREATE TABLE IF NOT EXISTS {table_name}", f"CREATE TABLE {shadow_table}", 1
        )
        create_shadow_sql = create_shadow_sql.replace(
            f'CREATE TABLE "{table_name}"', f'CREATE TABLE "{shadow_table}"', 1
        )
        create_shadow_sql = create_shadow_sql.replace(
            f'CREATE TABLE IF NOT EXISTS "{table_name}"', f'CREATE TABLE "{shadow_table}"', 1
        )

        aux_sql_rows = conn.execute(
            text(
                "SELECT type, sql FROM sqlite_master WHERE tbl_name = :table_name "
                "AND type IN ('index', 'trigger') AND sql IS NOT NULL"
            ),
            {"table_name": table_name},
        ).fetchall()

        conn.execute(text(create_shadow_sql))
        conn.execute(text(f"INSERT INTO {shadow_table} SELECT * FROM {table_name}"))
        conn.execute(text(f"DROP TABLE {table_name}"))
        conn.execute(text(f"ALTER TABLE {shadow_table} RENAME TO {table_name}"))

        for _, aux_sql in aux_sql_rows:
            conn.execute(text(str(aux_sql)))


def _sqlite_has_items_legacy_references(conn) -> bool:
    count = conn.execute(
        text("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND sql LIKE :pattern"),
        {"pattern": f"%{DbTables.ITEMS}__legacy%"},
    ).scalar_one()
    return bool(count)


def _repair_sqlite_items_legacy_references(conn) -> None:
    if not _sqlite_has_items_legacy_references(conn):
        return
    conn.execute(text("PRAGMA foreign_keys = OFF"))
    try:
        _sqlite_rebuild_tables_referencing_legacy_items(conn)
    finally:
        conn.execute(text("PRAGMA foreign_keys = ON"))


def _migrate_sqlite_reminder_items_add_completed_state(conn) -> None:
    conn.execute(text("PRAGMA foreign_keys = OFF"))
    try:
        conn.execute(
            text(
                f"ALTER TABLE {DbTables.REMINDER_ITEMS} RENAME TO {DbTables.REMINDER_ITEMS}__legacy"
            )
        )
        conn.execute(
            text(
                f"""
                CREATE TABLE {DbTables.REMINDER_ITEMS} (
                    item_id TEXT PRIMARY KEY,
                    remind_at TEXT NOT NULL,
                    state TEXT NOT NULL DEFAULT 'scheduled',
                    alert_policy TEXT,
                    last_fired_at TEXT,
                    acked_at TEXT,
                    snoozed_until TEXT,
                    FOREIGN KEY (item_id) REFERENCES {DbTables.ITEMS}(id) ON DELETE CASCADE,
                    CHECK (state IN ('scheduled', 'fired', 'acked', 'missed', 'cancelled', 'snoozed', 'completed'))
                )
                """
            )
        )
        conn.execute(
            text(
                f"""
                INSERT INTO {DbTables.REMINDER_ITEMS} (
                    item_id, remind_at, state, alert_policy, last_fired_at, acked_at, snoozed_until
                )
                SELECT
                    item_id,
                    remind_at,
                    CASE
                        WHEN state IN ('scheduled', 'fired', 'acked', 'missed', 'cancelled', 'snoozed', 'completed')
                        THEN state
                        ELSE 'scheduled'
                    END AS state,
                    alert_policy,
                    last_fired_at,
                    acked_at,
                    snoozed_until
                FROM {DbTables.REMINDER_ITEMS}__legacy
                """
            )
        )
        conn.execute(text(f"DROP TABLE {DbTables.REMINDER_ITEMS}__legacy"))
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
            if not _sqlite_reminder_items_allows_completed_state(conn):
                _migrate_sqlite_reminder_items_add_completed_state(conn)
            _repair_sqlite_items_legacy_references(conn)
        for statement in SCHEMA_SQL.split(";\n\n"):
            sql = statement.strip()
            if not sql:
                continue
            conn.execute(text(sql))
