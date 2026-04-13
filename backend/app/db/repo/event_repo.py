from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class EventRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_event(self, item_id: str, *, start_date: str, end_date: str | None = None, memo: str | None = None) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {event_items}(item_id, start_date, end_date, memo)
                    VALUES (:item_id, :start_date, :end_date, :memo)
                    """.format(event_items=DbTables.EVENT_ITEMS)
                ),
                {"item_id": item_id, "start_date": start_date, "end_date": end_date, "memo": memo},
            )

    def get_event_detail(self, item_id: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.item_type,
                        i.title,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        e.start_date,
                        e.end_date,
                        e.memo
                    FROM {items} i
                    JOIN {event_items} e ON i.id = e.item_id
                    WHERE i.id = :item_id
                      AND i.item_type = 'event'
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, event_items=DbTables.EVENT_ITEMS)
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def update_event_fields(self, item_id: str, *, start_date: str, end_date: str | None, memo: str | None) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {event_items}
                    SET start_date = :start_date,
                        end_date = :end_date,
                        memo = :memo
                    WHERE item_id = :item_id
                    """.format(event_items=DbTables.EVENT_ITEMS)
                ),
                {"item_id": item_id, "start_date": start_date, "end_date": end_date, "memo": memo},
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )

    def list_events_in_range(self, *, start_date: str, end_date: str, mode: str = "active"):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.item_type,
                        i.title,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        e.start_date,
                        e.end_date,
                        e.memo
                    FROM {items} i
                    JOIN {event_items} e ON i.id = e.item_id
                    WHERE i.item_type = 'event'
                      AND i.status = :mode
                      AND e.start_date <= :range_end
                      AND COALESCE(e.end_date, e.start_date) >= :range_start
                    ORDER BY e.start_date ASC, i.created_at ASC
                    """.format(items=DbTables.ITEMS, event_items=DbTables.EVENT_ITEMS)
                ),
                {"mode": mode, "range_start": start_date, "range_end": end_date},
            ).mappings().all()
        return [dict(row) for row in rows]
