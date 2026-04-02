import os


class Settings:
    APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")
    APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Seoul")
    DEFAULT_SNOOZE_MINUTES = int(os.getenv("DEFAULT_SNOOZE_MINUTES", "10"))


SETTINGS = Settings()