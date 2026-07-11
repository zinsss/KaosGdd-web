import os
import re

from sqlalchemy import text

from app.config import DbTables

SCHEMA_SQL = """
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
    CHECK (item_type IN ('task', 'reminder', 'event', 'journal', 'note', 'file', 'supply', 'fax')),
    CHECK (status IN ('active', 'removed', 'archived'))
);

CREATE TABLE IF NOT EXISTS {task_items} (
    item_id TEXT PRIMARY KEY,
    due_at TEXT,
    memo TEXT,
    is_done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    recurrence_group_id TEXT,
    recurrence_sequence INTEGER,
    recurrence_parent_id TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE,
    FOREIGN KEY (recurrence_parent_id) REFERENCES {task_items}(item_id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS {task_recurrence_history} (
    id TEXT PRIMARY KEY,
    recurrence_group_id TEXT NOT NULL,
    edited_at TEXT NOT NULL,
    edited_task_id TEXT NOT NULL,
    edit_scope TEXT NOT NULL,
    previous_values_json TEXT NOT NULL,
    new_values_json TEXT NOT NULL,
    affected_future_count INTEGER NOT NULL DEFAULT 0,
    affected_task_ids_json TEXT NOT NULL,
    FOREIGN KEY (edited_task_id) REFERENCES {task_items}(item_id) ON DELETE CASCADE,
    CHECK (edit_scope IN ('this_and_future'))
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

CREATE TABLE IF NOT EXISTS {fax_items} (
    item_id TEXT PRIMARY KEY,
    direction TEXT NOT NULL,
    fax_status TEXT NOT NULL,
    remote_number TEXT,
    local_device TEXT,
    original_filename TEXT,
    original_mime_type TEXT,
    pdf_file_path TEXT,
    source_file_path TEXT,
    saved_file_id TEXT,
    received_at TEXT,
    sent_at TEXT,
    failed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (item_id) REFERENCES {items}(id) ON DELETE CASCADE,
    FOREIGN KEY (saved_file_id) REFERENCES {items}(id) ON DELETE SET NULL,
    CHECK (direction IN ('incoming', 'outgoing')),
    CHECK (fax_status IN ('received', 'queued', 'sending', 'sent', 'failed', 'conversion_failed'))
);

CREATE TABLE IF NOT EXISTS {reminder_items} (
    item_id TEXT PRIMARY KEY,
    remind_at TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'scheduled',
    alert_policy TEXT,
    relative_token TEXT,
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

CREATE TABLE IF NOT EXISTS {notification_preferences} (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'pushover_primary',
    updated_at TEXT NOT NULL,
    CHECK (id = 'default'),
    CHECK (mode IN ('pushover_primary', 'web_push_only', 'pushover_only'))
);

CREATE TABLE IF NOT EXISTS {scribbles} (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS {weather_locations} (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    provider TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {weather_cache} (
    location_id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES {weather_locations}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {family_records} (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    record_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (namespace, record_key)
);

CREATE TABLE IF NOT EXISTS {family_notes} (
    id TEXT PRIMARY KEY,
    note_type TEXT NOT NULL DEFAULT 'message',
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    checklist_json TEXT NOT NULL DEFAULT '[]',
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (note_type IN ('message', 'checklist'))
);

CREATE TABLE IF NOT EXISTS {family_tasks} (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT '😄 보통',
    assignee TEXT NOT NULL DEFAULT '내 할 일',
    is_done INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    shared_with_main INTEGER NOT NULL DEFAULT 0,
    main_item_id TEXT,
    adopted_from_main INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (is_done IN (0, 1)),
    CHECK (shared_with_main IN (0, 1)),
    CHECK (adopted_from_main IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {family_events} (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    end_date TEXT,
    all_day INTEGER NOT NULL DEFAULT 1,
    start_at TEXT NOT NULL DEFAULT '',
    end_at TEXT NOT NULL DEFAULT '',
    memo TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'pink',
    priority TEXT NOT NULL DEFAULT '',
    shared_with_main INTEGER NOT NULL DEFAULT 0,
    main_item_id TEXT,
    adopted_from_main INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (all_day IN (0, 1)),
    CHECK (shared_with_main IN (0, 1)),
    CHECK (adopted_from_main IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {family_timetables} (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {family_timetable_entries} (
    id TEXT PRIMARY KEY,
    timetable_id TEXT NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'template',
    title TEXT NOT NULL,
    weekday INTEGER NOT NULL DEFAULT 1,
    start_time TEXT NOT NULL DEFAULT '09:00',
    end_time TEXT NOT NULL DEFAULT '09:40',
    color TEXT NOT NULL DEFAULT 'pink',
    font_family TEXT NOT NULL DEFAULT 'system',
    memo TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (timetable_id) REFERENCES {family_timetables}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {family_timetable_history} (
    id TEXT PRIMARY KEY,
    timetable_id TEXT NOT NULL,
    applied_from TEXT NOT NULL,
    applied_until TEXT,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (timetable_id) REFERENCES {family_timetables}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {family_calendar} (
    id TEXT PRIMARY KEY,
    state_key TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS {family_caregiver_days} (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    hourly_rate INTEGER NOT NULL DEFAULT 0,
    transport_fee INTEGER NOT NULL DEFAULT 0,
    extra_amount INTEGER NOT NULL DEFAULT 0,
    memo TEXT NOT NULL DEFAULT '',
    total_hours REAL NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS {family_caregiver_sessions} (
    id TEXT PRIMARY KEY,
    caregiver_day_id TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '',
    end_time TEXT NOT NULL DEFAULT '',
    hours REAL NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (caregiver_day_id) REFERENCES {family_caregiver_days}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS {family_settings} (
    setting_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL DEFAULT '{{}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS {family_main_links} (
    id TEXT PRIMARY KEY,
    family_kind TEXT NOT NULL,
    family_item_id TEXT NOT NULL,
    main_item_id TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'family',
    adopted_from_main INTEGER NOT NULL DEFAULT 0,
    shared_with_main INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (family_kind, family_item_id, main_item_id),
    CHECK (adopted_from_main IN (0, 1)),
    CHECK (shared_with_main IN (0, 1))
);

CREATE TABLE IF NOT EXISTS {weather_daily_snapshots} (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    location_label TEXT NOT NULL,
    date TEXT NOT NULL,
    condition_bucket TEXT NOT NULL,
    weather_glyph TEXT NOT NULL,
    weather_code INTEGER NOT NULL,
    min_c INTEGER NOT NULL,
    max_c INTEGER NOT NULL,
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (location_id, date)
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

CREATE INDEX IF NOT EXISTS idx_task_items_recurrence
ON {task_items}(recurrence_group_id, recurrence_sequence);

CREATE INDEX IF NOT EXISTS idx_task_recurrence_history_group_time
ON {task_recurrence_history}(recurrence_group_id, edited_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_fax_items_created
ON {items}(item_type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_fax_items_direction_status
ON {fax_items}(direction, fax_status);

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

CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated_at
ON {notification_preferences}(updated_at);

CREATE INDEX IF NOT EXISTS idx_scribbles_sort_order
ON {scribbles}(sort_order DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scribbles_updated_at
ON {scribbles}(updated_at);

CREATE INDEX IF NOT EXISTS idx_weather_locations_enabled_order
ON {weather_locations}(enabled, display_order);

CREATE INDEX IF NOT EXISTS idx_weather_cache_expires
ON {weather_cache}(expires_at);

CREATE INDEX IF NOT EXISTS idx_family_records_namespace_key
ON {family_records}(namespace, record_key);

CREATE INDEX IF NOT EXISTS idx_family_notes_deleted_order
ON {family_notes}(deleted_at, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_family_tasks_done_due
ON {family_tasks}(deleted_at, is_done, due_date, sort_order);

CREATE INDEX IF NOT EXISTS idx_family_tasks_main_item
ON {family_tasks}(main_item_id);

CREATE INDEX IF NOT EXISTS idx_family_events_date
ON {family_events}(deleted_at, event_date, end_date);

CREATE INDEX IF NOT EXISTS idx_family_events_main_item
ON {family_events}(main_item_id);

CREATE INDEX IF NOT EXISTS idx_family_timetable_entries_plan
ON {family_timetable_entries}(timetable_id, deleted_at, weekday, start_time);

CREATE INDEX IF NOT EXISTS idx_family_timetable_application_start
ON {family_timetable_history}(deleted_at, applied_from);

CREATE INDEX IF NOT EXISTS idx_family_caregiver_sessions_day
ON {family_caregiver_sessions}(caregiver_day_id, deleted_at, sort_order);

CREATE INDEX IF NOT EXISTS idx_family_main_links_main
ON {family_main_links}(main_item_id);

CREATE INDEX IF NOT EXISTS idx_weather_daily_snapshots_location_date
ON {weather_daily_snapshots}(location_id, date);

CREATE INDEX IF NOT EXISTS idx_weather_daily_snapshots_location_fetched
ON {weather_daily_snapshots}(location_id, fetched_at);

""".format(
    items=DbTables.ITEMS,
    task_items=DbTables.TASK_ITEMS,
    task_subtasks=DbTables.TASK_SUBTASKS,
    task_recurrence_history=DbTables.TASK_RECURRENCE_HISTORY,
    reminder_items=DbTables.REMINDER_ITEMS,
    supply_items=DbTables.SUPPLY_ITEMS,
    supply_presets=DbTables.SUPPLY_PRESETS,
    event_items=DbTables.EVENT_ITEMS,
    journal_items=DbTables.JOURNAL_ITEMS,
    note_items=DbTables.NOTE_ITEMS,
    file_items=DbTables.FILE_ITEMS,
    fax_items=DbTables.FAX_ITEMS,
    reminder_events=DbTables.REMINDER_EVENTS,
    item_reminders=DbTables.ITEM_REMINDERS,
    item_tags=DbTables.ITEM_TAGS,
    item_links=DbTables.ITEM_LINKS,
    push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS,
    push_test_diagnostics=DbTables.PUSH_TEST_DIAGNOSTICS,
    push_task_overdue_state=DbTables.PUSH_TASK_OVERDUE_STATE,
    push_event_dedupe=DbTables.PUSH_EVENT_DEDUPE,
    notification_preferences=DbTables.NOTIFICATION_PREFERENCES,
    scribbles=DbTables.SCRIBBLES,
    weather_locations=DbTables.WEATHER_LOCATIONS,
    weather_cache=DbTables.WEATHER_CACHE,
    family_records=DbTables.FAMILY_RECORDS,
    family_notes=DbTables.FAMILY_NOTES,
    family_tasks=DbTables.FAMILY_TASKS,
    family_events=DbTables.FAMILY_EVENTS,
    family_timetables=DbTables.FAMILY_TIMETABLES,
    family_timetable_entries=DbTables.FAMILY_TIMETABLE_ENTRIES,
    family_timetable_history=DbTables.FAMILY_TIMETABLE_HISTORY,
    family_calendar=DbTables.FAMILY_CALENDAR,
    family_caregiver_days=DbTables.FAMILY_CAREGIVER_DAYS,
    family_caregiver_sessions=DbTables.FAMILY_CAREGIVER_SESSIONS,
    family_settings=DbTables.FAMILY_SETTINGS,
    family_main_links=DbTables.FAMILY_MAIN_LINKS,
    weather_daily_snapshots=DbTables.WEATHER_DAILY_SNAPSHOTS,
)


def _database_schema() -> str:
    schema = os.getenv("DATABASE_SCHEMA", "main").strip() or "main"
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", schema):
        raise ValueError("DATABASE_SCHEMA must be a simple SQL identifier")
    return schema


def _dialect_setup_statements(dialect_name: str) -> list[str]:
    if dialect_name == "sqlite":
        return ["PRAGMA foreign_keys = ON"]
    if dialect_name.startswith("postgresql"):
        schema = _database_schema()
        return [
            f"CREATE SCHEMA IF NOT EXISTS {schema}",
            f"SET search_path TO {schema}, public",
        ]
    return []


def _sqlite_items_table_allows_supported_types(conn) -> bool:
    row = conn.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": DbTables.ITEMS},
    ).fetchone()
    if not row or not row[0]:
        return True
    ddl = str(row[0]).lower()
    return (
        "'event'" in ddl
        and "'journal'" in ddl
        and "'note'" in ddl
        and "'file'" in ddl
        and "'supply'" in ddl
        and "'fax'" in ddl
    )


def _sqlite_reminder_items_allows_completed_state(conn) -> bool:
    row = conn.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": DbTables.REMINDER_ITEMS},
    ).fetchone()
    if not row or not row[0]:
        return True
    ddl = str(row[0]).lower()
    return "'completed'" in ddl


def _sqlite_notification_preferences_allows_pushover_primary(conn) -> bool:
    row = conn.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": DbTables.NOTIFICATION_PREFERENCES},
    ).fetchone()
    if not row or not row[0]:
        return True
    ddl = str(row[0]).lower()
    return "'pushover_primary'" in ddl


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
                    CHECK (item_type IN ('task', 'reminder', 'event', 'journal', 'note', 'file', 'supply', 'fax')),
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
                    relative_token TEXT,
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
                    item_id, remind_at, state, alert_policy, relative_token, last_fired_at, acked_at, snoozed_until
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
                    NULL AS relative_token,
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


def _migrate_sqlite_notification_preferences_add_pushover_primary(conn) -> None:
    conn.execute(text("PRAGMA foreign_keys = OFF"))
    try:
        conn.execute(
            text(
                f"ALTER TABLE {DbTables.NOTIFICATION_PREFERENCES} "
                f"RENAME TO {DbTables.NOTIFICATION_PREFERENCES}__legacy"
            )
        )
        conn.execute(
            text(
                f"""
                CREATE TABLE {DbTables.NOTIFICATION_PREFERENCES} (
                    id TEXT PRIMARY KEY,
                    mode TEXT NOT NULL DEFAULT 'pushover_primary',
                    updated_at TEXT NOT NULL,
                    CHECK (id = 'default'),
                    CHECK (mode IN ('pushover_primary', 'web_push_only', 'pushover_only'))
                )
                """
            )
        )
        conn.execute(
            text(
                f"""
                INSERT INTO {DbTables.NOTIFICATION_PREFERENCES}(id, mode, updated_at)
                SELECT
                    id,
                    CASE
                        WHEN mode = 'hybrid' THEN 'pushover_primary'
                        WHEN mode IN ('pushover_primary', 'web_push_only', 'pushover_only') THEN mode
                        ELSE 'pushover_primary'
                    END AS mode,
                    updated_at
                FROM {DbTables.NOTIFICATION_PREFERENCES}__legacy
                """
            )
        )
        conn.execute(text(f"DROP TABLE {DbTables.NOTIFICATION_PREFERENCES}__legacy"))
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
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "recurrence_group_id TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "recurrence_sequence INTEGER")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_ITEMS, "recurrence_parent_id TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "position INTEGER NOT NULL DEFAULT 0")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "is_done INTEGER NOT NULL DEFAULT 0")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "done_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "removed_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "created_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.TASK_SUBTASKS, "updated_at TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "state TEXT NOT NULL DEFAULT 'scheduled'")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "alert_policy TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "relative_token TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "last_fired_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "acked_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.REMINDER_ITEMS, "snoozed_until TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.FILE_ITEMS, "memo TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.FILE_ITEMS, "fax_number TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.FAX_ITEMS, "saved_file_id TEXT")

    _sqlite_add_column_if_missing(conn, DbTables.ITEM_REMINDERS, "created_at TEXT")
    _sqlite_add_column_if_missing(conn, DbTables.SCRIBBLES, "tags_json TEXT NOT NULL DEFAULT '[]'")


def _migrate_sqlite_scribbles_to_cards(conn) -> None:
    columns = _sqlite_table_columns(conn, DbTables.SCRIBBLES)
    if not columns or {"id", "created_at", "sort_order"}.issubset(columns):
        return
    conn.execute(text(f"DROP TABLE {DbTables.SCRIBBLES}"))


def init_schema_v0(engine) -> None:
    with engine.begin() as conn:
        dialect_name = engine.dialect.name
        for setup_sql in _dialect_setup_statements(dialect_name):
            conn.execute(text(setup_sql))
        if dialect_name == "sqlite" and not _sqlite_items_table_allows_supported_types(conn):
            _migrate_sqlite_items_table_add_supported_types(conn)
        if dialect_name == "sqlite":
            _migrate_sqlite_legacy_task_reminder_tables(conn)
            if not _sqlite_reminder_items_allows_completed_state(conn):
                _migrate_sqlite_reminder_items_add_completed_state(conn)
            if not _sqlite_notification_preferences_allows_pushover_primary(conn):
                _migrate_sqlite_notification_preferences_add_pushover_primary(conn)
            _repair_sqlite_items_legacy_references(conn)
            _migrate_sqlite_scribbles_to_cards(conn)
        for statement in SCHEMA_SQL.split(";\n\n"):
            sql = statement.strip()
            if not sql:
                continue
            conn.execute(text(sql))
