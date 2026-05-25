import os


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


DEFAULT_KOREAN_HOLIDAY_ICAL_URL = (
    "https://calendar.google.com/calendar/ical/"
    "ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics"
)


class Settings:
    APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")
    APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Seoul")
    APP_HEALTH_MODE = os.getenv("APP_HEALTH_MODE", "frozen-v0-raw-edit")

    DEFAULT_SNOOZE_MINUTES = int(os.getenv("DEFAULT_SNOOZE_MINUTES", "10"))
    REMINDER_MISSED_SCAN_LOOKBACK_HOURS = int(os.getenv("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", "2"))

    PUSHOVER_ENABLED = _env_bool("PUSHOVER_ENABLED", "false")
    PUSHOVER_APP_TOKEN = os.getenv("PUSHOVER_APP_TOKEN", os.getenv("PUSHOVER_TOKEN", ""))
    PUSHOVER_USER_KEY = os.getenv("PUSHOVER_USER_KEY", "")
    PUSHOVER_DEVICE = os.getenv("PUSHOVER_DEVICE", "").strip()
    PUSHOVER_PRIORITY_DEFAULT = int(os.getenv("PUSHOVER_PRIORITY_DEFAULT", "0"))
    PUSHOVER_EMERGENCY_ENABLED = _env_bool("PUSHOVER_EMERGENCY_ENABLED", "false")
    PUSHOVER_EMERGENCY_RETRY_SECONDS = int(os.getenv("PUSHOVER_EMERGENCY_RETRY_SECONDS", "60"))
    PUSHOVER_EMERGENCY_EXPIRE_SECONDS = int(os.getenv("PUSHOVER_EMERGENCY_EXPIRE_SECONDS", "1800"))

    APP_BASE_URL = os.getenv("APP_BASE_URL", os.getenv("WEB_BASE_URL", ""))
    KOREAN_HOLIDAY_ICAL_URL = os.getenv("KOREAN_HOLIDAY_ICAL_URL", DEFAULT_KOREAN_HOLIDAY_ICAL_URL).strip()

    LIFECYCLE_DONE_RETENTION_DAYS = int(os.getenv("LIFECYCLE_DONE_RETENTION_DAYS", "365"))
    LIFECYCLE_REMOVED_RETENTION_DAYS = int(os.getenv("LIFECYCLE_REMOVED_RETENTION_DAYS", "90"))
    LIFECYCLE_FIRED_RETENTION_DAYS = int(os.getenv("LIFECYCLE_FIRED_RETENTION_DAYS", "30"))

    FILE_STORAGE_DIR = os.getenv("FILE_STORAGE_DIR", "/data/uploads")

    WEB_PUSH_VAPID_PUBLIC_KEY = os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY", "")
    WEB_PUSH_VAPID_PRIVATE_KEY = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY", "")
    WEB_PUSH_SUBJECT = os.getenv("WEB_PUSH_SUBJECT", "mailto:admin@localhost")


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
