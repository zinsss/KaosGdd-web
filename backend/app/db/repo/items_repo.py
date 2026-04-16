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

    def replace_item_links(self, source_item_id: str, target_item_ids: list[str]) -> None:
        normalized: list[str] = []
        seen: set[str] = set()
        for target_id in target_item_ids:
            clean = str(target_id or "").strip()
            if not clean or clean in seen:
                continue
            seen.add(clean)
            normalized.append(clean)

        now = now_iso()
        self.validate_item_links(source_item_id, normalized)

        with self.engine.begin() as conn:

            conn.execute(
                text(
                    "DELETE FROM {item_links} WHERE source_item_id = :source_item_id".format(
                        item_links=DbTables.ITEM_LINKS
                    )
                ),
                {"source_item_id": source_item_id},
            )

            for target_item_id in normalized:
                conn.execute(
                    text(
                        """
                        INSERT INTO {item_links}(source_item_id, target_item_id, created_at)
                        VALUES (:source_item_id, :target_item_id, :created_at)
                        """.format(item_links=DbTables.ITEM_LINKS)
                    ),
                    {
                        "source_item_id": source_item_id,
                        "target_item_id": target_item_id,
                        "created_at": now,
                    },
                )

            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": source_item_id, "updated_at": now},
            )

    def validate_item_links(self, source_item_id: str, target_item_ids: list[str]) -> None:
        normalized: list[str] = []
        seen: set[str] = set()
        for target_id in target_item_ids:
            clean = str(target_id or "").strip()
            if not clean or clean in seen:
                continue
            seen.add(clean)
            normalized.append(clean)

        with self.engine.begin() as conn:
            source = conn.execute(
                text(
                    "SELECT id, item_type FROM {items} WHERE id = :id LIMIT 1".format(items=DbTables.ITEMS)
                ),
                {"id": source_item_id},
            ).mappings().first()
            if source is None:
                raise ValueError("source item not found")

            if source["item_type"] == "reminder":
                raise ValueError("l: is not allowed for reminder")

            if source["item_type"] not in {"task", "event", "journal", "file", "fax", "mail"}:
                raise ValueError("l: is not allowed for this item type")

            for target_item_id in normalized:
                if target_item_id == source_item_id:
                    raise ValueError("self-link is invalid")

                target = conn.execute(
                    text("SELECT id, item_type FROM {items} WHERE id = :id LIMIT 1".format(items=DbTables.ITEMS)),
                    {"id": target_item_id},
                ).mappings().first()
                if target is None:
                    raise ValueError(f"linked item not found: {target_item_id}")
                if target["item_type"] == "reminder":
                    raise ValueError("l: cannot target reminder items")

    def list_item_links(self, source_item_id: str) -> list[str]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT target_item_id
                    FROM {item_links}
                    WHERE source_item_id = :source_item_id
                    ORDER BY target_item_id ASC
                    """.format(item_links=DbTables.ITEM_LINKS)
                ),
                {"source_item_id": source_item_id},
            ).fetchall()
        return [row[0] for row in rows]

    def list_resolved_item_links(self, source_item_id: str) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        l.target_item_id,
                        i.item_type AS target_item_type,
                        i.title AS target_title,
                        i.status AS target_status
                    FROM {item_links} l
                    LEFT JOIN {items} i ON i.id = l.target_item_id
                    WHERE l.source_item_id = :source_item_id
                    ORDER BY l.target_item_id ASC
                    """.format(item_links=DbTables.ITEM_LINKS, items=DbTables.ITEMS)
                ),
                {"source_item_id": source_item_id},
            ).mappings().all()
        return [dict(row) for row in rows]
