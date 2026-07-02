from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso

NOTIFICATION_MODE_WEB_PUSH_ONLY = "web_push_only"
NOTIFICATION_MODE_PUSHOVER_ONLY = "pushover_only"
NOTIFICATION_MODE_PUSHOVER_PRIMARY = "pushover_primary"
LEGACY_NOTIFICATION_MODE_HYBRID = "hybrid"
NOTIFICATION_CHANNEL_NORMAL = "normal"
NOTIFICATION_CHANNEL_URGENT = "urgent"
NOTIFICATION_CHANNEL_SYSTEM = "system"
NOTIFICATION_SUPPORTED_MODES = [
    NOTIFICATION_MODE_PUSHOVER_PRIMARY,
    NOTIFICATION_MODE_WEB_PUSH_ONLY,
    NOTIFICATION_MODE_PUSHOVER_ONLY,
]
NOTIFICATION_MODES = set(NOTIFICATION_SUPPORTED_MODES)
LEGACY_NOTIFICATION_MODES = {
    LEGACY_NOTIFICATION_MODE_HYBRID,
}
NOTIFICATION_PUSHOVER_PRIMARY_WEB_PUSH_CHANNELS = {
    NOTIFICATION_CHANNEL_NORMAL,
}
DEFAULT_NOTIFICATION_MODE = NOTIFICATION_MODE_PUSHOVER_PRIMARY


def normalize_notification_mode(mode: str | None) -> str:
    clean_mode = str(mode or "").strip()
    if clean_mode == LEGACY_NOTIFICATION_MODE_HYBRID:
        return NOTIFICATION_MODE_PUSHOVER_PRIMARY
    if clean_mode in NOTIFICATION_MODES:
        return clean_mode
    return DEFAULT_NOTIFICATION_MODE

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
                    INSERT INTO {table}(event_key, event_type, created_at)
                    VALUES (:event_key, :event_type, :created_at)
                    ON CONFLICT(event_key) DO NOTHING
                    """.format(table=DbTables.PUSH_EVENT_DEDUPE)
                ),
                {"event_key": event_key, "event_type": event_type, "created_at": now_iso()},
            )
        return bool(result.rowcount)

    def get_notification_preferences(self) -> dict:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT mode, updated_at
                    FROM {table}
                    WHERE id = 'default'
                    LIMIT 1
                    """.format(table=DbTables.NOTIFICATION_PREFERENCES)
                )
            ).mappings().first()
        if not row:
            return {
                "mode": DEFAULT_NOTIFICATION_MODE,
                "updated_at": None,
            }
        mode = normalize_notification_mode(row.get("mode"))
        return {
            "mode": mode,
            "updated_at": row.get("updated_at"),
        }

    def set_notification_mode(self, mode: str) -> dict:
        clean_mode = str(mode or "").strip()
        if clean_mode not in NOTIFICATION_MODES:
            raise ValueError("invalid notification mode")

        updated_at = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {table}(id, mode, updated_at)
                    VALUES ('default', :mode, :updated_at)
                    ON CONFLICT(id) DO UPDATE SET
                        mode = excluded.mode,
                        updated_at = excluded.updated_at
                    """.format(table=DbTables.NOTIFICATION_PREFERENCES)
                ),
                {"mode": clean_mode, "updated_at": updated_at},
            )
        return {
            "mode": clean_mode,
            "updated_at": updated_at,
        }
