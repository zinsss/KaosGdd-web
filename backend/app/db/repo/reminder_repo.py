import json

from sqlalchemy import text

from app.utils.clock import now_iso
from app.utils.ids import new_id


class ReminderRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_reminder_item(
        self,
        *,
        title: str,
        remind_at: str,
        parent_item_id: str | None = None,
        alert_policy: str | None = None,
    ) -> str:
        reminder_item_id = new_id()
        now = now_iso()

        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO items(id, item_type, title, status, created_at, updated_at)
                    VALUES (:id, 'reminder', :title, 'active', :created_at, :updated_at)
                    """
                ),
                {
                    "id": reminder_item_id,
                    "title": title,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            conn.execute(
                text(
                    """
                    INSERT INTO reminder_items(item_id, remind_at, state, alert_policy, last_fired_at, acked_at, snoozed_until)
                    VALUES (:item_id, :remind_at, 'scheduled', :alert_policy, NULL, NULL, NULL)
                    """
                ),
                {
                    "item_id": reminder_item_id,
                    "remind_at": remind_at,
                    "alert_policy": alert_policy,
                },
            )

            if parent_item_id:
                conn.execute(
                    text(
                        """
                        INSERT INTO item_reminders(item_id, reminder_item_id, created_at)
                        VALUES (:item_id, :reminder_item_id, :created_at)
                        """
                    ),
                    {
                        "item_id": parent_item_id,
                        "reminder_item_id": reminder_item_id,
                        "created_at": now,
                    },
                )

        return reminder_item_id

    def _base_select(self) -> str:
        return """
            SELECT
                i.id,
                i.item_type,
                i.title,
                i.status,
                i.created_at,
                i.updated_at,
                i.deleted_at,
                r.remind_at,
                r.state,
                r.alert_policy,
                r.last_fired_at,
                r.acked_at,
                r.snoozed_until,
                ir.item_id AS parent_item_id
            FROM items i
            JOIN reminder_items r ON i.id = r.item_id
            LEFT JOIN item_reminders ir ON ir.reminder_item_id = r.item_id
        """

    def get_reminder_detail(self, reminder_item_id: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.id = :id
                      AND i.item_type = 'reminder'
                    LIMIT 1
                    """
                ),
                {"id": reminder_item_id},
            ).mappings().first()
        return dict(row) if row else None

    def list_reminders_active(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.item_type = 'reminder'
                      AND i.status = 'active'
                      AND r.state IN ('scheduled', 'snoozed', 'missed')
                    ORDER BY
                        COALESCE(r.snoozed_until, r.remind_at) ASC,
                        i.created_at ASC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_reminders_fired(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.item_type = 'reminder'
                      AND i.status = 'active'
                      AND r.state IN ('fired', 'acked', 'cancelled')
                    ORDER BY
                        COALESCE(r.last_fired_at, r.acked_at, r.remind_at) DESC,
                        i.created_at DESC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_reminders_removed(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.item_type = 'reminder'
                      AND i.status = 'deleted'
                    ORDER BY
                        i.deleted_at DESC,
                        i.updated_at DESC,
                        i.created_at DESC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_standalone_reminders(self):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.item_type = 'reminder'
                      AND i.status = 'active'
                      AND ir.item_id IS NULL
                    ORDER BY
                        CASE r.state
                            WHEN 'scheduled' THEN 1
                            WHEN 'snoozed' THEN 2
                            WHEN 'missed' THEN 3
                            WHEN 'fired' THEN 4
                            WHEN 'acked' THEN 5
                            WHEN 'cancelled' THEN 6
                            ELSE 7
                        END ASC,
                        COALESCE(r.snoozed_until, r.remind_at) ASC,
                        i.created_at ASC
                    """
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_linked_reminders(self, parent_item_id: str):
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
                        r.remind_at,
                        r.state,
                        r.alert_policy,
                        r.last_fired_at,
                        r.acked_at,
                        r.snoozed_until,
                        ir.item_id AS parent_item_id
                    FROM item_reminders ir
                    JOIN items i ON i.id = ir.reminder_item_id
                    JOIN reminder_items r ON r.item_id = ir.reminder_item_id
                    WHERE ir.item_id = :parent_item_id
                      AND i.item_type = 'reminder'
                      AND i.status = 'active'
                    ORDER BY
                        CASE r.state
                            WHEN 'fired' THEN 1
                            WHEN 'missed' THEN 2
                            WHEN 'scheduled' THEN 3
                            WHEN 'snoozed' THEN 4
                            WHEN 'acked' THEN 5
                            WHEN 'cancelled' THEN 6
                            ELSE 7
                        END ASC,
                        COALESCE(r.snoozed_until, r.remind_at) ASC,
                        i.created_at ASC
                    """
                ),
                {"parent_item_id": parent_item_id},
            ).mappings().all()
        return [dict(row) for row in rows]

    def get_editable_reminder_for_parent(self, parent_item_id: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT
                        i.id,
                        i.title,
                        i.status,
                        r.remind_at,
                        r.state,
                        r.alert_policy,
                        r.last_fired_at,
                        r.acked_at,
                        r.snoozed_until,
                        ir.item_id AS parent_item_id
                    FROM item_reminders ir
                    JOIN items i ON i.id = ir.reminder_item_id
                    JOIN reminder_items r ON r.item_id = ir.reminder_item_id
                    WHERE ir.item_id = :parent_item_id
                      AND i.item_type = 'reminder'
                      AND i.status = 'active'
                      AND r.state IN ('scheduled', 'snoozed', 'fired', 'missed')
                    ORDER BY
                        CASE r.state
                            WHEN 'fired' THEN 1
                            WHEN 'missed' THEN 2
                            WHEN 'scheduled' THEN 3
                            WHEN 'snoozed' THEN 4
                            ELSE 5
                        END ASC,
                        COALESCE(r.snoozed_until, r.remind_at) ASC,
                        i.created_at ASC
                    LIMIT 1
                    """
                ),
                {"parent_item_id": parent_item_id},
            ).mappings().first()
        return dict(row) if row else None

    def reschedule_reminder_item(
        self,
        reminder_item_id: str,
        *,
        title: str,
        remind_at: str,
        alert_policy: str | None = None,
    ) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE items
                    SET title = :title,
                        updated_at = :updated_at
                    WHERE id = :item_id
                    """
                ),
                {"item_id": reminder_item_id, "title": title, "updated_at": now},
            )
            conn.execute(
                text(
                    """
                    UPDATE reminder_items
                    SET remind_at = :remind_at,
                        state = 'scheduled',
                        alert_policy = :alert_policy,
                        last_fired_at = NULL,
                        acked_at = NULL,
                        snoozed_until = NULL
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": reminder_item_id, "remind_at": remind_at, "alert_policy": alert_policy},
            )

    def list_due_reminders(self, *, now_iso_value: str):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.item_type = 'reminder'
                      AND i.status = 'active'
                      AND (r.state = 'scheduled' OR r.state = 'snoozed')
                      AND COALESCE(r.snoozed_until, r.remind_at) <= :now_iso_value
                    ORDER BY COALESCE(r.snoozed_until, r.remind_at) ASC, i.created_at ASC
                    """
                ),
                {"now_iso_value": now_iso_value},
            ).mappings().all()
        return [dict(row) for row in rows]

    def list_missed_candidates(self, *, cutoff_iso_value: str):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    self._base_select()
                    + """
                    WHERE i.item_type = 'reminder'
                      AND i.status = 'active'
                      AND r.state = 'fired'
                      AND r.last_fired_at IS NOT NULL
                      AND r.last_fired_at <= :cutoff_iso_value
                    ORDER BY r.last_fired_at ASC, i.created_at ASC
                    """
                ),
                {"cutoff_iso_value": cutoff_iso_value},
            ).mappings().all()
        return [dict(row) for row in rows]

    def mark_fired(self, reminder_item_id: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE reminder_items
                    SET state = 'fired',
                        last_fired_at = :now
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": reminder_item_id, "now": now},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :now WHERE id = :item_id"),
                {"item_id": reminder_item_id, "now": now},
            )

    def mark_acked(self, reminder_item_id: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE reminder_items
                    SET state = 'acked',
                        acked_at = :now,
                        snoozed_until = NULL
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": reminder_item_id, "now": now},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :now WHERE id = :item_id"),
                {"item_id": reminder_item_id, "now": now},
            )

    def mark_missed(self, reminder_item_id: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text("UPDATE reminder_items SET state = 'missed' WHERE item_id = :item_id"),
                {"item_id": reminder_item_id},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :now WHERE id = :item_id"),
                {"item_id": reminder_item_id, "now": now},
            )

    def mark_snoozed(self, reminder_item_id: str, *, snoozed_until: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE reminder_items
                    SET state = 'snoozed',
                        snoozed_until = :snoozed_until
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": reminder_item_id, "snoozed_until": snoozed_until},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :now WHERE id = :item_id"),
                {"item_id": reminder_item_id, "now": now},
            )

    def mark_cancelled(self, reminder_item_id: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE reminder_items
                    SET state = 'cancelled',
                        snoozed_until = NULL
                    WHERE item_id = :item_id
                    """
                ),
                {"item_id": reminder_item_id},
            )
            conn.execute(
                text("UPDATE items SET updated_at = :now WHERE id = :item_id"),
                {"item_id": reminder_item_id, "now": now},
            )

    def create_event(self, *, reminder_item_id: str, event_type: str, payload: dict | None = None) -> str:
        event_id = new_id()
        now = now_iso()
        payload_json = json.dumps(payload or {}, ensure_ascii=False)

        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO reminder_events(id, reminder_item_id, event_type, event_at, payload_json)
                    VALUES (:id, :reminder_item_id, :event_type, :event_at, :payload_json)
                    """
                ),
                {
                    "id": event_id,
                    "reminder_item_id": reminder_item_id,
                    "event_type": event_type,
                    "event_at": now,
                    "payload_json": payload_json,
                },
            )
        return event_id