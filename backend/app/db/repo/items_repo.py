from sqlalchemy import text

from app.config import DbTables
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
                    INSERT INTO {items}(id, item_type, title, status, created_at, updated_at)
                    VALUES (:id, :item_type, :title, :status, :created_at, :updated_at)
                    """
                    .format(items=DbTables.ITEMS)
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
                    UPDATE {items}
                    SET title = :title,
                        updated_at = :updated_at
                    WHERE id = :id
                    """
                    .format(items=DbTables.ITEMS)
                ),
                {"id": item_id, "title": title, "updated_at": now},
            )

    def soft_delete_item(self, item_id: str) -> bool:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE {items}
                    SET status = 'removed',
                        archived_at = NULL,
                        deleted_at = :deleted_at,
                        updated_at = :updated_at
                    WHERE id = :id
                      AND status != 'removed'
                    """
                    .format(items=DbTables.ITEMS)
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
                    UPDATE {items}
                    SET status = 'active',
                        archived_at = NULL,
                        deleted_at = NULL,
                        updated_at = :updated_at
                    WHERE id = :id
                      AND status = 'removed'
                    """
                    .format(items=DbTables.ITEMS)
                ),
                {"id": item_id, "updated_at": now},
            )
        return bool(result.rowcount)

    def archive_item(self, item_id: str) -> bool:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE {items}
                    SET status = 'archived',
                        archived_at = :archived_at,
                        deleted_at = NULL,
                        updated_at = :updated_at
                    WHERE id = :id
                      AND status = 'active'
                    """
                    .format(items=DbTables.ITEMS)
                ),
                {"id": item_id, "archived_at": now, "updated_at": now},
            )
        return bool(result.rowcount)

    def hard_delete_deleted_older_than(self, *, item_type: str, cutoff_iso: str) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    DELETE FROM {items}
                    WHERE item_type = :item_type
                      AND status = 'removed'
                      AND deleted_at IS NOT NULL
                      AND deleted_at < :cutoff_iso
                    """
                    .format(items=DbTables.ITEMS)
                ),
                {"item_type": item_type, "cutoff_iso": cutoff_iso},
            )
        return int(result.rowcount or 0)

    def list_item_tags(self, item_id: str) -> list[str]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT tag
                    FROM {item_tags}
                    WHERE item_id = :item_id
                    ORDER BY tag ASC
                    """
                    .format(item_tags=DbTables.ITEM_TAGS)
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
                text("DELETE FROM {item_tags} WHERE item_id = :item_id".format(item_tags=DbTables.ITEM_TAGS)),
                {"item_id": item_id},
            )

            for tag in normalized:
                conn.execute(
                    text(
                        """
                        INSERT INTO {item_tags}(item_id, tag, created_at)
                        VALUES (:item_id, :tag, :created_at)
                        """
                        .format(item_tags=DbTables.ITEM_TAGS)
                    ),
                    {"item_id": item_id, "tag": tag, "created_at": now},
                )

            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )
