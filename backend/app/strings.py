class ApiText:
    OK = "ok"
    NOT_FOUND = "not found"

    TITLE_REQUIRED = "title is required"
    REMINDER_EMPTY = "reminder is empty"
    STANDALONE_REMINDER_PREFIX_REQUIRED = "standalone reminder edit must start with !!"
    REMINDER_BODY_REQUIRED = "reminder body is required after !!"
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
    READONLY_EVENT = "event is read-only"

    REMINDER_REQUIRES_DATETIME = "!! requires at least one reminder datetime"
    UNSUPPORTED_CAPTURE_KIND = "unsupported capture kind"
    NO_PUSH_SUBSCRIPTIONS = "No subscriptions found for client"


class PushText:
    TASK_OVERDUE_TITLE = "Task became overdue"
    TASK_FALLBACK_TITLE = "A task"
    TASK_OVERDUE_MESSAGE = "A task became overdue."
    TEST_PUSH_TITLE = "KaosGdd test push"
    TEST_PUSH_BODY = "Push is connected. Open fired reminders."


class ReminderStatusText:
    SAVED = "saved"
    ACKED = "acked"
    SNOOZED = "snoozed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
