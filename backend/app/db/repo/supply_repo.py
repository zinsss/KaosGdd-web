import json
from sqlalchemy import text
from datetime import datetime, timedelta, timezone

from app.config import DbTables
from app.utils.clock import now_iso
from app.utils.ids import new_id


class SupplyRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_supply(self, item_id: str, normalized_title: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {supply_items}(item_id, normalized_title, done_at)
                    VALUES (:item_id, :normalized_title, NULL)
                    """.format(supply_items=DbTables.SUPPLY_ITEMS)
                ),
                {"item_id": item_id, "normalized_title": normalized_title},
            )

    def get_active_by_normalized_title(self, normalized_title: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id, i.title, i.created_at
                    FROM {items} i
                    JOIN {supply_items} s ON i.id = s.item_id
                    WHERE i.item_type = 'supply'
                      AND i.status = 'active'
                      AND s.done_at IS NULL
                      AND s.normalized_title = :normalized_title
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, supply_items=DbTables.SUPPLY_ITEMS)
                ),
                {"normalized_title": normalized_title},
            ).mappings().first()
        return dict(row) if row else None

    def list_active(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id, i.title, i.created_at, i.updated_at, s.done_at
                    FROM {items} i
                    JOIN {supply_items} s ON i.id = s.item_id
                    WHERE i.item_type = 'supply'
                      AND i.status = 'active'
                      AND s.done_at IS NULL
                    ORDER BY i.created_at ASC
                    """.format(items=DbTables.ITEMS, supply_items=DbTables.SUPPLY_ITEMS)
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_done(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id, i.title, i.created_at, i.updated_at, s.done_at
                    FROM {items} i
                    JOIN {supply_items} s ON i.id = s.item_id
                    WHERE i.item_type = 'supply'
                      AND i.status = 'active'
                      AND s.done_at IS NOT NULL
                    ORDER BY s.done_at DESC, i.updated_at DESC
                    """.format(items=DbTables.ITEMS, supply_items=DbTables.SUPPLY_ITEMS)
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def mark_done(self, item_id: str) -> bool:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE {supply_items}
                    SET done_at = :done_at
                    WHERE item_id = :item_id
                      AND done_at IS NULL
                    """.format(supply_items=DbTables.SUPPLY_ITEMS)
                ),
                {"item_id": item_id, "done_at": now},
            )
            if result.rowcount:
                conn.execute(
                    text(
                        "UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id AND item_type = 'supply'".format(
                            items=DbTables.ITEMS
                        )
                    ),
                    {"item_id": item_id, "updated_at": now},
                )
        return bool(result.rowcount)

    def hard_delete(self, item_id: str) -> bool:
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    DELETE FROM {items}
                    WHERE id = :item_id
                      AND item_type = 'supply'
                    """.format(items=DbTables.ITEMS)
                ),
                {"item_id": item_id},
            )
        return bool(result.rowcount)

    def get_supply_snapshot(self, item_id: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id, i.title, i.status, i.created_at, i.updated_at, i.archived_at, i.deleted_at,
                           s.normalized_title, s.done_at
                    FROM {items} i
                    JOIN {supply_items} s ON i.id = s.item_id
                    WHERE i.item_type = 'supply'
                      AND i.id = :item_id
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, supply_items=DbTables.SUPPLY_ITEMS)
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def restore_supply_snapshot(self, snapshot: dict) -> bool:
        now = now_iso()
        with self.engine.begin() as conn:
            existing = conn.execute(
                text("SELECT id FROM {items} WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": snapshot.get("id")},
            ).mappings().first()
            if existing:
                conn.execute(
                    text(
                        """
                        UPDATE {items}
                        SET title = :title, status = :status, archived_at = :archived_at,
                            deleted_at = :deleted_at, updated_at = :updated_at
                        WHERE id = :item_id AND item_type = 'supply'
                        """.format(items=DbTables.ITEMS)
                    ),
                    {
                        "item_id": snapshot.get("id"),
                        "title": snapshot.get("title") or "",
                        "status": snapshot.get("status") or "active",
                        "archived_at": snapshot.get("archived_at"),
                        "deleted_at": snapshot.get("deleted_at"),
                        "updated_at": now,
                    },
                )
            else:
                conn.execute(
                    text(
                        """
                        INSERT INTO {items}(id, item_type, title, status, created_at, updated_at, archived_at, deleted_at)
                        VALUES (:item_id, 'supply', :title, :status, :created_at, :updated_at, :archived_at, :deleted_at)
                        """.format(items=DbTables.ITEMS)
                    ),
                    {
                        "item_id": snapshot.get("id"),
                        "title": snapshot.get("title") or "",
                        "status": snapshot.get("status") or "active",
                        "created_at": snapshot.get("created_at") or now,
                        "updated_at": now,
                        "archived_at": snapshot.get("archived_at"),
                        "deleted_at": snapshot.get("deleted_at"),
                    },
                )
            conn.execute(
                text(
                    """
                    INSERT INTO {supply_items}(item_id, normalized_title, done_at)
                    VALUES (:item_id, :normalized_title, :done_at)
                    ON CONFLICT(item_id) DO UPDATE SET
                        normalized_title = excluded.normalized_title,
                        done_at = excluded.done_at
                    """.format(supply_items=DbTables.SUPPLY_ITEMS)
                ),
                {
                    "item_id": snapshot.get("id"),
                    "normalized_title": snapshot.get("normalized_title") or self._normalize_title(snapshot.get("title") or ""),
                    "done_at": snapshot.get("done_at"),
                },
            )
        return True

    def record_undo(self, *, action: str, supply_id: str, previous_state: dict | None, ttl_seconds: int = 15) -> dict:
        token = new_id()
        created_at = now_iso()
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat(timespec="microseconds")
        previous_state_json = json.dumps(previous_state, sort_keys=True) if previous_state is not None else None
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {supply_undo_log}
                    SET invalidated_at = :invalidated_at
                    WHERE used_at IS NULL AND invalidated_at IS NULL
                    """.format(supply_undo_log=DbTables.SUPPLY_UNDO_LOG)
                ),
                {"invalidated_at": created_at},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO {supply_undo_log}(
                        token, action, supply_id, previous_state_json, created_at, expires_at, used_at, invalidated_at
                    ) VALUES (
                        :token, :action, :supply_id, :previous_state_json, :created_at, :expires_at, NULL, NULL
                    )
                    """.format(supply_undo_log=DbTables.SUPPLY_UNDO_LOG)
                ),
                {
                    "token": token,
                    "action": action,
                    "supply_id": supply_id,
                    "previous_state_json": previous_state_json,
                    "created_at": created_at,
                    "expires_at": expires_at,
                },
            )
        return {"undo_token": token, "action": action, "supply_id": supply_id, "expires_at": expires_at}

    def get_undo(self, token: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT token, action, supply_id, previous_state_json, created_at, expires_at, used_at, invalidated_at
                    FROM {supply_undo_log}
                    WHERE token = :token
                    LIMIT 1
                    """.format(supply_undo_log=DbTables.SUPPLY_UNDO_LOG)
                ),
                {"token": token},
            ).mappings().first()
        if not row:
            return None
        item = dict(row)
        item["previous_state"] = json.loads(item["previous_state_json"]) if item.get("previous_state_json") else None
        return item

    def mark_undo_used(self, token: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text("UPDATE {supply_undo_log} SET used_at = :used_at WHERE token = :token".format(supply_undo_log=DbTables.SUPPLY_UNDO_LOG)),
                {"token": token, "used_at": now},
            )

    @staticmethod
    def _normalize_title(title: str) -> str:
        return " ".join(str(title or "").strip().lower().split())


    def list_presets(self, limit: int = 15):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT name, normalized_name, last_used_at
                    FROM {supply_presets}
                    ORDER BY last_used_at DESC
                    LIMIT :limit
                    """.format(supply_presets=DbTables.SUPPLY_PRESETS)
                ),
                {"limit": limit},
            ).mappings().all()
        return [dict(row) for row in rows]

    def touch_preset(self, name: str, normalized_name: str) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="microseconds")
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {supply_presets}(name, normalized_name, last_used_at)
                    VALUES (:name, :normalized_name, :last_used_at)
                    ON CONFLICT(normalized_name) DO UPDATE SET
                        name = excluded.name,
                        last_used_at = excluded.last_used_at
                    """.format(supply_presets=DbTables.SUPPLY_PRESETS)
                ),
                {"name": name, "normalized_name": normalized_name, "last_used_at": now},
            )
            conn.execute(
                text(
                    """
                    DELETE FROM {supply_presets}
                    WHERE normalized_name IN (
                        SELECT normalized_name
                        FROM {supply_presets}
                        ORDER BY last_used_at DESC
                        LIMIT -1 OFFSET 15
                    )
                    """.format(supply_presets=DbTables.SUPPLY_PRESETS)
                )
            )
