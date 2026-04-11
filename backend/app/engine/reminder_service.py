from datetime import datetime, timedelta, timezone
import re

from app.config import SETTINGS
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.repo.task_repo import TaskRepo
from app.integrations.push_format import build_reminder_push_message
from app.integrations.pushover_client import send_pushover
from app.strings import ReminderStatusText
from app.utils.clock import now_iso
from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.timefmt import format_dt_for_ui


class ReminderService:
    def __init__(
        self,
        reminder_repo: ReminderRepo,
        task_repo: TaskRepo,
        items_repo: ItemsRepo | None = None,
    ) -> None:
        self.reminder_repo = reminder_repo
        self.task_repo = task_repo
        self.items_repo = items_repo

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
            fired_cutoff = (
                datetime.now(timezone.utc) - timedelta(days=SETTINGS.LIFECYCLE_FIRED_RETENTION_DAYS)
            ).isoformat(timespec="seconds")
            rows = self.reminder_repo.list_reminders_fired(fired_cutoff_iso=fired_cutoff)
        elif mode == "removed":
            rows = self.reminder_repo.list_reminders_removed()
        else:
            rows = self.reminder_repo.list_reminders_active()

        return [self._decorate_reminder(row) for row in rows]

    def list_standalone_reminders(self) -> list[dict]:
        rows = self.reminder_repo.list_standalone_reminders()
        return [self._decorate_reminder(row) for row in rows]

    def get_reminder(self, reminder_item_id: str) -> dict | None:
        row = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if row is None:
            return None
        return self._decorate_reminder(row)

    def parse_standalone_reminder_raw(self, raw_text: str) -> dict:
        text = str(raw_text or "").replace("\r\n", "\n").strip()
        if not text:
            raise ValueError("reminder is empty")

        if not text.startswith("!!"):
            raise ValueError("standalone reminder edit must start with !!")

        body = text[2:].strip()
        if not body:
            raise ValueError("reminder body is required after !!")

        lines = [line.strip() for line in body.split("\n") if line.strip()]
        if not lines:
            raise ValueError("reminder body is required after !!")

        tags: list[str] = []

        def strip_tags(value: str) -> tuple[str, list[str]]:
            found = re.findall(r"(?:(?<=^)|(?<=\s))#([^\s#]+)", value)
            cleaned = re.sub(r"(?:(?<=^)|(?<=\s))#([^\s#]+)", " ", value)
            cleaned = " ".join(cleaned.split())
            return cleaned, [tag.strip().lower() for tag in found if tag.strip()]

        first = lines[0]
        first_clean, first_tags = strip_tags(first)
        tags.extend(first_tags)

        match = re.match(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})(?:\s+(.*))?$", first_clean)
        if not match:
            raise ValueError("first reminder line must start with yyyy-mm-dd HH:MM")

        remind_at_local = match.group(1).strip()
        title_from_first = (match.group(2) or "").strip()

        title_parts: list[str] = []
        if title_from_first:
            title_parts.append(title_from_first)

        for line in lines[1:]:
            clean_line, line_tags = strip_tags(line)
            tags.extend(line_tags)
            if clean_line:
                title_parts.append(clean_line)

        title = " ".join(part for part in title_parts if part).strip()
        if not title:
            raise ValueError("reminder title is required")

        seen = set()
        deduped = []
        for tag in tags:
            if tag not in seen:
                seen.add(tag)
                deduped.append(tag)

        return {
            "title": title,
            "remind_at": parse_local_datetime_to_iso(remind_at_local),
            "tags": deduped,
        }

    def update_standalone_reminder_from_raw(self, reminder_item_id: str, raw_text: str) -> tuple[bool, str | None]:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found"

        if detail.get("parent_item_id"):
            return False, "linked reminders must be edited on parent item page"

        try:
            parsed = self.parse_standalone_reminder_raw(raw_text)
        except ValueError as exc:
            return False, str(exc)

        self.reminder_repo.reschedule_reminder_item(
            reminder_item_id,
            title=parsed["title"],
            remind_at=parsed["remind_at"],
            alert_policy=detail.get("alert_policy"),
        )

        if self.items_repo is not None:
            self.items_repo.replace_item_tags(reminder_item_id, parsed["tags"])

        return True, None

    def remove_reminder(self, reminder_item_id: str) -> bool:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False
        if self.items_repo is None:
            return False
        return self.items_repo.soft_delete_item(reminder_item_id)

    def restore_reminder(self, reminder_item_id: str) -> bool:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False
        if self.items_repo is None:
            return False
        restored = self.items_repo.restore_item(reminder_item_id)
        if not restored:
            return False
        self.reminder_repo.reset_to_scheduled(reminder_item_id)
        return True

    def cleanup_removed_items(self) -> dict:
        if self.items_repo is None:
            return {"tasks_deleted": 0, "reminders_deleted": 0}
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=SETTINGS.LIFECYCLE_REMOVED_RETENTION_DAYS)
        ).isoformat(timespec="seconds")
        tasks_deleted = self.items_repo.hard_delete_deleted_older_than(item_type="task", cutoff_iso=cutoff)
        reminders_deleted = self.items_repo.hard_delete_deleted_older_than(
            item_type="reminder",
            cutoff_iso=cutoff,
        )
        return {
            "tasks_deleted": tasks_deleted,
            "reminders_deleted": reminders_deleted,
        }

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

    def _decorate_reminder(self, row: dict) -> dict:
        item = dict(row)
        item["remind_at_display"] = format_dt_for_ui(item.get("remind_at"))
        item["last_fired_at_display"] = format_dt_for_ui(item.get("last_fired_at"))
        item["acked_at_display"] = format_dt_for_ui(item.get("acked_at"))
        item["snoozed_until_display"] = format_dt_for_ui(item.get("snoozed_until"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))

        parent_item_id = item.get("parent_item_id")
        item["parent_item_title"] = None
        item["parent_item_type"] = None

        if parent_item_id and self.task_repo is not None:
            parent = self.task_repo.get_task_detail(parent_item_id)
            if parent is not None:
                item["parent_item_title"] = parent.get("title")
                item["parent_item_type"] = parent.get("item_type") or "task"

        if self.items_repo is not None:
            item["tags"] = self.items_repo.list_item_tags(item["id"])
        else:
            item["tags"] = []

        return item
