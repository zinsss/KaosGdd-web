from sqlalchemy import text
from datetime import datetime, timezone

from app.config import DbTables
from app.utils.clock import now_iso


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
