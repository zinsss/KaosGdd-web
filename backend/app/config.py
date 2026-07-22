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
    # App/server
    APP_NAME = _env_str("APP_NAME", "KaosGdd Web")
    APP_TIMEZONE = _env_str("APP_TIMEZONE", "Asia/Seoul")
    APP_HEALTH_MODE = _env_str("APP_HEALTH_MODE", "frozen-v0-raw-edit")
    APP_BASE_URL = _env_str("APP_BASE_URL", os.getenv("WEB_BASE_URL", ""))

    # Reminders / daily summary
    DEFAULT_SNOOZE_MINUTES = _env_int("DEFAULT_SNOOZE_MINUTES", 10)
    REMINDER_MISSED_SCAN_LOOKBACK_HOURS = _env_int("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", 2)
    DAILY_SUMMARY_ENABLED = _env_bool("DAILY_SUMMARY_ENABLED", True)
    DAILY_SUMMARY_SLOT_MORNING = "morning"
    DAILY_SUMMARY_SLOT_LUNCH = "lunch"
    DAILY_SUMMARY_SLOT_BEFORE_OFF = "before-off"
    DAILY_SUMMARY_SLOT_BEFORE_SLEEP = "before-sleep"
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

    # Files/fax
    FILE_STORAGE_DIR = _env_str("FILE_STORAGE_DIR", "/data/uploads")
    FAX_STORAGE_DIR = _env_str("FAX_STORAGE_DIR", os.path.join(FILE_STORAGE_DIR, "fax"))
    FAX_SEND_ENABLED = _env_bool("FAX_SEND_ENABLED", True)
    FAXSERVER = _env_str("FAXSERVER", "")
    FAX_SEND_TIMEOUT_SECONDS = _env_int("FAX_SEND_TIMEOUT_SECONDS", 30, min_value=1)
    FAX_RECV_DIR = _env_str("FAX_RECV_DIR", "/var/spool/hylafax/recvq")
    FAX_DONEQ_DIR = _env_str("FAX_DONEQ_DIR", "/var/spool/hylafax/doneq")
    FAX_INBOX_RETENTION_DAYS = _env_int("FAX_INBOX_RETENTION_DAYS", 90, min_value=1)

    # Push / Web Push
    WEB_PUSH_VAPID_PUBLIC_KEY = _env_str("WEB_PUSH_VAPID_PUBLIC_KEY", "")
    WEB_PUSH_VAPID_PRIVATE_KEY = _env_str("WEB_PUSH_VAPID_PRIVATE_KEY", "")
    WEB_PUSH_SUBJECT = _env_str("WEB_PUSH_SUBJECT", "mailto:admin@localhost")

    # Pushover
    PUSHOVER_ENABLED = _env_bool("PUSHOVER_ENABLED", False)
    PUSHOVER_APP_TOKEN = _env_str("PUSHOVER_APP_TOKEN", os.getenv("PUSHOVER_TOKEN", ""))
    PUSHOVER_USER_KEY = _env_str("PUSHOVER_USER_KEY", "")
    PUSHOVER_DEVICE = _env_str("PUSHOVER_DEVICE", "")
    PUSHOVER_PRIORITY_DEFAULT = _env_int("PUSHOVER_PRIORITY_DEFAULT", 0)
    PUSHOVER_EMERGENCY_ENABLED = _env_bool("PUSHOVER_EMERGENCY_ENABLED", False)
    PUSHOVER_EMERGENCY_RETRY_SECONDS = _env_int("PUSHOVER_EMERGENCY_RETRY_SECONDS", 60)
    PUSHOVER_EMERGENCY_EXPIRE_SECONDS = _env_int("PUSHOVER_EMERGENCY_EXPIRE_SECONDS", 1800)

    # NTFY
    NTFY_ENABLED = _env_bool("NTFY_ENABLED", False)
    NTFY_BASE_URL = _env_str("NTFY_BASE_URL", "")
    NTFY_TOPIC = _env_str("NTFY_TOPIC", "")
    NTFY_TOKEN = _env_str("NTFY_TOKEN", "")
    NTFY_USERNAME = _env_str("NTFY_USERNAME", "")
    NTFY_PASSWORD = _env_str("NTFY_PASSWORD", "")

    # Lifecycle / retention
    LIFECYCLE_DONE_RETENTION_DAYS = _env_int("LIFECYCLE_DONE_RETENTION_DAYS", 365)
    LIFECYCLE_REMOVED_RETENTION_DAYS = _env_int("LIFECYCLE_REMOVED_RETENTION_DAYS", 90)
    LIFECYCLE_FIRED_RETENTION_DAYS = _env_int("LIFECYCLE_FIRED_RETENTION_DAYS", 30)

    # Weather/calendar
    KOREAN_HOLIDAY_ICAL_URL = _env_str("KOREAN_HOLIDAY_ICAL_URL", DEFAULT_KOREAN_HOLIDAY_ICAL_URL)


SETTINGS = Settings()


class DbTables:
    # Core items
    ITEMS = "items"
    TASK_ITEMS = "task_items"
    TASK_SUBTASKS = "task_subtasks"
    TASK_RECURRENCE_HISTORY = "task_recurrence_history"
    EVENT_ITEMS = "event_items"
    JOURNAL_ITEMS = "journal_items"
    NOTE_ITEMS = "note_items"
    SCRIBBLES = "scribbles"
    ITEM_TAGS = "item_tags"
    ITEM_LINKS = "item_links"

    # Reminders/push
    REMINDER_ITEMS = "reminder_items"
    REMINDER_EVENTS = "reminder_events"
    ITEM_REMINDERS = "item_reminders"
    PUSH_SUBSCRIPTIONS = "push_subscriptions"
    PUSH_TEST_DIAGNOSTICS = "push_test_diagnostics"
    PUSH_TASK_OVERDUE_STATE = "push_task_overdue_state"
    PUSH_EVENT_DEDUPE = "push_event_dedupe"
    NOTIFICATION_PREFERENCES = "notification_preferences"

    # Files/fax
    FILE_ITEMS = "file_items"
    FAX_ITEMS = "fax_items"

    # Supplies/weather
    SUPPLY_ITEMS = "supply_items"
    SUPPLY_PRESETS = "supply_presets"
    FAMILY_RECORDS = "family_records"
    WEATHER_LOCATIONS = "weather_locations"
    WEATHER_CACHE = "weather_cache"
    WEATHER_DAILY_SNAPSHOTS = "weather_daily_snapshots"
