from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class FileRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_file(
        self,
        item_id: str,
        *,
        original_filename: str,
        stored_path: str,
        mime_type: str,
        size_bytes: int,
    ) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {file_items}(item_id, original_filename, stored_path, mime_type, size_bytes)
                    VALUES (:item_id, :original_filename, :stored_path, :mime_type, :size_bytes)
                    """.format(file_items=DbTables.FILE_ITEMS)
                ),
                {
                    "item_id": item_id,
                    "original_filename": original_filename,
                    "stored_path": stored_path,
                    "mime_type": mime_type,
                    "size_bytes": int(size_bytes),
                },
            )

    def list_files(self, mode: str = "active") -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id, i.item_type, i.title, i.status, i.created_at, i.updated_at, i.deleted_at,
                           f.original_filename, f.stored_path, f.mime_type, f.size_bytes
                    FROM {items} i
                    INNER JOIN {file_items} f ON f.item_id = i.id
                    WHERE i.item_type = 'file' AND i.status = :status
                    ORDER BY i.created_at DESC, i.rowid DESC
                    """.format(items=DbTables.ITEMS, file_items=DbTables.FILE_ITEMS)
                ),
                {"status": mode},
            ).mappings().all()
        return [dict(row) for row in rows]

    def get_file_detail(self, item_id: str) -> dict | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id, i.item_type, i.title, i.status, i.created_at, i.updated_at, i.deleted_at,
                           f.original_filename, f.stored_path, f.mime_type, f.size_bytes
                    FROM {items} i
                    INNER JOIN {file_items} f ON f.item_id = i.id
                    WHERE i.id = :item_id AND i.item_type = 'file'
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, file_items=DbTables.FILE_ITEMS)
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def touch_file_item(self, item_id: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :id".format(items=DbTables.ITEMS)),
                {"id": item_id, "updated_at": now_iso()},
            )
