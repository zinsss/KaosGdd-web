import os


class Settings:
    APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")
    APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Seoul")
    APP_HEALTH_MODE = os.getenv("APP_HEALTH_MODE", "frozen-v0-raw-edit")

    DEFAULT_SNOOZE_MINUTES = int(os.getenv("DEFAULT_SNOOZE_MINUTES", "10"))
    REMINDER_MISSED_SCAN_LOOKBACK_HOURS = int(os.getenv("REMINDER_MISSED_SCAN_LOOKBACK_HOURS", "2"))

    PUSHOVER_ENABLED = os.getenv("PUSHOVER_ENABLED", "0") == "1"
    PUSHOVER_APP_TOKEN = os.getenv("PUSHOVER_APP_TOKEN", os.getenv("PUSHOVER_TOKEN", ""))
    PUSHOVER_USER_KEY = os.getenv("PUSHOVER_USER_KEY", "")
    PUSHOVER_DEVICE = os.getenv("PUSHOVER_DEVICE", "").strip()
    PUSHOVER_PRIORITY_DEFAULT = int(os.getenv("PUSHOVER_PRIORITY_DEFAULT", "0"))
    PUSHOVER_DELAY_SECONDS = float(os.getenv("PUSHOVER_DELAY_SECONDS", "5"))

    APP_BASE_URL = os.getenv("APP_BASE_URL", os.getenv("WEB_BASE_URL", ""))

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
    TASK_ITEMS = "task_items"
    TASK_SUBTASKS = "task_subtasks"
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
