class ApiText:
    OK = "ok"
    NOT_FOUND = "not found"
    TITLE_REQUIRED = "title is required"
    REMIND_AT_REQUIRED = "remind_at is required"
    INVALID_RAW_TASK = "invalid raw task"
    INVALID_REMINDER_RAW = "invalid reminder raw"
    REMINDER_REQUIRES_DATETIME = "!! requires at least one reminder datetime"
    JOURNAL_NOT_SUPPORTED = "// journal not supported yet in this schema"
    EVENT_NOT_SUPPORTED = "^^ event not supported yet in this schema"
    UNSUPPORTED_CAPTURE_KIND = "unsupported capture kind"


class ReminderStatusText:
    SAVED = "saved"
    ACKED = "acked"
    SNOOZED = "snoozed"
    CANCELLED = "cancelled"
