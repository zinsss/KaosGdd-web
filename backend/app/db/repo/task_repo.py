from sqlalchemy import text

from app.utils.clock import now_iso


class TaskRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_task(self, item_id: str, due_at: str | None = None, memo: str | None = None) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO task_items(item_id, due_at, memo, is_done)
                    VALUES (:item_id, :due_at, :memo, 0)
                    """
                ),
                {"item_id": item_id, "due_at": due_at, "memo": memo},
            )

    def list_tasks_active(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        t.due_at,
                        t.memo,
                        t.is_done,
                        t.done_at
                    FROM items i
                    JOIN task_items t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 0
                    ORDER BY
                        CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END ASC,
                        t.due_at ASC,
                        i.created_at ASC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_tasks_done(self, *, done_cutoff_iso: str):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        t.due_at,
                        t.memo,
                        t.is_done,
                        t.done_at
                    FROM items i
                    JOIN task_items t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 1
                      AND t.done_at IS NOT NULL
                      AND t.done_at >= :done_cutoff_iso
                    ORDER BY
                        t.done_at DESC,
                        i.updated_at DESC,
                        i.created_at DESC
                    """
                ),
                {"done_cutoff_iso": done_cutoff_iso},
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_tasks_archived(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        t.due_at,
                        t.memo,
                        t.is_done,
                        t.done_at
                    FROM items i
                    JOIN task_items t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'archived'
                    ORDER BY
                        COALESCE(t.done_at, i.updated_at, i.created_at) DESC,
                        i.updated_at DESC,
                        i.created_at DESC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_tasks_removed(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        t.due_at,
                        t.memo,
                        t.is_done,
                        t.done_at
                    FROM items i
                    JOIN task_items t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'removed'
                    ORDER BY
                        i.deleted_at DESC,
                        i.updated_at DESC,
                        i.created_at DESC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_done_tasks_older_than(self, *, done_cutoff_iso: str):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id
                    FROM items i
                    JOIN task_items t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 1
                      AND t.done_at IS NOT NULL
                      AND t.done_at < :done_cutoff_iso
                    ORDER BY t.done_at ASC
                    """
                ),
                {"done_cutoff_iso": done_cutoff_iso},
            ).mappings().all()
        return [dict(row) for row in rows]

    def get_task_detail(self, item_id: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        t.due_at,
                        t.memo,
                        t.is_done,
                        t.done_at,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at
                    FROM items i
                    JOIN task_items t ON i.id = t.item_id
                    WHERE i.id = :item_id
                      AND i.item_type = 'task'
                    LIMIT 1
                    """
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def update_task_fields(self, item_id: str, due_at: str | None, memo: str | None, is_done: bool) -> None:
        now = now_iso()
        done_at = now if is_done else None
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE task_items
                    SET due_at = :due_at,
                        memo = :memo,
                        is_done = :is_done,
                        done_at = :done_at
                    WHERE item_id = :item_id
                    """
                ),
                {
                    "item_id": item_id,
                    "due_at": due_at,
                    "memo": memo,
                    "is_done": 1 if is_done else 0,
                    "done_at": done_at,
                },
            )
            conn.execute(
                text("UPDATE items SET updated_at = :updated_at WHERE id = :item_id"),
                {"item_id": item_id, "updated_at": now},
            )

    def clear_done_state(self, item_id: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE task_items
                    SET is_done = 0,
                        done_at = NULL
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": item_id},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :updated_at WHERE id = :item_id"),
                {"item_id": item_id, "updated_at": now},
            )

    def toggle_done(self, item_id: str):
        detail = self.get_task_detail(item_id)
        if detail is None:
            return None

        now = now_iso()
        new_value = 0 if int(detail["is_done"]) else 1
        done_at = now if new_value else None

        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE task_items
                    SET is_done = :is_done,
                        done_at = :done_at
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": item_id, "is_done": new_value, "done_at": done_at},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :updated_at WHERE id = :item_id"),
                {"item_id": item_id, "updated_at": now},
            )

        return bool(new_value)
