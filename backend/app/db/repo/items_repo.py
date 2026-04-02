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
