from datetime import datetime, timedelta, timezone
import json
import logging
import re
import threading

from app.config import SETTINGS
from app.db.repo.event_repo import EventRepo
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.repo.task_repo import TaskRepo
from app.integrations.push_format import build_push_body, build_push_title
from app.integrations.pushover_client import send_pushover
from app.strings import ReminderStatusText
from app.utils.clock import now_iso
from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.timefmt import format_dt_for_ui

logger = logging.getLogger(__name__)


class ReminderService:
    def __init__(
        self,
        reminder_repo: ReminderRepo,
        task_repo: TaskRepo,
        event_repo: EventRepo | None = None,
        items_repo: ItemsRepo | None = None,
        push_subscription_repo=None,
        web_push_client=None,
    ) -> None:
        self.reminder_repo = reminder_repo
        self.task_repo = task_repo
        self.event_repo = event_repo
        self.items_repo = items_repo
        self.push_subscription_repo = push_subscription_repo
        self.web_push_client = web_push_client

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
            if line.startswith("l:"):
                raise ValueError("standalone reminder does not support l:")
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

    def export_standalone_reminder_raw(self, reminder_item_id: str) -> str | None:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return None
        if detail.get("parent_item_id"):
            return None

        when = format_dt_for_ui(detail.get("remind_at"))
        if not when:
            return None

        title = str(detail.get("title") or "").strip()
        if not title:
            return None

        lines = [f"!! {when}", title]
        if self.items_repo is not None:
            tags = self.items_repo.list_item_tags(reminder_item_id)
        else:
            tags = []
        if tags:
            lines.append(" ".join(f"#{tag}" for tag in tags))
        return "\n".join(lines)

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
            return {"tasks_deleted": 0, "events_deleted": 0, "reminders_deleted": 0}
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=SETTINGS.LIFECYCLE_REMOVED_RETENTION_DAYS)
        ).isoformat(timespec="seconds")
        tasks_deleted = self.items_repo.hard_delete_deleted_older_than(item_type="task", cutoff_iso=cutoff)
        events_deleted = self.items_repo.hard_delete_deleted_older_than(item_type="event", cutoff_iso=cutoff)
        reminders_deleted = self.items_repo.hard_delete_deleted_older_than(
            item_type="reminder",
            cutoff_iso=cutoff,
        )
        return {
            "tasks_deleted": tasks_deleted,
            "events_deleted": events_deleted,
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

    def complete_reminder(self, reminder_item_id: str) -> tuple[bool, str]:
        detail = self.reminder_repo.get_reminder_detail(reminder_item_id)
        if detail is None:
            return False, "not found"

        self.reminder_repo.mark_completed(reminder_item_id)
        self.reminder_repo.create_event(
            reminder_item_id=reminder_item_id,
            event_type="completed",
            payload={"parent_item_id": detail.get("parent_item_id")},
        )
        return True, ReminderStatusText.COMPLETED

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

            push_payload = self._build_push_payload(row)
            self._send_web_push(row=row, push_payload=push_payload)
            self._schedule_pushover(row=row, push_payload=push_payload)

            fired.append(row)

        return fired

    def scan_missed_reminders(self) -> list[dict]:
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(hours=SETTINGS.REMINDER_MISSED_SCAN_LOOKBACK_HOURS)
        ).isoformat(timespec="seconds")
        rows = self.reminder_repo.list_missed_candidates(cutoff_iso_value=cutoff)

        missed: list[dict] = []
        for row in rows:
            self.reminder_repo.mark_missed(row["id"])
            self.reminder_repo.create_event(
                reminder_item_id=row["id"],
                event_type="missed",
                payload={"parent_item_id": row.get("parent_item_id")},
            )
            missed_push_payload = self._build_missed_push_payload(row)
            self._send_web_push(row=row, push_payload=missed_push_payload)

            missed.append(row)

        return missed

    def _build_push_payload(self, reminder: dict) -> dict:
        reminder_id = str(reminder.get("id") or "").strip()
        parent_item_id = reminder.get("parent_item_id")
        target_kind = "reminder"
        item_title = str(reminder.get("title") or "").strip()
        due_at = None
        memo = None
        deep_link_path = (
            f"/reminders?mode=fired&reminder_id={reminder_id}" if reminder_id else "/reminders?mode=fired"
        )

        if parent_item_id:
            task = self.task_repo.get_task_detail(parent_item_id)
            if task is not None:
                target_kind = "task"
                item_title = task.get("title") or item_title
                due_at = task.get("due_at")
                memo = task.get("memo")
            elif self.event_repo is not None:
                event = self.event_repo.get_event_detail(parent_item_id)
                if event is not None:
                    target_kind = "event"
                    item_title = event.get("title") or item_title
                    due_at = event.get("start_date")
                    memo = event.get("memo")

        title = build_push_title(target_kind=target_kind)
        message = build_push_body(
            item_title=item_title,
            remind_at=reminder.get("remind_at"),
            due_at=due_at,
            memo=memo,
        )
        return {
            "title": title,
            "message": message,
            "url": self._build_absolute_url(deep_link_path),
            "target_kind": target_kind,
            "badge_count": self._get_attention_badge_count(),
        }

    def _build_missed_push_payload(self, reminder: dict) -> dict:
        payload = self._build_push_payload(reminder)
        payload["title"] = "You have missed reminder"
        return payload

    def _send_web_push(self, *, row: dict, push_payload: dict) -> None:
        if self.push_subscription_repo is None or self.web_push_client is None:
            return
        if not self.web_push_client.is_enabled:
            return

        subscriptions = self.push_subscription_repo.list_all()
        if not subscriptions:
            return

        sent = 0
        removed = 0
        for subscription_row in subscriptions:
            endpoint = str(subscription_row.get("endpoint") or "")
            client_id = str(subscription_row.get("client_id") or "")
            subscription = subscription_row.get("subscription") or {}
            try:
                self.web_push_client.send(
                    subscription_info=subscription,
                    payload_json=json.dumps(
                        {
                            "title": push_payload["title"],
                            "body": push_payload["message"],
                            "url": push_payload["url"] or "/reminders?mode=fired",
                            "badge_count": push_payload.get("badge_count", 0),
                        }
                    ),
                )
                sent += 1
            except Exception as exc:
                details = self.web_push_client.summarize_exception(exc)
                was_removed = False
                if client_id and endpoint and details["is_invalid_subscription"]:
                    was_removed = self.push_subscription_repo.remove(client_id=client_id, endpoint=endpoint)
                    if was_removed:
                        removed += 1
                logger.warning(
                    (
                        "reminder web push send failed: reminder_id=%s client_id=%s endpoint=%s "
                        "exception_type=%s exception_message=%s invalid_subscription=%s removed=%s"
                    ),
                    row.get("id"),
                    client_id,
                    endpoint,
                    details["exception_type"],
                    details["message"],
                    details["is_invalid_subscription"],
                    was_removed,
                )

        logger.info(
            (
                "reminder fired web push result: reminder_id=%s parent_item_id=%s "
                "web_push_sent=%s web_push_removed=%s"
            ),
            row.get("id"),
            row.get("parent_item_id"),
            sent,
            removed,
        )

    def _schedule_pushover(self, *, row: dict, push_payload: dict) -> None:
        delay_seconds = max(0.0, float(SETTINGS.PUSHOVER_DELAY_SECONDS))
        if delay_seconds <= 0:
            self._send_pushover(row=row, push_payload=push_payload)
            return

        timer = threading.Timer(
            delay_seconds,
            self._send_pushover,
            kwargs={"row": row, "push_payload": push_payload},
        )
        timer.daemon = True
        timer.start()

    def _send_pushover(self, *, row: dict, push_payload: dict) -> None:
        send_result = send_pushover(
            title=push_payload["title"],
            message=push_payload["message"],
            url=push_payload["url"],
            url_title="Open" if push_payload["url"] else None,
        )
        self._log_push_result(row=row, send_result=send_result)

    def _build_absolute_url(self, path: str) -> str | None:
        if not SETTINGS.APP_BASE_URL:
            return None
        return SETTINGS.APP_BASE_URL.rstrip("/") + path

    def _log_push_result(self, *, row: dict, send_result: dict) -> None:
        logger.info(
            (
                "reminder fired push result: reminder_id=%s parent_item_id=%s "
                "push_attempted=%s push_succeeded=%s reason=%s"
            ),
            row.get("id"),
            row.get("parent_item_id"),
            bool(send_result.get("attempted")),
            bool(send_result.get("succeeded")),
            send_result.get("reason"),
        )

    def _get_attention_badge_count(self) -> int:
        try:
            return max(0, int(self.reminder_repo.count_attention_reminders()))
        except Exception:
            return 0

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
