from sqlalchemy import text

from app.utils.clock import now_iso
from app.utils.ids import new_id


class ItemsRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_item(self, item_type: str, title: str, status: str = "active") -> str:
        item_id = new_id()
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO items(id, item_type, title, status, created_at, updated_at)
                    VALUES (:id, :item_type, :title, :status, :created_at, :updated_at)
                    """
                ),
                {
                    "id": item_id,
                    "item_type": item_type,
                    "title": title,
                    "status": status,
                    "created_at": now,
                    "updated_at": now,
                },
            )
        return item_id

    def update_item_title(self, item_id: str, title: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE items
                    SET title = :title,
                        updated_at = :updated_at
                    WHERE id = :id
                    """
                ),
                {"id": item_id, "title": title, "updated_at": now},
            )

    def soft_delete_item(self, item_id: str) -> bool:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE items
                    SET status = 'deleted',
                        deleted_at = :deleted_at,
                        updated_at = :updated_at
                    WHERE id = :id
                      AND status != 'deleted'
                    """
                ),
                {"id": item_id, "deleted_at": now, "updated_at": now},
            )
        return bool(result.rowcount)

    def restore_item(self, item_id: str) -> bool:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE items
                    SET status = 'active',
                        deleted_at = NULL,
                        updated_at = :updated_at
                    WHERE id = :id
                      AND status = 'deleted'
                    """
                ),
                {"id": item_id, "updated_at": now},
            )
        return bool(result.rowcount)

    def list_item_tags(self, item_id: str) -> list[str]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT tag
                    FROM item_tags
                    WHERE item_id = :item_id
                    ORDER BY tag ASC
                    """
                ),
                {"item_id": item_id},
            ).fetchall()
        return [row[0] for row in rows]

    def replace_item_tags(self, item_id: str, tags: list[str]) -> None:
        normalized = []
        seen = set()

        for tag in tags:
            clean = str(tag or "").strip().lower()
            if not clean:
                continue
            if clean in seen:
                continue
            seen.add(clean)
            normalized.append(clean)

        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text("DELETE FROM item_tags WHERE item_id = :item_id"),
                {"item_id": item_id},
            )

            for tag in normalized:
                conn.execute(
                    text(
                        """
                        INSERT INTO item_tags(item_id, tag, created_at)
                        VALUES (:item_id, :tag, :created_at)
                        """
                    ),
                    {"item_id": item_id, "tag": tag, "created_at": now},
                )

            conn.execute(
                text("UPDATE items SET updated_at = :updated_at WHERE id = :item_id"),
                {"item_id": item_id, "updated_at": now},
            )