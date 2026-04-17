from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class NoteRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_note(self, item_id: str, *, body: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {note_items}(item_id, body)
                    VALUES (:item_id, :body)
                    """.format(note_items=DbTables.NOTE_ITEMS)
                ),
                {"item_id": item_id, "body": body},
            )

    def get_note_detail(self, item_id: str):
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
                        i.deleted_at,
                        n.body
                    FROM {items} i
                    JOIN {note_items} n ON i.id = n.item_id
                    WHERE i.id = :id
                      AND i.item_type = 'note'
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, note_items=DbTables.NOTE_ITEMS)
                ),
                {"id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def list_notes(self, *, mode: str = "active"):
        allowed = {"active", "removed", "archived"}
        clean_mode = mode if mode in allowed else "active"

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
                        i.deleted_at,
                        n.body
                    FROM {items} i
                    JOIN {note_items} n ON i.id = n.item_id
                    WHERE i.item_type = 'note'
                      AND i.status = :mode
                    ORDER BY i.updated_at DESC, i.created_at DESC
                    """.format(items=DbTables.ITEMS, note_items=DbTables.NOTE_ITEMS)
                ),
                {"mode": clean_mode},
            ).mappings().all()
        return [dict(row) for row in rows]

    def update_note_body(self, item_id: str, *, body: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {note_items}
                    SET body = :body
                    WHERE item_id = :item_id
                    """.format(note_items=DbTables.NOTE_ITEMS)
                ),
                {"item_id": item_id, "body": body},
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )
