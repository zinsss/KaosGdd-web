from datetime import datetime, timedelta, timezone

from app.config import SETTINGS
from app.db.repo.reminder_repo import ReminderRepo
from app.db.repo.task_repo import TaskRepo
from app.integrations.push_format import build_reminder_push_message
from app.integrations.pushover_client import send_pushover
from app.strings import ReminderStatusText
from app.utils.clock import now_iso
from app.utils.timefmt import format_dt_for_ui


class ReminderService:
    def __init__(self, reminder_repo: ReminderRepo, task_repo: TaskRepo) -> None:
        self.reminder_repo = reminder_repo
        self.task_repo = task_repo

    def create_task_reminder(
        self,
        *,
        task_item_id: str,
        remind_at: str,
        title: str | None = None,
        alert_policy: str | None = None,
    ) -> tuple[bool, str, str | None]:
        task = self.task_repo.get_task_detail(task_item_id)
        if task is None:
            return False, "not found", None

        reminder_title = title or f"Reminder • {task['title']}"
        reminder_id = self.reminder_repo.create_reminder_item(
            title=reminder_title,
            remind_at=remind_at,
            parent_item_id=task_item_id,
            alert_policy=alert_policy,
        )
        return True, ReminderStatusText.SAVED, reminder_id

    def create_standalone_reminder(
        self,
        *,
        title: str,
        remind_at: str,
        alert_policy: str | None = None,
    ) -> tuple[bool, str, str | None]:
        clean_title = str(title or "").strip()
        if not clean_title:
            return False, "title is required", None

        reminder_id = self.reminder_repo.create_reminder_item(
            title=clean_title,
            remind_at=remind_at,
            parent_item_id=None,
            alert_policy=alert_policy,
        )
        return True, ReminderStatusText.SAVED, reminder_id

    def list_reminders(self, mode: str = "active") -> list[dict]:
        if mode == "fired":
            rows = self.reminder_repo.list_reminders_fired()
        elif mode == "removed":
            rows = self.reminder_repo.list_reminders_removed()
        else:
            rows = self.reminder_repo.list_reminders_active()

        for row in rows:
            row["remind_at_display"] = format_dt_for_ui(row.get("remind_at"))
            row["last_fired_at_display"] = format_dt_for_ui(row.get("last_fired_at"))
            row["acked_at_display"] = format_dt_for_ui(row.get("acked_at"))
            row["snoozed_until_display"] = format_dt_for_ui(row.get("snoozed_until"))
            row["removed_at_display"] = format_dt_for_ui(row.get("deleted_at"))
        return rows

    def list_standalone_reminders(self) -> list[dict]:
        rows = self.reminder_repo.list_standalone_reminders()
        for row in rows:
            row["remind_at_display"] = format_dt_for_ui(row.get("remind_at"))
            row["last_fired_at_display"] = format_dt_for_ui(row.get("last_fired_at"))
            row["acked_at_display"] = format_dt_for_ui(row.get("acked_at"))
            row["snoozed_until_display"] = format_dt_for_ui(row.get("snoozed_until"))
        return rows

    def get_reminder(self, reminder_item_id: str) -> dict | None:
        row = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if row is None:
            return None
        row["remind_at_display"] = format_dt_for_ui(row.get("remind_at"))
        row["last_fired_at_display"] = format_dt_for_ui(row.get("last_fired_at"))
        row["acked_at_display"] = format_dt_for_ui(row.get("acked_at"))
        row["snoozed_until_display"] = format_dt_for_ui(row.get("snoozed_until"))
        row["removed_at_display"] = format_dt_for_ui(row.get("deleted_at"))
        return row

    def ack_reminder(self, reminder_item_id: str) -> tuple[bool, str]:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found"

        self.reminder_repo.mark_acked(reminder_item_id)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="acked",
            payload={"parent_item_id": detail.get("parent_item_id")},
        )
        return True, ReminderStatusText.ACKED

    def snooze_reminder(self, reminder_item_id: str, *, minutes: int) -> tuple[bool, str, str | None]:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found", None

        base_now = datetime.now(timezone.utc)
        snoozed_until = (base_now + timedelta(minutes=minutes)).isoformat(timespec="seconds")
        self.reminder_repo.mark_snoozed(reminder_item_id, snoozed_until=snoozed_until)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="snoozed",
            payload={
                "minutes": minutes,
                "snoozed_until": snoozed_until,
                "parent_item_id": detail.get("parent_item_id"),
            },
        )
        return True, ReminderStatusText.SNOOZED, snoozed_until

    def cancel_reminder(self, reminder_item_id: str) -> tuple[bool, str]:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found"

        self.reminder_repo.mark_cancelled(reminder_item_id)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="cancelled",
            payload={"parent_item_id": detail.get("parent_item_id")},
        )
        return True, ReminderStatusText.CANCELLED

    def fire_due_reminders(self) -> list[dict]:
        rows = self.reminder_repo.list_due_reminders(now_iso_value=now_iso())
        fired: list[dict] = []

        for row in rows:
            self.reminder_repo.mark_fired(row["id"])
            self.reminder_repo.create_event(
                reminder_item_id=row["id"],
                event_type="fired",
                payload={"parent_item_id": row.get("parent_item_id")},
            )

            task = None
            if row.get("parent_item_id"):
                task = self.task_repo.get_task_detail(row["parent_item_id"])

            click_url = None
            if row.get("parent_item_id") and SETTINGS.WEB_BASE_URL:
                click_url = SETTINGS.WEB_BASE_URL.rstrip("/") + "/tasks/" + row["parent_item_id"]

            if not row.get("parent_item_id") and SETTINGS.WEB_BASE_URL:
                click_url = SETTINGS.WEB_BASE_URL.rstrip("/") + "/reminders/" + row["id"]

            item_title = task["title"] if task else row["title"]
            item_type = task.get("item_type") if task else "reminder"

            push_body = build_reminder_push_message(
                item_type=item_type,
                title=item_title,
                due_at=task.get("due_at") if task else None,
                remind_at=row.get("remind_at"),
            )

            send_pushover(
                title="𝕂𝕒𝕠𝕤𝔾𝕕𝕕",
                message=push_body,
                url=click_url,
                url_title="Open" if click_url else None,
                priority=0,
                sound=None,
            )

            fired.append(row)

        return fired

    def scan_missed_reminders(self) -> list[dict]:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(timespec="seconds")
        rows = self.reminder_repo.list_missed_candidates(cutoff_iso_value=cutoff)

        missed: list[dict] = []
        for row in rows:
            self.reminder_repo.mark_missed(row["id"])
            self.reminder_repo.create_event(
                reminder_item_id=row["id"],
                event_type="missed",
                payload={"parent_item_id": row.get("parent_item_id")},
            )

            task = None
            if row.get("parent_item_id"):
                task = self.task_repo.get_task_detail(row["parent_item_id"])

            click_url = None
            if row.get("parent_item_id") and SETTINGS.WEB_BASE_URL:
                click_url = SETTINGS.WEB_BASE_URL.rstrip("/") + "/tasks/" + row["parent_item_id"]

            if not row.get("parent_item_id") and SETTINGS.WEB_BASE_URL:
                click_url = SETTINGS.WEB_BASE_URL.rstrip("/") + "/reminders/" + row["id"]

            item_title = task["title"] if task else row["title"]
            item_type = task.get("item_type") if task else "reminder"

            push_body = build_reminder_push_message(
                item_type=item_type,
                title=item_title,
                due_at=task.get("due_at") if task else None,
                remind_at=row.get("remind_at"),
            )

            send_pushover(
                title="𝕂𝕒𝕠𝕤𝔾𝕕𝕕",
                message=push_body,
                url=click_url,
                url_title="Open" if click_url else None,
                priority=1,
                sound="persistent",
            )

            missed.append(row)

        return missed