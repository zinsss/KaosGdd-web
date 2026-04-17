class ApiText:
    OK = "ok"
    NOT_FOUND = "not found"

    TITLE_REQUIRED = "title is required"
    REMIND_AT_REQUIRED = "remind_at is required"
    START_DATE_REQUIRED = "start_date is required"
    MISSING_EVENT_DATE = "missing date after ^^"
    FILE_BODY_EMPTY = "file body is empty"

    INVALID_RAW_TASK = "invalid raw task"
    INVALID_REMINDER_RAW = "invalid reminder raw"
    INVALID_JOURNAL_RAW = "invalid journal raw"
    INVALID_NOTE_RAW = "invalid note raw"
    INVALID_EVENT_RAW = "invalid event raw"
    INVALID_FILE_RAW = "invalid file raw"

    REMINDER_REQUIRES_DATETIME = "!! requires at least one reminder datetime"
    UNSUPPORTED_CAPTURE_KIND = "unsupported capture kind"


class ReminderStatusText:
    SAVED = "saved"
    ACKED = "acked"
    SNOOZED = "snoozed"
    CANCELLED = "cancelled"
