from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS
from app.engine.event_service import EventService
from app.engine.file_service import FileService
from app.engine.reminder_service import ReminderService
from app.engine.supply_service import SupplyService
from app.engine.task_service import TaskService


UPCOMING_EVENT_DAYS = 7
WIDGET_EVENT_TITLE_LIMIT = 5


def _local_now() -> datetime:
    try:
        return datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE))
    except Exception:
        return datetime.now(timezone.utc)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except Exception:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _local_date_from_iso(value: str | None) -> date | None:
    parsed = _parse_datetime(value)
    if parsed is None:
        return None
    try:
        return parsed.astimezone(ZoneInfo(SETTINGS.APP_TIMEZONE)).date()
    except Exception:
        return parsed.astimezone(timezone.utc).date()


def _dashboard_event(event: dict) -> dict:
    return {
        "id": event.get("id"),
        "title": event.get("title"),
        "start_date": event.get("start_date"),
        "end_date": event.get("end_date"),
        "event_class": event.get("event_class"),
        "repeat_rule": event.get("repeat_rule"),
        "occurrence_id": event.get("occurrence_id"),
        "canonical_event_id": event.get("canonical_event_id"),
        "is_recurring_event": bool(event.get("is_recurring_event")),
        "is_recurring_occurrence": bool(event.get("is_recurring_occurrence")),
        "is_imported_calendar_event": bool(event.get("is_imported_calendar_event")),
        "is_custom_calendar_event": bool(event.get("is_custom_calendar_event")),
        "is_readonly_system_event": bool(event.get("is_readonly_system_event")),
    }


def _dashboard_reminder(reminder: dict) -> dict:
    return {
        "id": reminder.get("id"),
        "title": reminder.get("title"),
        "remind_at": reminder.get("remind_at"),
        "remind_at_display": reminder.get("remind_at_display"),
        "state": reminder.get("state"),
        "parent_item_id": reminder.get("parent_item_id"),
        "parent_item_title": reminder.get("parent_item_title"),
        "parent_item_type": reminder.get("parent_item_type"),
    }


def _task_counts(active_tasks: list[dict], today: date) -> dict:
    task_counts = {"overdue": 0, "today": 0, "active_total": len(active_tasks)}
    for task in active_tasks:
        due_date = _local_date_from_iso(task.get("due_at"))
        if due_date is None:
            continue
        if due_date < today:
            task_counts["overdue"] += 1
        elif due_date == today:
            task_counts["today"] += 1
    return task_counts


class DashboardService:
    def __init__(
        self,
        *,
        event_service: EventService,
        task_service: TaskService,
        reminder_service: ReminderService,
        supply_service: SupplyService | None = None,
        file_service: FileService | None = None,
    ) -> None:
        self.event_service = event_service
        self.task_service = task_service
        self.reminder_service = reminder_service
        self.supply_service = supply_service
        self.file_service = file_service

    def get_dashboard(self, *, upcoming_days: int = UPCOMING_EVENT_DAYS) -> dict:
        now = _local_now()
        today = now.date()
        window_end = today + timedelta(days=max(int(upcoming_days or UPCOMING_EVENT_DAYS), 1))

        events = self.event_service.list_events_in_range(
            start_date=today.isoformat(),
            end_date=window_end.isoformat(),
            mode="active",
        )
        today_events = [
            event for event in events
            if event.get("start_date") <= today.isoformat() <= (event.get("end_date") or event.get("start_date"))
        ]
        upcoming_events = [
            event for event in events
            if event.get("start_date") and event.get("start_date") > today.isoformat()
        ]

        task_counts = _task_counts(self.task_service.list_tasks(mode="active"), today)

        active_reminders = self.reminder_service.list_reminders(mode="active")
        today_reminders = [
            reminder for reminder in active_reminders
            if _local_date_from_iso(reminder.get("remind_at")) == today
        ]

        today_classes = {event.get("event_class") for event in today_events}
        return {
            "date": today.isoformat(),
            "date_display": now.strftime("%Y.%m.%d %a"),
            "today_events": [_dashboard_event(event) for event in today_events],
            "upcoming_events": [_dashboard_event(event) for event in upcoming_events],
            "task_counts": task_counts,
            "today_reminders": [_dashboard_reminder(reminder) for reminder in today_reminders],
            "flags": {
                "is_public_holiday": "public-holiday" in today_classes,
                "is_market_saturday": "market-saturday" in today_classes,
                "is_claim_day": "claim-day" in today_classes,
            },
        }

    def get_widget_summary(self) -> dict:
        now = _local_now()
        today = now.date()
        today_iso = today.isoformat()

        events = self.event_service.list_events_in_range(
            start_date=today_iso,
            end_date=today_iso,
            mode="active",
        )
        today_events = [
            event for event in events
            if event.get("start_date") <= today_iso <= (event.get("end_date") or event.get("start_date"))
        ]
        event_titles = [
            str(event.get("title") or "").strip()
            for event in today_events
            if str(event.get("title") or "").strip()
        ][:WIDGET_EVENT_TITLE_LIMIT]

        active_reminders = self.reminder_service.list_reminders(mode="active")
        today_reminder_count = sum(
            1
            for reminder in active_reminders
            if _local_date_from_iso(reminder.get("remind_at")) == today
        )
        missed_reminder_count = sum(
            1
            for reminder in active_reminders
            if reminder.get("state") == "missed"
        )
        fired_reminder_count = sum(
            1
            for reminder in self.reminder_service.list_reminders(mode="fired")
            if reminder.get("state") == "fired"
        )

        active_supplies = self.supply_service.list_supplies(mode="active") if self.supply_service is not None else []
        active_files = self.file_service.list_files(mode="active") if self.file_service is not None else []
        active_faxes = [file_item for file_item in active_files if str(file_item.get("fax_number") or "").strip()]

        today_classes = {event.get("event_class") for event in today_events}
        return {
            "date": now.strftime("%Y.%m.%d %a"),
            "tasks": _task_counts(self.task_service.list_tasks(mode="active"), today),
            "reminders": {
                "today": today_reminder_count,
                "missed": missed_reminder_count,
                "fired": fired_reminder_count,
            },
            "events_today": event_titles,
            "supplies": {
                "active_total": len(active_supplies),
            },
            "fax": {
                "active_total": len(active_faxes),
                "attention": 0,
            },
            "flags": {
                "public_holiday": "public-holiday" in today_classes,
                "market_day": "market-saturday" in today_classes,
                "claim_day": "claim-day" in today_classes,
            },
        }
