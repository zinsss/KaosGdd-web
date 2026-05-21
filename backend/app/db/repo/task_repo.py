import json

from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso
from app.utils.ids import new_id


class TaskRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_task(
        self,
        item_id: str,
        due_at: str | None = None,
        memo: str | None = None,
        recurrence_group_id: str | None = None,
        recurrence_sequence: int | None = None,
        recurrence_parent_id: str | None = None,
    ) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {task_items}(
                        item_id, due_at, memo, is_done,
                        recurrence_group_id, recurrence_sequence, recurrence_parent_id
                    )
                    VALUES (
                        :item_id, :due_at, :memo, 0,
                        :recurrence_group_id, :recurrence_sequence, :recurrence_parent_id
                    )
                    """
                    .format(task_items=DbTables.TASK_ITEMS)
                ),
                {
                    "item_id": item_id,
                    "due_at": due_at,
                    "memo": memo,
                    "recurrence_group_id": recurrence_group_id,
                    "recurrence_sequence": recurrence_sequence,
                    "recurrence_parent_id": recurrence_parent_id,
                },
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
                        t.done_at,
                        t.recurrence_group_id,
                        t.recurrence_sequence,
                        t.recurrence_parent_id,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                        ) AS subtask_total,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                              AND ts.is_done = 1
                        ) AS subtask_done
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 0
                    ORDER BY
                        CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END ASC,
                        t.due_at ASC,
                        i.created_at ASC
                    """
                    .format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS, task_subtasks=DbTables.TASK_SUBTASKS)
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
                        t.done_at,
                        t.recurrence_group_id,
                        t.recurrence_sequence,
                        t.recurrence_parent_id,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                        ) AS subtask_total,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                              AND ts.is_done = 1
                        ) AS subtask_done
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
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
                    .format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS, task_subtasks=DbTables.TASK_SUBTASKS)
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
                        t.done_at,
                        t.recurrence_group_id,
                        t.recurrence_sequence,
                        t.recurrence_parent_id,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                        ) AS subtask_total,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                              AND ts.is_done = 1
                        ) AS subtask_done
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'archived'
                    ORDER BY
                        COALESCE(t.done_at, i.updated_at, i.created_at) DESC,
                        i.updated_at DESC,
                        i.created_at DESC
                    """
                    .format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS, task_subtasks=DbTables.TASK_SUBTASKS)
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
                        t.done_at,
                        t.recurrence_group_id,
                        t.recurrence_sequence,
                        t.recurrence_parent_id,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                        ) AS subtask_total,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                              AND ts.is_done = 1
                        ) AS subtask_done
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'removed'
                    ORDER BY
                        i.deleted_at DESC,
                        i.updated_at DESC,
                        i.created_at DESC
                    """
                    .format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS, task_subtasks=DbTables.TASK_SUBTASKS)
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_done_tasks_older_than(self, *, done_cutoff_iso: str):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 1
                      AND t.done_at IS NOT NULL
                      AND t.done_at < :done_cutoff_iso
                    ORDER BY t.done_at ASC
                    """
                    .format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS)
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
                        t.recurrence_group_id,
                        t.recurrence_sequence,
                        t.recurrence_parent_id,
                        i.created_at,
                        i.updated_at,
                        i.archived_at,
                        i.deleted_at,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                        ) AS subtask_total,
                        (
                            SELECT COUNT(*)
                            FROM {task_subtasks} ts
                            WHERE ts.task_item_id = i.id
                              AND ts.removed_at IS NULL
                              AND ts.is_done = 1
                        ) AS subtask_done
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
                    WHERE i.id = :item_id
                      AND i.item_type = 'task'
                    LIMIT 1
                    """
                    .format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS, task_subtasks=DbTables.TASK_SUBTASKS)
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def list_subtasks(self, item_id: str) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, task_item_id, content, position, is_done, done_at, created_at, updated_at
                    FROM {task_subtasks}
                    WHERE task_item_id = :item_id
                      AND removed_at IS NULL
                    ORDER BY position ASC, created_at ASC
                    """.format(task_subtasks=DbTables.TASK_SUBTASKS)
                ),
                {"item_id": item_id},
            ).mappings().all()
        return [dict(row) for row in rows]

    def replace_subtasks(self, item_id: str, subtasks: list[dict]) -> None:
        # v0 tradeoff: raw-edit sync is implemented as replace-all to keep behavior simple and durable.
        # This intentionally prioritizes correctness of content/order/is_done over stable subtask ids.
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text("DELETE FROM {task_subtasks} WHERE task_item_id = :item_id".format(task_subtasks=DbTables.TASK_SUBTASKS)),
                {"item_id": item_id},
            )

            for position, subtask in enumerate(subtasks):
                content = str(subtask.get("content") or "").strip()
                if not content:
                    continue
                is_done = 1 if bool(subtask.get("is_done")) else 0
                done_at = now if is_done else None
                conn.execute(
                    text(
                        """
                        INSERT INTO {task_subtasks}
                        (id, task_item_id, content, position, is_done, done_at, removed_at, created_at, updated_at)
                        VALUES
                        (:id, :task_item_id, :content, :position, :is_done, :done_at, NULL, :created_at, :updated_at)
                        """.format(task_subtasks=DbTables.TASK_SUBTASKS)
                    ),
                    {
                        "id": new_id(),
                        "task_item_id": item_id,
                        "content": content,
                        "position": position,
                        "is_done": is_done,
                        "done_at": done_at,
                        "created_at": now,
                        "updated_at": now,
                    },
                )

            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )

    def toggle_subtask(self, task_id: str, subtask_id: str):
        now = now_iso()
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT id, is_done
                    FROM {task_subtasks}
                    WHERE id = :subtask_id
                      AND task_item_id = :task_id
                      AND removed_at IS NULL
                    LIMIT 1
                    """.format(task_subtasks=DbTables.TASK_SUBTASKS)
                ),
                {"subtask_id": subtask_id, "task_id": task_id},
            ).mappings().first()

            if row is None:
                return None

            new_value = 0 if int(row["is_done"]) else 1
            done_at = now if new_value else None

            conn.execute(
                text(
                    """
                    UPDATE {task_subtasks}
                    SET is_done = :is_done,
                        done_at = :done_at,
                        updated_at = :updated_at
                    WHERE id = :subtask_id
                    """.format(task_subtasks=DbTables.TASK_SUBTASKS)
                ),
                {
                    "subtask_id": subtask_id,
                    "is_done": new_value,
                    "done_at": done_at,
                    "updated_at": now,
                },
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": task_id, "updated_at": now},
            )

        return bool(new_value)

    def update_task_fields(self, item_id: str, due_at: str | None, memo: str | None, is_done: bool) -> None:
        now = now_iso()
        done_at = now if is_done else None
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {task_items}
                    SET due_at = :due_at,
                        memo = :memo,
                        is_done = :is_done,
                        done_at = :done_at
                    WHERE item_id = :item_id
                    """
                    .format(task_items=DbTables.TASK_ITEMS)
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
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )

    def set_recurrence_metadata(
        self,
        item_id: str,
        *,
        recurrence_group_id: str | None,
        recurrence_sequence: int | None,
        recurrence_parent_id: str | None,
    ) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {task_items}
                    SET recurrence_group_id = :recurrence_group_id,
                        recurrence_sequence = :recurrence_sequence,
                        recurrence_parent_id = :recurrence_parent_id
                    WHERE item_id = :item_id
                    """.format(task_items=DbTables.TASK_ITEMS)
                ),
                {
                    "item_id": item_id,
                    "recurrence_group_id": recurrence_group_id,
                    "recurrence_sequence": recurrence_sequence,
                    "recurrence_parent_id": recurrence_parent_id,
                },
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )

    def list_active_future_recurrence_tasks(self, *, recurrence_group_id: str, min_sequence: int) -> list[dict]:
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
                        t.done_at,
                        t.recurrence_group_id,
                        t.recurrence_sequence,
                        t.recurrence_parent_id
                    FROM {items} i
                    JOIN {task_items} t ON i.id = t.item_id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 0
                      AND t.recurrence_group_id = :recurrence_group_id
                      AND COALESCE(t.recurrence_sequence, -1) >= :min_sequence
                    ORDER BY t.recurrence_sequence ASC, t.due_at ASC, i.created_at ASC
                    """.format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS)
                ),
                {"recurrence_group_id": recurrence_group_id, "min_sequence": min_sequence},
            ).mappings().all()
        return [dict(row) for row in rows]

    def create_recurrence_history(
        self,
        *,
        recurrence_group_id: str,
        edited_task_id: str,
        previous_values: dict,
        new_values: dict,
        affected_task_ids: list[str],
    ) -> str:
        history_id = new_id()
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {task_recurrence_history}(
                        id,
                        recurrence_group_id,
                        edited_at,
                        edited_task_id,
                        edit_scope,
                        previous_values_json,
                        new_values_json,
                        affected_future_count,
                        affected_task_ids_json
                    )
                    VALUES (
                        :id,
                        :recurrence_group_id,
                        :edited_at,
                        :edited_task_id,
                        'this_and_future',
                        :previous_values_json,
                        :new_values_json,
                        :affected_future_count,
                        :affected_task_ids_json
                    )
                    """.format(task_recurrence_history=DbTables.TASK_RECURRENCE_HISTORY)
                ),
                {
                    "id": history_id,
                    "recurrence_group_id": recurrence_group_id,
                    "edited_at": now,
                    "edited_task_id": edited_task_id,
                    "previous_values_json": json.dumps(previous_values, sort_keys=True),
                    "new_values_json": json.dumps(new_values, sort_keys=True),
                    "affected_future_count": max(len(affected_task_ids) - 1, 0),
                    "affected_task_ids_json": json.dumps(affected_task_ids),
                },
            )
        return history_id

    def list_recurrence_history(self, recurrence_group_id: str, *, limit: int = 20) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        id,
                        recurrence_group_id,
                        edited_at,
                        edited_task_id,
                        edit_scope,
                        previous_values_json,
                        new_values_json,
                        affected_future_count,
                        affected_task_ids_json
                    FROM {task_recurrence_history}
                    WHERE recurrence_group_id = :recurrence_group_id
                    ORDER BY edited_at DESC, id DESC
                    LIMIT :limit
                    """.format(task_recurrence_history=DbTables.TASK_RECURRENCE_HISTORY)
                ),
                {"recurrence_group_id": recurrence_group_id, "limit": limit},
            ).mappings().all()

        history = []
        for row in rows:
            item = dict(row)
            for key in ("previous_values_json", "new_values_json", "affected_task_ids_json"):
                try:
                    item[key[:-5] if key.endswith("_json") else key] = json.loads(item.get(key) or "{}")
                except (TypeError, json.JSONDecodeError):
                    item[key[:-5] if key.endswith("_json") else key] = [] if key == "affected_task_ids_json" else {}
            history.append(item)
        return history

    def clear_done_state(self, item_id: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {task_items}
                    SET is_done = 0,
                        done_at = NULL
                    WHERE item_id = :item_id
                    """
                    .format(task_items=DbTables.TASK_ITEMS)
                ),
                {"item_id": item_id},
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
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
                    UPDATE {task_items}
                    SET is_done = :is_done,
                        done_at = :done_at
                    WHERE item_id = :item_id
                    """
                    .format(task_items=DbTables.TASK_ITEMS)
                ),
                {"item_id": item_id, "is_done": new_value, "done_at": done_at},
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :item_id".format(items=DbTables.ITEMS)),
                {"item_id": item_id, "updated_at": now},
            )

        return bool(new_value)

    def exists_active_task_occurrence(
        self,
        *,
        title: str,
        due_at: str,
        repeat_rule: str,
    ) -> bool:
        repeat_tag = f"repeat:{repeat_rule}"
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id
                    FROM {items} i
                    JOIN {task_items} t ON t.item_id = i.id
                    JOIN {item_tags} it ON it.item_id = i.id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 0
                      AND i.title = :title
                      AND t.due_at = :due_at
                      AND it.tag = :repeat_tag
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS, item_tags=DbTables.ITEM_TAGS)
                ),
                {
                    "title": title,
                    "due_at": due_at,
                    "repeat_tag": repeat_tag,
                },
            ).mappings().first()
        return row is not None

    def exists_active_recurrence_occurrence(
        self,
        *,
        recurrence_group_id: str,
        due_at: str,
    ) -> bool:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id
                    FROM {items} i
                    JOIN {task_items} t ON t.item_id = i.id
                    WHERE i.item_type = 'task'
                      AND i.status = 'active'
                      AND t.is_done = 0
                      AND t.recurrence_group_id = :recurrence_group_id
                      AND t.due_at = :due_at
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, task_items=DbTables.TASK_ITEMS)
                ),
                {"recurrence_group_id": recurrence_group_id, "due_at": due_at},
            ).mappings().first()
        return row is not None
