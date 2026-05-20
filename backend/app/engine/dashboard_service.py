from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS
from app.engine.event_service import EventService
from app.engine.reminder_service import ReminderService
from app.engine.task_service import TaskService


UPCOMING_EVENT_DAYS = 7


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


class DashboardService:
    def __init__(
        self,
        *,
        event_service: EventService,
        task_service: TaskService,
        reminder_service: ReminderService,
    ) -> None:
        self.event_service = event_service
        self.task_service = task_service
        self.reminder_service = reminder_service

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

        active_tasks = self.task_service.list_tasks(mode="active")
        task_counts = {"overdue": 0, "today": 0, "active_total": len(active_tasks)}
        for task in active_tasks:
            due_date = _local_date_from_iso(task.get("due_at"))
            if due_date is None:
                continue
            if due_date < today:
                task_counts["overdue"] += 1
            elif due_date == today:
                task_counts["today"] += 1

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
