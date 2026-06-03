from datetime import datetime, timedelta, timezone
import json
import logging
import re

from app.config import SETTINGS
from app.db.repo.push_policy_repo import (
    DEFAULT_NOTIFICATION_MODE,
    NOTIFICATION_CHANNEL_NORMAL,
    NOTIFICATION_CHANNEL_SYSTEM,
    NOTIFICATION_CHANNEL_URGENT,
    NOTIFICATION_MODE_HYBRID,
    NOTIFICATION_MODE_PUSHOVER_ONLY,
    NOTIFICATION_MODE_WEB_PUSH_ONLY,
    NOTIFICATION_PUSHOVER_HYBRID_CHANNELS,
)
from app.db.repo.event_repo import EventRepo
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.repo.supply_repo import SupplyRepo
from app.db.repo.task_repo import TaskRepo
from app.integrations import pushover_client
from app.integrations.push_format import build_push_body, build_push_title
from app.strings import ApiText, FaxNotificationText, PushText, ReminderStatusText
from app.utils.clock import now_iso
from app.utils.datetime_parse import parse_local_datetime_to_iso
from app.utils.timefmt import format_dt_for_ui

logger = logging.getLogger(__name__)


PUSHOVER_MESSAGE_LIMIT_BYTES = 1024
PUSHOVER_MESSAGE_TARGET_BYTES = 900
PUSHOVER_TRUNCATION_SUFFIX = "..."


class ReminderService:
    def __init__(
        self,
        reminder_repo: ReminderRepo,
        task_repo: TaskRepo,
        event_repo: EventRepo | None = None,
        items_repo: ItemsRepo | None = None,
        supply_repo: SupplyRepo | None = None,
        push_subscription_repo=None,
        web_push_client=None,
        push_policy_repo=None,
    ) -> None:
        self.reminder_repo = reminder_repo
        self.task_repo = task_repo
        self.event_repo = event_repo
        self.items_repo = items_repo
        self.supply_repo = supply_repo
        self.push_subscription_repo = push_subscription_repo
        self.web_push_client = web_push_client
        self.push_policy_repo = push_policy_repo

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
            return False, ApiText.TITLE_REQUIRED, None

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
            raise ValueError(ApiText.REMINDER_EMPTY)

        if not text.startswith("!!"):
            raise ValueError(ApiText.STANDALONE_REMINDER_PREFIX_REQUIRED)

        body = text[2:].strip()
        if not body:
            raise ValueError(ApiText.REMINDER_BODY_REQUIRED)

        lines = [line.strip() for line in body.split("\n") if line.strip()]
        if not lines:
            raise ValueError(ApiText.REMINDER_BODY_REQUIRED)

        tags: list[str] = []
        linked_item_ids: list[str] = []

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
                linked_item_ids.append(line[2:].strip())
                continue
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
            "linked_item_ids": linked_item_ids,
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
        if self.items_repo is not None:
            linked_item_ids = self.items_repo.list_item_links(reminder_item_id)
            for linked_item_id in linked_item_ids:
                lines.append(f"l:{linked_item_id}")
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
            self.items_repo.replace_item_links(reminder_item_id, list(parsed.get("linked_item_ids") or []))

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
            self._send_notification(
                channel=NOTIFICATION_CHANNEL_NORMAL,
                row=row,
                push_payload=push_payload,
                pushover_title=push_payload["title"],
                pushover_message=push_payload["message"],
            )

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
            self._send_notification(
                channel=NOTIFICATION_CHANNEL_URGENT,
                row=row,
                push_payload=missed_push_payload,
                pushover_title="KaosGdd missed reminder",
                pushover_message=self._build_missed_reminder_pushover_message(
                    row,
                    open_url=missed_push_payload.get("url"),
                ),
            )

            missed.append(row)

        return missed

    def scan_task_overdue_pushes(self) -> list[dict]:
        if self.push_policy_repo is None:
            return []

        now_utc = datetime.now(timezone.utc)
        previous_state = self.push_policy_repo.list_task_overdue_state()
        pushed: list[dict] = []

        for task in self.task_repo.list_tasks_active():
            task_id = str(task.get("id") or "").strip()
            due_at = str(task.get("due_at") or "").strip() or None
            if not task_id:
                continue

            is_overdue = self._is_task_due_at_overdue(due_at, now_utc)
            prev = previous_state.get(task_id, {})
            prev_due_at = str(prev.get("last_due_at") or "").strip() or None
            prev_is_overdue = bool(prev.get("last_is_overdue"))

            became_overdue = is_overdue and (not prev_is_overdue or prev_due_at != due_at)
            if became_overdue:
                push_payload = {
                    "title": PushText.TASK_OVERDUE_TITLE,
                    "message": str(task.get("title") or PushText.TASK_FALLBACK_TITLE).strip()
                    or PushText.TASK_OVERDUE_MESSAGE,
                    "url": self._build_absolute_url(f"/tasks/{task_id}"),
                    "badge_count": self._get_attention_badge_count(),
                    "has_app_attention": True,
                }
                self._send_notification(
                    channel=NOTIFICATION_CHANNEL_URGENT,
                    row={"id": task_id, "parent_item_id": task_id},
                    push_payload=push_payload,
                    pushover_title="KaosGdd task overdue",
                    pushover_message=self._build_task_overdue_pushover_message(
                        task=task,
                        open_url=push_payload.get("url"),
                    ),
                )
                pushed.append({"task_id": task_id, "due_at": due_at})

            self.push_policy_repo.upsert_task_overdue_state(
                task_item_id=task_id,
                due_at=due_at,
                is_overdue=is_overdue,
            )

        return pushed

    def notify_fax_received(self, *, fax_id: str, title: str | None = None, event_id: str | None = None) -> bool:
        return self._notify_fax_event(
            fax_id=fax_id,
            title=title,
            event_id=event_id,
            event_type="fax_received",
            channel=NOTIFICATION_CHANNEL_NORMAL,
            push_title=FaxNotificationText.RECEIVED_TITLE,
        )

    def notify_fax_send_failed(
        self,
        *,
        fax_id: str,
        title: str | None = None,
        event_id: str | None = None,
        target: str | None = None,
        error_message: str | None = None,
    ) -> bool:
        return self._notify_fax_event(
            fax_id=fax_id,
            title=title,
            event_id=event_id,
            event_type="fax_send_failed",
            channel=NOTIFICATION_CHANNEL_SYSTEM,
            push_title=FaxNotificationText.SEND_FAILED_TITLE,
            pushover_title=FaxNotificationText.SEND_FAILED_PUSHOVER_TITLE,
            pushover_message=self._build_fax_failed_pushover_message(
                fax_id=fax_id,
                title=title,
                target=target,
                error_message=error_message,
            ),
        )

    def _notify_fax_event(
        self,
        *,
        fax_id: str,
        title: str | None,
        event_id: str | None,
        event_type: str,
        channel: str,
        push_title: str,
        pushover_title: str | None = None,
        pushover_message: str | None = None,
    ) -> bool:
        if self.push_policy_repo is None:
            return False

        clean_fax_id = str(fax_id or "").strip()
        if not clean_fax_id:
            return False

        clean_event_id = str(event_id or "").strip()
        dedupe_key = f"{event_type}:{clean_event_id or clean_fax_id}"
        should_send = self.push_policy_repo.record_event_once(event_key=dedupe_key, event_type=event_type)
        if not should_send:
            return False

        display_title = str(title or "").strip() or f"Fax {clean_fax_id}"
        push_payload = {
            "title": push_title,
            "message": display_title,
            "url": self._build_absolute_url("/fax"),
            "badge_count": self._get_attention_badge_count(),
            "has_app_attention": True,
        }
        self._send_notification(
            channel=channel,
            row={"id": clean_fax_id, "parent_item_id": None},
            push_payload=push_payload,
            pushover_title=pushover_title or f"KaosGdd {push_title.lower()}",
            pushover_message=pushover_message or display_title,
        )
        return True

    def _build_missed_reminder_pushover_message(self, reminder: dict, *, open_url: str | None = None) -> str:
        context = self._resolve_notification_target_context(reminder)
        lines = self._build_item_pushover_lines(
            item_type=context["item_type"],
            title=context["title"],
            state="missed",
            due_at=context.get("due_at"),
            remind_at=reminder.get("remind_at"),
            tags=context.get("tags") or [],
            memo=context.get("memo"),
            open_url=open_url,
        )
        return self._fit_pushover_message(lines)

    def _send_pushover_emergency(self, *, title: str, message: str, url: str | None = None) -> None:
        try:
            result = pushover_client.send_pushover_emergency(title=title, message=message, url=url, monospace=True)
        except Exception as exc:
            logger.warning("pushover emergency escalation exception: %s", exc)
            return
        if result.get("attempted") and not result.get("succeeded"):
            logger.warning("pushover emergency escalation failed: reason=%s", result.get("reason"))

    def _notification_mode(self) -> str:
        if self.push_policy_repo is None:
            return DEFAULT_NOTIFICATION_MODE
        try:
            preferences = self.push_policy_repo.get_notification_preferences()
        except Exception as exc:
            logger.warning("notification preferences unavailable: %s", exc)
            return DEFAULT_NOTIFICATION_MODE
        return str(preferences.get("mode") or DEFAULT_NOTIFICATION_MODE)

    def _notification_should_send_web_push(self, *, channel: str) -> bool:
        mode = self._notification_mode()
        if mode == NOTIFICATION_MODE_WEB_PUSH_ONLY:
            return True
        if mode == NOTIFICATION_MODE_PUSHOVER_ONLY:
            return False
        if mode == NOTIFICATION_MODE_HYBRID:
            return channel == NOTIFICATION_CHANNEL_NORMAL
        return True

    def _notification_should_send_pushover(self, *, channel: str) -> bool:
        mode = self._notification_mode()
        if mode == NOTIFICATION_MODE_WEB_PUSH_ONLY:
            return False
        if mode == NOTIFICATION_MODE_PUSHOVER_ONLY:
            return True
        if mode == NOTIFICATION_MODE_HYBRID:
            return channel in NOTIFICATION_PUSHOVER_HYBRID_CHANNELS
        return False

    def _send_notification(
        self,
        *,
        channel: str,
        row: dict,
        push_payload: dict,
        pushover_title: str,
        pushover_message: str,
    ) -> None:
        if self._notification_should_send_web_push(channel=channel):
            self._send_web_push(row=row, push_payload=push_payload)
        if self._notification_should_send_pushover(channel=channel):
            self._send_pushover_emergency(
                title=pushover_title,
                message=pushover_message,
                url=push_payload.get("url"),
            )

    def _resolve_notification_target_context(self, reminder: dict) -> dict:
        parent_item_id = reminder.get("parent_item_id")
        context = {
            "item_type": "reminder",
            "title": str(reminder.get("title") or "").strip() or "Reminder",
            "due_at": None,
            "memo": None,
            "tags": [],
        }

        if parent_item_id:
            task = self.task_repo.get_task_detail(parent_item_id)
            if task is not None:
                context = {
                    "item_type": "task",
                    "title": str(task.get("title") or context["title"]).strip() or context["title"],
                    "due_at": task.get("due_at"),
                    "memo": task.get("memo"),
                    "tags": self._list_item_tags(parent_item_id),
                }
            elif self.event_repo is not None:
                event = self.event_repo.get_event_detail(parent_item_id)
                if event is not None:
                    context = {
                        "item_type": "event",
                        "title": str(event.get("title") or context["title"]).strip() or context["title"],
                        "due_at": event.get("start_date"),
                        "memo": event.get("memo"),
                        "tags": self._list_item_tags(parent_item_id),
                    }
        else:
            reminder_id = reminder.get("id")
            if reminder_id:
                context["tags"] = self._list_item_tags(reminder_id)

        return context

    def _build_task_overdue_pushover_message(self, *, task: dict, open_url: str | None = None) -> str:
        lines = self._build_item_pushover_lines(
            item_type="task",
            title=str(task.get("title") or PushText.TASK_FALLBACK_TITLE).strip() or PushText.TASK_FALLBACK_TITLE,
            state="overdue",
            due_at=task.get("due_at"),
            remind_at=None,
            tags=self._list_item_tags(task.get("id")),
            memo=task.get("memo"),
            open_url=open_url,
        )
        return self._fit_pushover_message(lines)

    def _build_item_pushover_lines(
        self,
        *,
        item_type: str,
        title: str,
        state: str,
        due_at: str | None,
        remind_at: str | None,
        tags: list[str],
        memo: str | None,
        open_url: str | None,
    ) -> list[str]:
        lines = [f"{str(item_type or 'item').upper()} • {str(title or '').strip() or 'Reminder'}"]
        lines.append(self._format_pushover_field("State", state))

        due_display = format_dt_for_ui(due_at) or str(due_at or "").strip()
        if due_display:
            lines.append(self._format_pushover_field("Due", due_display))

        remind_display = format_dt_for_ui(remind_at) or str(remind_at or "").strip()
        if remind_display:
            lines.append(self._format_pushover_field("Reminder", remind_display))

        clean_tags = [f"#{str(tag).lstrip('#')}" for tag in tags if str(tag or "").strip()]
        if clean_tags:
            lines.append(self._format_pushover_field("Tags", " ".join(clean_tags)))

        memo_text = str(memo or "").strip()
        if memo_text:
            lines.extend(["Memo", memo_text])

        if open_url:
            lines.extend(["Open", open_url])

        return lines

    def _build_fax_failed_pushover_message(
        self,
        *,
        fax_id: str,
        title: str | None = None,
        target: str | None = None,
        error_message: str | None = None,
    ) -> str:
        clean_target = str(target or "").strip()
        clean_title = str(title or "").strip() or str(fax_id or "").strip()
        clean_reason = str(error_message or "").strip()
        lines = [FaxNotificationText.SEND_FAILED_HEADER]
        if clean_target:
            lines.append(self._format_pushover_field("Target", clean_target))
        if clean_title:
            lines.append(self._format_pushover_field("File", clean_title))
        lines.append(self._format_pushover_field("Status", "failed"))
        if clean_reason:
            lines.append(self._format_pushover_field("Reason", clean_reason))
        open_url = self._build_absolute_url("/fax")
        if open_url:
            lines.extend(["Open", open_url])
        return self._fit_pushover_message(lines)

    def _format_pushover_field(self, label: str, value: str) -> str:
        return f"{label:<8} │ {value}"

    def _list_item_tags(self, item_id: str | None) -> list[str]:
        if self.items_repo is None or not item_id:
            return []
        try:
            return self.items_repo.list_item_tags(str(item_id))
        except Exception:
            return []

    def _fit_pushover_message(self, lines: list[str]) -> str:
        message = "\n".join(str(line).rstrip() for line in lines if str(line).strip())
        if self._utf8_len(message) <= PUSHOVER_MESSAGE_TARGET_BYTES:
            return message

        open_block: list[str] = []
        if len(lines) >= 2 and str(lines[-2]).strip() == "Open":
            open_block = [str(lines[-2]).rstrip(), str(lines[-1]).rstrip()]
            lines = lines[:-2]

        fitted_lines = list(lines)
        while fitted_lines:
            candidate_lines = fitted_lines + open_block
            candidate = "\n".join(str(line).rstrip() for line in candidate_lines if str(line).strip())
            if self._utf8_len(candidate) <= PUSHOVER_MESSAGE_LIMIT_BYTES:
                return candidate
            last = str(fitted_lines[-1])
            next_last = self._truncate_utf8(last, max(0, self._utf8_len(last) - 128))
            if next_last == last or len(next_last) <= len(PUSHOVER_TRUNCATION_SUFFIX):
                fitted_lines.pop()
            else:
                fitted_lines[-1] = next_last

        return self._truncate_utf8("\n".join(open_block), PUSHOVER_MESSAGE_LIMIT_BYTES)

    def _truncate_utf8(self, value: str, max_bytes: int) -> str:
        if max_bytes <= 0:
            return ""
        raw = str(value or "")
        if self._utf8_len(raw) <= max_bytes:
            return raw
        suffix = PUSHOVER_TRUNCATION_SUFFIX
        suffix_bytes = self._utf8_len(suffix)
        budget = max(0, max_bytes - suffix_bytes)
        output = []
        used = 0
        for char in raw:
            char_len = self._utf8_len(char)
            if used + char_len > budget:
                break
            output.append(char)
            used += char_len
        return "".join(output).rstrip() + suffix

    def _utf8_len(self, value: str) -> int:
        return len(str(value or "").encode("utf-8"))

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
        has_app_attention = self._has_app_attention()
        return {
            "title": title,
            "message": message,
            "url": self._build_absolute_url(deep_link_path),
            "target_kind": target_kind,
            "badge_count": 1 if has_app_attention else 0,
            "has_app_attention": has_app_attention,
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
                            "has_app_attention": bool(push_payload.get("has_app_attention", False)),
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

    def _build_absolute_url(self, path: str) -> str | None:
        if not SETTINGS.APP_BASE_URL:
            return None
        return SETTINGS.APP_BASE_URL.rstrip("/") + path

    def _get_attention_badge_count(self) -> int:
        try:
            return 1 if self._has_app_attention() else 0
        except Exception:
            return 0

    def _has_app_attention(self) -> bool:
        now_utc = datetime.now(timezone.utc)

        has_overdue_tasks = any(
            self._is_task_due_at_overdue(task.get("due_at"), now_utc) for task in self.task_repo.list_tasks_active()
        )

        has_missed_reminders = any(
            (reminder.get("state") or "").strip().lower() == "missed"
            for reminder in self.reminder_repo.list_reminders_active()
        )
        has_pending_supplies = bool(self.supply_repo and self.supply_repo.list_active())

        return any(
            [
                has_overdue_tasks,
                has_missed_reminders,
                has_pending_supplies,
                False,  # has_note_draft
                False,  # has_file_draft
                False,  # has_attention_fax
            ]
        )

    def _is_task_due_at_overdue(self, due_at: str | None, now_utc: datetime) -> bool:
        if not due_at:
            return False
        clean_due_at = str(due_at).strip()
        if not clean_due_at:
            return False

        try:
            parsed_due = datetime.fromisoformat(clean_due_at.replace("Z", "+00:00"))
            if parsed_due.tzinfo is None:
                parsed_due = parsed_due.replace(tzinfo=timezone.utc)
            else:
                parsed_due = parsed_due.astimezone(timezone.utc)
            return parsed_due < now_utc
        except ValueError:
            return False

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
