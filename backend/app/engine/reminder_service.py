from datetime import datetime, timedelta, timezone

from app.utils.clock import now_iso


class ReminderService:
    MISSED_AFTER_HOURS = 3

    def __init__(self, reminder_repo, task_repo) -> None:
        self.reminder_repo = reminder_repo
        self.task_repo = task_repo

    def create_task_reminder(
        self,
        *,
        task_item_id: str,
        remind_at: str,
        title: str | None = None,
        alert_policy: str | None = None,
    ):
        task = self.task_repo.get_task_detail(task_item_id)
        if task is None:
            return False, "not found", None

        reminder_title = title or f"Reminder • {task['title']}"
        reminder_item_id = self.reminder_repo.create_reminder_item(
            title=reminder_title,
            remind_at=remind_at,
            parent_item_id=task_item_id,
            alert_policy=alert_policy,
        )
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="created",
            payload={"parent_item_id": task_item_id, "remind_at": remind_at},
        )
        return True, "saved", reminder_item_id

    def fire_due_reminders(self) -> list[dict]:
        due_rows = self.reminder_repo.list_due_reminders(now_iso_value=now_iso())
        fired = []
        for row in due_rows:
            reminder_item_id = row["id"]
            self.reminder_repo.mark_fired(reminder_item_id)
            self.reminder_repo.create_event(
                reminder_item_id=reminder_item_id,
                event_type="fired",
                payload={
                    "parent_item_id": row.get("parent_item_id"),
                    "remind_at": row.get("remind_at"),
                },
            )
            row["state"] = "fired"
            row["last_fired_at"] = now_iso()
            fired.append(row)
        return fired

    def scan_missed_reminders(self) -> list[dict]:
        cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=self.MISSED_AFTER_HOURS)
        cutoff_iso = cutoff_dt.isoformat(timespec="seconds")
        rows = self.reminder_repo.list_missed_candidates(cutoff_iso_value=cutoff_iso)
        missed = []
        for row in rows:
            reminder_item_id = row["id"]
            self.reminder_repo.mark_missed(reminder_item_id)
            self.reminder_repo.create_event(
                reminder_item_id=reminder_item_id,
                event_type="missed",
                payload={
                    "parent_item_id": row.get("parent_item_id"),
                    "last_fired_at": row.get("last_fired_at"),
                    "threshold_hours": self.MISSED_AFTER_HOURS,
                },
            )
            row["state"] = "missed"
            missed.append(row)
        return missed

    def ack_reminder(self, reminder_item_id: str):
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found"
        self.reminder_repo.mark_acked(reminder_item_id)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="acked",
            payload={},
        )
        return True, "acked"

    def snooze_reminder(self, reminder_item_id: str, *, minutes: int = 10):
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found", None

        now_dt = datetime.now(timezone.utc)
        snoozed_until_dt = now_dt + timedelta(minutes=minutes)
        snoozed_until = snoozed_until_dt.isoformat(timespec="seconds")

        self.reminder_repo.mark_snoozed(reminder_item_id, snoozed_until=snoozed_until)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="snoozed",
            payload={"minutes": minutes, "snoozed_until": snoozed_until},
        )
        return True, "snoozed", snoozed_until

    def cancel_reminder(self, reminder_item_id: str):
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found"
        self.reminder_repo.mark_cancelled(reminder_item_id)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="cancelled",
            payload={},
        )
        return True, "cancelled"