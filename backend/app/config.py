import os


class Settings:
    APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")
    APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Seoul")
    DEFAULT_SNOOZE_MINUTES = int(os.getenv("DEFAULT_SNOOZE_MINUTES", "10"))

    PUSHOVER_ENABLED = os.getenv("PUSHOVER_ENABLED", "0") == "1"
    PUSHOVER_TOKEN = os.getenv("PUSHOVER_TOKEN", "")
    PUSHOVER_USER_KEY = os.getenv("PUSHOVER_USER_KEY", "")
    WEB_BASE_URL = os.getenv("WEB_BASE_URL", "")
    LIFECYCLE_DONE_RETENTION_DAYS = int(os.getenv("LIFECYCLE_DONE_RETENTION_DAYS", "365"))
    LIFECYCLE_REMOVED_RETENTION_DAYS = int(os.getenv("LIFECYCLE_REMOVED_RETENTION_DAYS", "90"))
    LIFECYCLE_FIRED_RETENTION_DAYS = int(os.getenv("LIFECYCLE_FIRED_RETENTION_DAYS", "30"))


SETTINGS = Settings()
