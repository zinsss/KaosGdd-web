from __future__ import annotations

import sqlite3

from sqlalchemy import create_engine, text

from app.db.schema_v0 import init_schema_v0


def test_init_schema_migrates_items_check_to_include_event(tmp_path) -> None:
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
        db.execute(
            text(
                """
                INSERT INTO items(id, item_type, title, status, created_at, updated_at)
                VALUES ('evt-1', 'event', 'migrated event', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
                """
            )
        )
