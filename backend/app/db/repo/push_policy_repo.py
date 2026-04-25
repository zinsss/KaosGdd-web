from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class PushPolicyRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def list_task_overdue_state(self) -> dict[str, dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT task_item_id, last_due_at, last_is_overdue, updated_at
                    FROM {table}
                    """.format(table=DbTables.PUSH_TASK_OVERDUE_STATE)
                )
            ).mappings().all()
        return {
            str(row["task_item_id"]): {
                "last_due_at": row.get("last_due_at"),
                "last_is_overdue": bool(row.get("last_is_overdue")),
                "updated_at": row.get("updated_at"),
            }
            for row in rows
        }

    def upsert_task_overdue_state(self, *, task_item_id: str, due_at: str | None, is_overdue: bool) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {table}(task_item_id, last_due_at, last_is_overdue, updated_at)
                    VALUES (:task_item_id, :last_due_at, :last_is_overdue, :updated_at)
                    ON CONFLICT(task_item_id) DO UPDATE SET
                        last_due_at = excluded.last_due_at,
                        last_is_overdue = excluded.last_is_overdue,
                        updated_at = excluded.updated_at
                    """.format(table=DbTables.PUSH_TASK_OVERDUE_STATE)
                ),
                {
                    "task_item_id": task_item_id,
                    "last_due_at": due_at,
                    "last_is_overdue": 1 if is_overdue else 0,
                    "updated_at": now_iso(),
                },
            )

    def record_event_once(self, *, event_key: str, event_type: str) -> bool:
        if not event_key:
            return False
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO {table}(event_key, event_type, created_at)
                    VALUES (:event_key, :event_type, :created_at)
                    """.format(table=DbTables.PUSH_EVENT_DEDUPE)
                ),
                {"event_key": event_key, "event_type": event_type, "created_at": now_iso()},
            )
        return bool(result.rowcount)
