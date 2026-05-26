import os
import re

from app.strings import DailySummaryText


def _env_bool(name: str, default: bool | str = False) -> bool:
    raw_default = "true" if default is True else "false" if default is False else str(default)
    return os.getenv(name, raw_default).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, min_value: int | None = None, max_value: int | None = None) -> int:
    try:
        value = int(str(os.getenv(name, str(default))).strip())
    except (TypeError, ValueError):
        return default
    if min_value is not None and value < min_value:
        return default
    if max_value is not None and value > max_value:
        return default
    return value


def _env_str(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_hhmm(name: str, default: str) -> str:
    value = _env_str(name, default)
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
        return default
    return value


DEFAULT_KOREAN_HOLIDAY_ICAL_URL = (
    "https://calendar.google.com/calendar/ical/"
    "ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics"
)


class Settings:
    APP_NAME = _env_str("APP_NAME", "KaosGdd Web")
    APP_TIMEZONE = _env_str("APP_TIMEZONE", "Asia/Seoul")
    APP_HEALTH_MODE = _env_str("APP_HEALTH_MODE", "frozen-v0-raw-edit")

    DEFAULT_SNOOZE_MINUTES = _env_int("DEFAULT_SNOOZE_MINUTES", 10)
    REMINDER_MISSED_SCAN_LOOKBACK_HOURS = _env_int("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", 2)

    DAILY_SUMMARY_ENABLED = _env_bool("DAILY_SUMMARY_ENABLED", True)
    DAILY_SUMMARY_SLOT_MORNING = _env_str("DAILY_SUMMARY_SLOT_MORNING", "morning")
    DAILY_SUMMARY_SLOT_LUNCH = _env_str("DAILY_SUMMARY_SLOT_LUNCH", "lunch")
    DAILY_SUMMARY_SLOT_BEFORE_OFF = _env_str("DAILY_SUMMARY_SLOT_BEFORE_OFF", "before-off")
    DAILY_SUMMARY_SLOT_BEFORE_SLEEP = _env_str("DAILY_SUMMARY_SLOT_BEFORE_SLEEP", "before-sleep")
    DAILY_SUMMARY_MORNING_TIME = _env_hhmm("DAILY_SUMMARY_MORNING_TIME", "08:30")
    DAILY_SUMMARY_LUNCH_TIME = _env_hhmm("DAILY_SUMMARY_LUNCH_TIME", "13:05")
    DAILY_SUMMARY_BEFORE_OFF_TIME = _env_hhmm("DAILY_SUMMARY_BEFORE_OFF_TIME", "17:15")
    DAILY_SUMMARY_BEFORE_SLEEP_TIME = _env_hhmm("DAILY_SUMMARY_BEFORE_SLEEP_TIME", "22:00")
    DAILY_SUMMARY_BODY_MAX_LINES = _env_int("DAILY_SUMMARY_BODY_MAX_LINES", 3, min_value=1)
    DAILY_SUMMARY_FLAGS_FIRST = _env_bool("DAILY_SUMMARY_FLAGS_FIRST", True)

    DAILY_SUMMARY_SLOTS = {
        DAILY_SUMMARY_SLOT_MORNING: DailySummaryText.MORNING_TITLE,
        DAILY_SUMMARY_SLOT_LUNCH: DailySummaryText.LUNCH_TITLE,
        DAILY_SUMMARY_SLOT_BEFORE_OFF: DailySummaryText.BEFORE_OFF_TITLE,
        DAILY_SUMMARY_SLOT_BEFORE_SLEEP: DailySummaryText.BEFORE_SLEEP_TITLE,
    }

    PUSHOVER_ENABLED = _env_bool("PUSHOVER_ENABLED", False)
    PUSHOVER_APP_TOKEN = _env_str("PUSHOVER_APP_TOKEN", os.getenv("PUSHOVER_TOKEN", ""))
    PUSHOVER_USER_KEY = _env_str("PUSHOVER_USER_KEY", "")
    PUSHOVER_DEVICE = _env_str("PUSHOVER_DEVICE", "")
    PUSHOVER_PRIORITY_DEFAULT = _env_int("PUSHOVER_PRIORITY_DEFAULT", 0)
    PUSHOVER_EMERGENCY_ENABLED = _env_bool("PUSHOVER_EMERGENCY_ENABLED", False)
    PUSHOVER_EMERGENCY_RETRY_SECONDS = _env_int("PUSHOVER_EMERGENCY_RETRY_SECONDS", 60)
    PUSHOVER_EMERGENCY_EXPIRE_SECONDS = _env_int("PUSHOVER_EMERGENCY_EXPIRE_SECONDS", 1800)

    APP_BASE_URL = _env_str("APP_BASE_URL", os.getenv("WEB_BASE_URL", ""))
    KOREAN_HOLIDAY_ICAL_URL = _env_str("KOREAN_HOLIDAY_ICAL_URL", DEFAULT_KOREAN_HOLIDAY_ICAL_URL)

    LIFECYCLE_DONE_RETENTION_DAYS = _env_int("LIFECYCLE_DONE_RETENTION_DAYS", 365)
    LIFECYCLE_REMOVED_RETENTION_DAYS = _env_int("LIFECYCLE_REMOVED_RETENTION_DAYS", 90)
    LIFECYCLE_FIRED_RETENTION_DAYS = _env_int("LIFECYCLE_FIRED_RETENTION_DAYS", 30)

    FILE_STORAGE_DIR = _env_str("FILE_STORAGE_DIR", "/data/uploads")

    WEB_PUSH_VAPID_PUBLIC_KEY = _env_str("WEB_PUSH_VAPID_PUBLIC_KEY", "")
    WEB_PUSH_VAPID_PRIVATE_KEY = _env_str("WEB_PUSH_VAPID_PRIVATE_KEY", "")
    WEB_PUSH_SUBJECT = _env_str("WEB_PUSH_SUBJECT", "mailto:admin@localhost")


SETTINGS = Settings()


class DbTables:
    ITEMS = "items"
    SUPPLY_ITEMS = "supply_items"
    SUPPLY_PRESETS = "supply_presets"
    TASK_ITEMS = "task_items"
    TASK_SUBTASKS = "task_subtasks"
    TASK_RECURRENCE_HISTORY = "task_recurrence_history"
    REMINDER_ITEMS = "reminder_items"
    EVENT_ITEMS = "event_items"
    JOURNAL_ITEMS = "journal_items"
    NOTE_ITEMS = "note_items"
    FILE_ITEMS = "file_items"
    REMINDER_EVENTS = "reminder_events"
    ITEM_REMINDERS = "item_reminders"
    ITEM_TAGS = "item_tags"
    ITEM_LINKS = "item_links"
    PUSH_SUBSCRIPTIONS = "push_subscriptions"
    PUSH_TEST_DIAGNOSTICS = "push_test_diagnostics"
    PUSH_TASK_OVERDUE_STATE = "push_task_overdue_state"
    PUSH_EVENT_DEDUPE = "push_event_dedupe"
    SCRIBBLES = "scribbles"
