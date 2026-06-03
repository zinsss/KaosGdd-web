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


class FaxNotificationText:
    RECEIVED_TITLE = "Fax received"
    SEND_FAILED_TITLE = "Fax send failed"
    SEND_FAILED_PUSHOVER_TITLE = "KaosGdd fax failed"
    SEND_FAILED_LINE = "Fax send failed."


class DailySummaryText:
    MORNING_TITLE = "KaosGdd Morning"
    LUNCH_TITLE = "KaosGdd Lunch"
    BEFORE_OFF_TITLE = "KaosGdd Before Off"
    BEFORE_SLEEP_TITLE = "KaosGdd Night"
    TASK_LINE = "Tasks {task_count} · Overdue {overdue_count}"
    REMINDER_EVENT_LINE = "Reminders {reminder_count} · Events {event_count}"
    SUPPLY_FAX_LINE = "Supplies {supply_count} · Fax {fax_count}"
    PUBLIC_HOLIDAY = "Public Holiday"
    MARKET_DAY = "Market Day"
    CLAIM_DAY = "Claim Day"
    INVALID_SLOT = "invalid slot"
    DISABLED = "daily summary disabled"


class PushoverText:
    TEST_TITLE = "KaosGdd Pushover Test"
    TEST_MESSAGE = "Pushover is connected."
    TEST_URL_TITLE = "Open KaosGdd"


class ReminderStatusText:
    SAVED = "saved"
    ACKED = "acked"
    SNOOZED = "snoozed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
