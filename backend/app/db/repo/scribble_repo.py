from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso
from app.utils.ids import new_id
from app.utils.timefmt import format_dt_for_ui


class ScribbleRepo:
    """Persistence for transient scratch/workspace objects, not canonical journal items."""

    def __init__(self, engine) -> None:
        self.engine = engine

    @staticmethod
    def _decorate_scribble(row: dict) -> dict:
        item = dict(row)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        return item

    def list_scribbles(self) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, body, created_at, updated_at, sort_order
                    FROM {scribbles}
                    ORDER BY sort_order DESC, created_at DESC
                    """.format(scribbles=DbTables.SCRIBBLES)
                )
            ).mappings().all()
        return [self._decorate_scribble(row) for row in rows]

    def create_scribble(self, *, body: str) -> dict:
        now = now_iso()
        scribble_id = new_id()
        with self.engine.begin() as conn:
            next_sort_order = conn.execute(
                text(
                    """
                    SELECT COALESCE(MAX(sort_order), 0) + 1
                    FROM {scribbles}
                    """.format(scribbles=DbTables.SCRIBBLES)
                )
            ).scalar_one()
            conn.execute(
                text(
                    """
                    INSERT INTO {scribbles}(id, body, created_at, updated_at, sort_order)
                    VALUES (:id, :body, :created_at, :updated_at, :sort_order)
                    """.format(scribbles=DbTables.SCRIBBLES)
                ),
                {
                    "id": scribble_id,
                    "body": body,
                    "created_at": now,
                    "updated_at": now,
                    "sort_order": next_sort_order,
                },
            )
        return self._decorate_scribble(
            {
                "id": scribble_id,
                "body": body,
                "created_at": now,
                "updated_at": now,
                "sort_order": next_sort_order,
            }
        )

    def update_scribble(self, scribble_id: str, *, body: str) -> dict | None:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE {scribbles}
                    SET body = :body,
                        updated_at = :updated_at
                    WHERE id = :id
                    """.format(scribbles=DbTables.SCRIBBLES)
                ),
                {"id": scribble_id, "body": body, "updated_at": now},
            )
            if result.rowcount == 0:
                return None
            row = conn.execute(
                text(
                    """
                    SELECT id, body, created_at, updated_at, sort_order
                    FROM {scribbles}
                    WHERE id = :id
                    LIMIT 1
                    """.format(scribbles=DbTables.SCRIBBLES)
                ),
                {"id": scribble_id},
            ).mappings().first()
        return self._decorate_scribble(row) if row else None

    def delete_scribble(self, scribble_id: str) -> bool:
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    DELETE FROM {scribbles}
                    WHERE id = :id
                    """.format(scribbles=DbTables.SCRIBBLES)
                ),
                {"id": scribble_id},
            )
        return result.rowcount > 0
