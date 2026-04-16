from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class JournalRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_journal(self, item_id: str, *, body: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {journal_items}(item_id, body)
                    VALUES (:item_id, :body)
                    """.format(journal_items=DbTables.JOURNAL_ITEMS)
                ),
                {"item_id": item_id, "body": body},
            )

    def get_journal_detail(self, item_id: str):
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
                        j.body
                    FROM {items} i
                    JOIN {journal_items} j ON i.id = j.item_id
                    WHERE i.id = :item_id
                      AND i.item_type = 'journal'
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, journal_items=DbTables.JOURNAL_ITEMS)
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def list_journals(self, *, mode: str = "active"):
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
                        j.body
                    FROM {items} i
                    JOIN {journal_items} j ON i.id = j.item_id
                    WHERE i.item_type = 'journal'
                      AND i.status = :mode
                    ORDER BY i.created_at DESC, i.updated_at DESC, i.rowid DESC, i.id DESC
                    """.format(items=DbTables.ITEMS, journal_items=DbTables.JOURNAL_ITEMS)
                ),
                {"mode": mode},
            ).mappings().all()
        return [dict(row) for row in rows]

    def update_journal_body(self, item_id: str, *, body: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {journal_items}
                    SET body = :body
                    WHERE item_id = :item_id
                    """.format(journal_items=DbTables.JOURNAL_ITEMS)
                ),
                {"item_id": item_id, "body": body},
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )
