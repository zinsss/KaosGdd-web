from __future__ import annotations

import sqlite3
import importlib
import os

from sqlalchemy import create_engine, text

from app.db.schema_v0 import init_schema_v0


def test_init_schema_migrates_items_check_to_include_event_and_journal(tmp_path) -> None:
    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE items (
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
        """
    )
    conn.commit()
    conn.close()

    engine = create_engine(f"sqlite:///{db_path}")
    init_schema_v0(engine)

    with engine.begin() as db:
        sql = db.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'")).scalar_one()
        assert "'event'" in sql
        assert "'journal'" in sql
        db.execute(
            text(
                """
                INSERT INTO items(id, item_type, title, status, created_at, updated_at)
                VALUES ('evt-1', 'event', 'migrated event', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
                """
            )
        )


def test_init_schema_rebuilds_items_children_after_sqlite_items_table_migration(tmp_path) -> None:
    db_path = tmp_path / "legacy-items-fk.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE items (
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

        CREATE TABLE item_tags (
            item_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (item_id, tag),
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE TABLE item_links (
            source_item_id TEXT NOT NULL,
            target_item_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (source_item_id, target_item_id),
            FOREIGN KEY (source_item_id) REFERENCES items(id) ON DELETE CASCADE,
            FOREIGN KEY (target_item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE TABLE reminder_items (
            item_id TEXT PRIMARY KEY,
            remind_at TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'scheduled',
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE TABLE item_reminders (
            item_id TEXT NOT NULL,
            reminder_item_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (item_id, reminder_item_id),
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            FOREIGN KEY (reminder_item_id) REFERENCES reminder_items(item_id) ON DELETE CASCADE
        );

        INSERT INTO items(id, item_type, title, status, created_at, updated_at)
        VALUES ('task-1', 'task', 'legacy task', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

        INSERT INTO item_tags(item_id, tag, created_at)
        VALUES ('task-1', 'alpha', '2026-01-01T00:00:00Z');
        """
    )
    conn.commit()
    conn.close()

    engine = create_engine(f"sqlite:///{db_path}")
    init_schema_v0(engine)

    with engine.begin() as db:
        fk_tables = {
            row[2]
            for row in db.execute(text("PRAGMA foreign_key_list(item_tags)")).fetchall()
            if row[3] == "item_id"
        }
        assert fk_tables == {"items"}

        link_fk_tables = {
            row[2]
            for row in db.execute(text("PRAGMA foreign_key_list(item_links)")).fetchall()
            if row[3] in {"source_item_id", "target_item_id"}
        }
        assert link_fk_tables == {"items"}

        reminder_fk_tables = {
            (row[3], row[2]) for row in db.execute(text("PRAGMA foreign_key_list(item_reminders)")).fetchall()
        }
        assert ("item_id", "items") in reminder_fk_tables

        db.execute(text("DELETE FROM item_tags WHERE item_id = 'task-1'"))
        db.execute(
            text(
                """
                INSERT INTO item_tags(item_id, tag, created_at)
                VALUES ('task-1', 'beta', '2026-01-01T00:01:00Z')
                """
            )
        )
        tags = [row[0] for row in db.execute(text("SELECT tag FROM item_tags WHERE item_id='task-1'")).fetchall()]
        assert tags == ["beta"]


def test_init_schema_repairs_existing_sqlite_db_with_items_legacy_fk_references(tmp_path) -> None:
    db_path = tmp_path / "broken-items-legacy-fk.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        PRAGMA foreign_keys = OFF;

        CREATE TABLE items (
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

        CREATE TABLE item_tags (
            item_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (item_id, tag),
            FOREIGN KEY (item_id) REFERENCES items__legacy(id) ON DELETE CASCADE
        );

        INSERT INTO items(id, item_type, title, status, created_at, updated_at)
        VALUES ('task-1', 'task', 'still here', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

        PRAGMA foreign_keys = ON;
        """
    )
    conn.commit()
    conn.close()

    engine = create_engine(f"sqlite:///{db_path}")
    init_schema_v0(engine)

    with engine.begin() as db:
        fk_tables = {
            row[2]
            for row in db.execute(text("PRAGMA foreign_key_list(item_tags)")).fetchall()
            if row[3] == "item_id"
        }
        assert fk_tables == {"items"}

        db.execute(
            text(
                """
                INSERT INTO item_tags(item_id, tag, created_at)
                VALUES ('task-1', 'restored', '2026-01-01T00:01:00Z')
                """
            )
        )
        tags = [row[0] for row in db.execute(text("SELECT tag FROM item_tags")).fetchall()]
        assert tags == ["restored"]


def test_init_schema_migrates_legacy_task_reminder_tables_for_multiline_capture(tmp_path) -> None:
    db_path = tmp_path / "legacy-capture.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE items (
            id TEXT PRIMARY KEY,
            item_type TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            archived_at TEXT,
            deleted_at TEXT,
            CHECK (item_type IN ('task', 'reminder', 'event', 'journal')),
            CHECK (status IN ('active', 'removed', 'archived'))
        );

        CREATE TABLE task_items (
            item_id TEXT PRIMARY KEY,
            due_at TEXT,
            memo TEXT,
            is_done INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE TABLE task_subtasks (
            id TEXT PRIMARY KEY,
            task_item_id TEXT NOT NULL,
            content TEXT NOT NULL,
            position INTEGER NOT NULL,
            is_done INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (task_item_id) REFERENCES task_items(item_id) ON DELETE CASCADE
        );

        CREATE TABLE reminder_items (
            item_id TEXT PRIMARY KEY,
            remind_at TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'scheduled',
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE TABLE item_reminders (
            item_id TEXT NOT NULL,
            reminder_item_id TEXT NOT NULL,
            PRIMARY KEY (item_id, reminder_item_id)
        );

        CREATE TABLE item_tags (
            item_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (item_id, tag)
        );
        """
    )
    conn.commit()
    conn.close()

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)

    raw = '-- 테스팅 테스팅\nd:2026-04-29 13:40\nr:2026-04-30 13:40\n--- something must be done\n--- 귀찮아\n"""\n아이고!!!\n"""'
    payload = main_module.capture_item({"raw": raw})
    assert payload["ok"] is True
    assert payload["kind"] == "task"

    detail = main_module.get_task(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "테스팅 테스팅"
    assert detail["item"]["due_at"] == "2026-04-29T04:40:00+00:00"
    assert len(detail["item"]["subtasks"]) == 2
    assert {subtask["content"] for subtask in detail["item"]["subtasks"]} == {"something must be done", "귀찮아"}
    assert len(detail["item"]["reminders"]) == 1
    assert detail["item"]["reminders"][0]["remind_at"] == "2026-04-30T04:40:00+00:00"


def test_init_schema_migrates_reminder_state_check_to_allow_completed(tmp_path) -> None:
    db_path = tmp_path / "legacy-reminder-state.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE items (
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

        CREATE TABLE reminder_items (
            item_id TEXT PRIMARY KEY,
            remind_at TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'scheduled',
            alert_policy TEXT,
            last_fired_at TEXT,
            acked_at TEXT,
            snoozed_until TEXT,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            CHECK (state IN ('scheduled', 'fired', 'acked', 'missed', 'cancelled', 'snoozed'))
        );

        INSERT INTO items(id, item_type, title, status, created_at, updated_at)
        VALUES ('rem-1', 'reminder', 'legacy reminder', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

        INSERT INTO reminder_items(item_id, remind_at, state)
        VALUES ('rem-1', '2026-01-02T00:00:00Z', 'scheduled');
        """
    )
    conn.commit()
    conn.close()

    engine = create_engine(f"sqlite:///{db_path}")
    init_schema_v0(engine)

    with engine.begin() as db:
        sql = db.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='reminder_items'")).scalar_one()
        assert "'completed'" in sql
        db.execute(text("UPDATE reminder_items SET state='completed' WHERE item_id='rem-1'"))
        state = db.execute(text("SELECT state FROM reminder_items WHERE item_id='rem-1'")).scalar_one()
        assert state == "completed"
