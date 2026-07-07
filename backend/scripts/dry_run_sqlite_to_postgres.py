#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text

from app.config import DbTables
from app.db.schema_v0 import init_schema_v0


COPY_TABLES = [
    DbTables.ITEMS,
    DbTables.TASK_ITEMS,
    DbTables.SUPPLY_ITEMS,
    DbTables.SUPPLY_PRESETS,
    DbTables.TASK_SUBTASKS,
    DbTables.TASK_RECURRENCE_HISTORY,
    DbTables.EVENT_ITEMS,
    DbTables.JOURNAL_ITEMS,
    DbTables.NOTE_ITEMS,
    DbTables.FILE_ITEMS,
    DbTables.FAX_ITEMS,
    DbTables.REMINDER_ITEMS,
    DbTables.PUSH_SUBSCRIPTIONS,
    DbTables.PUSH_TEST_DIAGNOSTICS,
    DbTables.PUSH_TASK_OVERDUE_STATE,
    DbTables.PUSH_EVENT_DEDUPE,
    DbTables.NOTIFICATION_PREFERENCES,
    DbTables.SCRIBBLES,
    DbTables.WEATHER_LOCATIONS,
    DbTables.WEATHER_CACHE,
    DbTables.WEATHER_DAILY_SNAPSHOTS,
    DbTables.REMINDER_EVENTS,
    DbTables.ITEM_REMINDERS,
    DbTables.ITEM_TAGS,
    DbTables.ITEM_LINKS,
]

ORPHAN_ITEM_TABLES = {
    DbTables.TASK_ITEMS: "task",
    DbTables.SUPPLY_ITEMS: "supply",
    DbTables.EVENT_ITEMS: "event",
    DbTables.JOURNAL_ITEMS: "journal",
    DbTables.NOTE_ITEMS: "note",
    DbTables.FILE_ITEMS: "file",
    DbTables.FAX_ITEMS: "fax",
    DbTables.REMINDER_ITEMS: "reminder",
}


def quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def sqlite_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {str(row[0]) for row in rows}


def sqlite_columns(conn: sqlite3.Connection, table_name: str) -> list[str]:
    rows = conn.execute(f"PRAGMA table_info({quote_identifier(table_name)})").fetchall()
    return [str(row[1]) for row in rows]


def sqlite_count(conn: sqlite3.Connection, table_name: str) -> int:
    return int(conn.execute(f"SELECT COUNT(*) FROM {quote_identifier(table_name)}").fetchone()[0])


def postgres_tables(pg_conn) -> set[str]:
    rows = pg_conn.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            """
        )
    ).fetchall()
    return {str(row[0]) for row in rows}


def postgres_columns(pg_conn, table_name: str) -> set[str]:
    rows = pg_conn.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :table_name
            """
        ),
        {"table_name": table_name},
    ).fetchall()
    return {str(row[0]) for row in rows}


def postgres_count(pg_conn, table_name: str) -> int:
    return int(pg_conn.execute(text(f"SELECT COUNT(*) FROM {quote_identifier(table_name)}")).scalar_one())


def copy_table(sqlite_conn: sqlite3.Connection, pg_conn, table_name: str) -> int:
    columns = sqlite_columns(sqlite_conn, table_name)
    target_columns = postgres_columns(pg_conn, table_name)
    missing_columns = [column for column in columns if column not in target_columns]
    if missing_columns:
        raise RuntimeError(f"{table_name}: target is missing columns: {', '.join(missing_columns)}")

    if not columns:
        return 0

    quoted_table = quote_identifier(table_name)
    quoted_columns = ", ".join(quote_identifier(column) for column in columns)
    bind_columns = ", ".join(f":{column}" for column in columns)
    insert_sql = text(f"INSERT INTO {quoted_table} ({quoted_columns}) VALUES ({bind_columns})")

    sqlite_conn.row_factory = sqlite3.Row
    rows = sqlite_conn.execute(f"SELECT {quoted_columns} FROM {quoted_table}").fetchall()
    if not rows:
        return 0

    payload = [{column: row[column] for column in columns} for row in rows]
    pg_conn.execute(insert_sql, payload)
    return len(payload)


def first_present(row: sqlite3.Row, *keys: str) -> str:
    for key in keys:
        if key in row.keys() and row[key]:
            return str(row[key])
    return ""


def synthetic_title(table_name: str, row: sqlite3.Row) -> str:
    if table_name == DbTables.SUPPLY_ITEMS:
        return first_present(row, "normalized_title") or "Supply"
    if table_name == DbTables.FILE_ITEMS:
        return first_present(row, "original_filename", "stored_path") or "File"
    if table_name == DbTables.FAX_ITEMS:
        filename = first_present(row, "original_filename")
        remote = first_present(row, "remote_number")
        direction = first_present(row, "direction")
        suffix = filename or remote or first_present(row, "item_id")[:8]
        return " ".join(part for part in ["Fax", direction, suffix] if part)
    return first_present(row, "title", "item_id") or "Recovered item"


def synthetic_timestamp(table_name: str, row: sqlite3.Row, fallback: str) -> str:
    if table_name == DbTables.FAX_ITEMS:
        return first_present(row, "received_at", "sent_at", "failed_at") or fallback
    return fallback


def find_orphan_item_rows(sqlite_conn: sqlite3.Connection) -> list[dict[str, str]]:
    sqlite_conn.row_factory = sqlite3.Row
    orphan_rows: list[dict[str, str]] = []
    existing_item_ids = {
        str(row["id"])
        for row in sqlite_conn.execute(f"SELECT id FROM {quote_identifier(DbTables.ITEMS)}").fetchall()
    }
    source_tables = sqlite_tables(sqlite_conn)
    recovered_ids: set[str] = set()
    fallback_timestamp = datetime.now(UTC).replace(microsecond=0).isoformat()

    for table_name, item_type in ORPHAN_ITEM_TABLES.items():
        if table_name not in source_tables:
            continue
        for row in sqlite_conn.execute(f"SELECT * FROM {quote_identifier(table_name)}").fetchall():
            item_id = str(row["item_id"])
            if item_id in existing_item_ids or item_id in recovered_ids:
                continue
            created_at = synthetic_timestamp(table_name, row, fallback_timestamp)
            orphan_rows.append(
                {
                    "id": item_id,
                    "item_type": item_type,
                    "title": synthetic_title(table_name, row),
                    "status": "active",
                    "created_at": created_at,
                    "updated_at": created_at,
                    "archived_at": None,
                    "deleted_at": None,
                }
            )
            recovered_ids.add(item_id)

    return orphan_rows


def insert_synthetic_items(pg_conn, rows: list[dict[str, str]]) -> int:
    if not rows:
        return 0
    pg_conn.execute(
        text(
            """
            INSERT INTO items(id, item_type, title, status, created_at, updated_at, archived_at, deleted_at)
            VALUES (:id, :item_type, :title, :status, :created_at, :updated_at, :archived_at, :deleted_at)
            """
        ),
        rows,
    )
    return len(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run copy KaosGdd SQLite data into a disposable Postgres database and validate counts."
    )
    parser.add_argument("--sqlite-path", default="/data/kaosgdd.db", help="SQLite database path to read.")
    parser.add_argument(
        "--postgres-url",
        required=True,
        help="Disposable Postgres URL to initialize and load. Production URLs should not be used here.",
    )
    parser.add_argument(
        "--reset-target",
        action="store_true",
        help="Delete current rows from schema-owned target tables before copying.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sqlite_path = Path(args.sqlite_path)
    if not sqlite_path.exists():
        print(f"SQLite database not found: {sqlite_path}", file=sys.stderr)
        return 2
    if not args.postgres_url.startswith("postgresql"):
        print("--postgres-url must be a postgresql:// URL", file=sys.stderr)
        return 2

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    source_tables = sqlite_tables(sqlite_conn)

    pg_engine = create_engine(args.postgres_url)
    init_schema_v0(pg_engine)

    copied: list[tuple[str, int, int]] = []
    skipped = sorted(source_tables - set(COPY_TABLES))
    synthetic_items = find_orphan_item_rows(sqlite_conn)

    with pg_engine.begin() as pg_conn:
        target_tables = postgres_tables(pg_conn)
        missing_targets = [table for table in COPY_TABLES if table in source_tables and table not in target_tables]
        if missing_targets:
            raise RuntimeError(f"target schema missing tables: {', '.join(missing_targets)}")

        if args.reset_target:
            for table_name in reversed(COPY_TABLES):
                if table_name in target_tables:
                    pg_conn.execute(text(f"DELETE FROM {quote_identifier(table_name)}"))

        for table_name in COPY_TABLES:
            if table_name not in source_tables:
                continue
            source_count = sqlite_count(sqlite_conn, table_name)
            inserted_count = copy_table(sqlite_conn, pg_conn, table_name)
            if table_name == DbTables.ITEMS:
                inserted_count += insert_synthetic_items(pg_conn, synthetic_items)
            target_count = postgres_count(pg_conn, table_name)
            expected_count = source_count + len(synthetic_items) if table_name == DbTables.ITEMS else source_count
            copied.append((table_name, source_count, target_count))
            if inserted_count != expected_count or target_count != expected_count:
                raise RuntimeError(
                    f"{table_name}: source={source_count}, expected={expected_count}, "
                    f"inserted={inserted_count}, target={target_count}"
                )

    print("copy validation ok")
    if synthetic_items:
        print(f"synthetic parent items inserted\t{len(synthetic_items)}")
    for table_name, source_count, target_count in copied:
        print(f"{table_name}\t{source_count}\t{target_count}")
    if skipped:
        print("skipped source tables without current target schema:")
        for table_name in skipped:
            print(f"{table_name}\t{sqlite_count(sqlite_conn, table_name)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
