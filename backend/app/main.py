from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager

import asyncio
import json
import logging
from datetime import datetime, timezone
from urllib.parse import unquote
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse

from app.config import SETTINGS
from app.core.db import engine
from app.db.repo.event_repo import EventRepo
from app.db.repo.journal_repo import JournalRepo
from app.db.repo.note_repo import NoteRepo
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.file_repo import FileRepo
from app.db.repo.fax_repo import FaxRepo
from app.db.repo.task_repo import TaskRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.repo.push_subscription_repo import PushSubscriptionRepo
from app.db.repo.push_test_diagnostic_repo import PushTestDiagnosticRepo
from app.db.repo.push_policy_repo import PushPolicyRepo
from app.db.repo.push_policy_repo import (
    DEFAULT_NOTIFICATION_MODE,
    NOTIFICATION_MODE_PUSHOVER_PRIMARY,
    NOTIFICATION_MODE_PUSHOVER_ONLY,
    NOTIFICATION_MODES,
    NOTIFICATION_SUPPORTED_MODES,
    normalize_notification_mode,
)
from app.db.repo.supply_repo import SupplyRepo
from app.db.repo.scribble_repo import ScribbleRepo
from app.db.repo.weather_repo import WeatherRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.event_service import EventService
from app.engine.dashboard_service import DashboardService
from app.engine.holiday_service import HolidaySyncService
from app.engine.claim_day_task_service import ClaimDayTaskService
from app.engine.journal_service import JournalService
from app.engine.note_service import NoteService
from app.engine.file_service import FileService
from app.engine.fax_pdf_conversion_service import FaxPdfConversionService
from app.engine.fax_service import FaxService
from app.engine.task_service import TaskService
from app.engine.reminder_service import ReminderService
from app.engine.supply_service import SupplyService
from app.engine.weather_service import DEFAULT_WEATHER_LOCATION_ID, WeatherService
from app.integrations import pushover_client
from app.integrations.web_push_client import WebPushClient
from app.schemas.reminders import normalize_minutes
from app.strings import ApiText, DailySummaryText, PushText, PushoverText
from app.utils.capture_parse import parse_capture_input
from app.utils.scribble_raw import parse_scribble_raw


items_repo = ItemsRepo(engine)
task_repo = TaskRepo(engine)
event_repo = EventRepo(engine)
journal_repo = JournalRepo(engine)
note_repo = NoteRepo(engine)
file_repo = FileRepo(engine)
fax_repo = FaxRepo(engine)
reminder_repo = ReminderRepo(engine)
push_subscription_repo = PushSubscriptionRepo(engine)
push_test_diagnostic_repo = PushTestDiagnosticRepo(engine)
push_policy_repo = PushPolicyRepo(engine)
supply_repo = SupplyRepo(engine)
scribble_repo = ScribbleRepo(engine)
weather_repo = WeatherRepo(engine)
task_service = TaskService(items_repo, task_repo, reminder_repo)
event_service = EventService(items_repo, event_repo, reminder_repo)
holiday_sync_service = HolidaySyncService(items_repo, event_repo)
journal_service = JournalService(items_repo, journal_repo)
note_service = NoteService(items_repo, note_repo)
file_service = FileService(items_repo, file_repo)
fax_conversion_service = FaxPdfConversionService(storage_dir=SETTINGS.FAX_STORAGE_DIR)
web_push_client = WebPushClient(
    public_key=SETTINGS.WEB_PUSH_VAPID_PUBLIC_KEY,
    private_key=SETTINGS.WEB_PUSH_VAPID_PRIVATE_KEY,
    subject=SETTINGS.WEB_PUSH_SUBJECT,
)
reminder_service = ReminderService(
    reminder_repo,
    task_repo,
    event_repo,
    items_repo,
    supply_repo,
    push_subscription_repo,
    web_push_client,
    push_policy_repo,
)
fax_service = FaxService(
    items_repo=items_repo,
    fax_repo=fax_repo,
    file_repo=file_repo,
    conversion_service=fax_conversion_service,
    reminder_service=reminder_service,
)
supply_service = SupplyService(items_repo, supply_repo)
weather_service = WeatherService(weather_repo)
dashboard_service = DashboardService(
    event_service=event_service,
    task_service=task_service,
    reminder_service=reminder_service,
    supply_service=supply_service,
    file_service=file_service,
)
claim_day_task_service = ClaimDayTaskService(event_service=event_service, task_service=task_service)
logger = logging.getLogger(__name__)
holiday_sync_task = None


async def run_holiday_sync_once(reason: str = "manual") -> dict:
    try:
        result = await asyncio.to_thread(holiday_sync_service.sync_current_and_next_year)
        if not result.get("skipped"):
            logger.info("Korean holiday sync completed (%s): %s", reason, result)
        return result
    except Exception as exc:
        logger.warning("Korean holiday sync failed (%s): %s", reason, exc)
        return {"ok": False, "skipped": True, "reason": "sync failed"}


def seconds_until_next_month() -> float:
    try:
        now = datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE))
    except Exception:
        now = datetime.now(timezone.utc)
    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        next_month = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return max((next_month - now).total_seconds(), 1.0)


async def holiday_sync_loop() -> None:
    await run_holiday_sync_once("startup")
    while True:
        await asyncio.sleep(seconds_until_next_month())
        await run_holiday_sync_once("monthly")


def start_holiday_sync_scheduler(create_task=None) -> bool:
    global holiday_sync_task
    if not SETTINGS.KOREAN_HOLIDAY_ICAL_URL:
        return False
    if holiday_sync_task is not None and not holiday_sync_task.done():
        return False
    create_task = create_task or asyncio.create_task
    holiday_sync_task = create_task(holiday_sync_loop())
    return True


def stop_holiday_sync_scheduler() -> None:
    global holiday_sync_task
    if holiday_sync_task is not None and not holiday_sync_task.done():
        holiday_sync_task.cancel()
    holiday_sync_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema_v0(engine)
    start_holiday_sync_scheduler()
    try:
        yield
    finally:
        stop_holiday_sync_scheduler()


app = FastAPI(title=SETTINGS.APP_NAME, lifespan=lifespan)


DAILY_SUMMARY_SLOTS = SETTINGS.DAILY_SUMMARY_SLOTS


def _daily_summary_local_date() -> str:
    try:
        now = datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE))
    except Exception:
        now = datetime.now(timezone.utc)
    return now.date().isoformat()


def _daily_summary_count(value, *path: str) -> int:
    current = value
    for key in path:
        if not isinstance(current, dict):
            return 0
        current = current.get(key)
    if isinstance(current, bool):
        return int(current)
    try:
        return int(current or 0)
    except (TypeError, ValueError):
        return 0


def _build_daily_summary_body(summary: dict) -> str:
    tasks = summary.get("tasks") if isinstance(summary.get("tasks"), dict) else {}
    reminders = summary.get("reminders") if isinstance(summary.get("reminders"), dict) else {}
    events_today = summary.get("events_today")
    flags = summary.get("flags") if isinstance(summary.get("flags"), dict) else {}

    task_count = _daily_summary_count(tasks, "active_total")
    overdue_count = _daily_summary_count(tasks, "overdue")
    reminder_count = _daily_summary_count(reminders, "today")
    event_count = len(events_today) if isinstance(events_today, list) else _daily_summary_count(summary, "events")
    supply_count = _daily_summary_count(summary, "supplies", "active_total")
    fax_count = _daily_summary_count(summary, "fax", "active_total")

    task_line = DailySummaryText.TASK_LINE.format(task_count=task_count, overdue_count=overdue_count)
    reminder_line = DailySummaryText.REMINDER_EVENT_LINE.format(
        reminder_count=reminder_count,
        event_count=event_count,
    )
    supply_fax_line = DailySummaryText.SUPPLY_FAX_LINE.format(supply_count=supply_count, fax_count=fax_count)
    flag_labels = []
    if flags.get("public_holiday"):
        flag_labels.append(DailySummaryText.PUBLIC_HOLIDAY)
    if flags.get("market_day"):
        flag_labels.append(DailySummaryText.MARKET_DAY)
    if flags.get("claim_day"):
        flag_labels.append(DailySummaryText.CLAIM_DAY)

    max_lines = max(1, int(SETTINGS.DAILY_SUMMARY_BODY_MAX_LINES or 3))
    if flag_labels and SETTINGS.DAILY_SUMMARY_FLAGS_FIRST:
        lines = [
            " · ".join(flag_labels),
            task_line,
            f"{reminder_line} · {supply_fax_line}",
        ]
    elif flag_labels:
        lines = [task_line, reminder_line, supply_fax_line, " · ".join(flag_labels)]
    else:
        lines = [task_line, reminder_line, supply_fax_line]
    return "\n".join(lines[:max_lines])


def _send_daily_summary_web_push(*, title: str, body: str, url: str) -> dict:
    if push_subscription_repo is None or web_push_client is None or not web_push_client.is_enabled:
        return {"sent": 0, "skipped": 0, "removed": 0, "errors": []}

    subscriptions = push_subscription_repo.list_all()
    sent = 0
    removed = 0
    errors = []
    for subscription_row in subscriptions:
        endpoint = str(subscription_row.get("endpoint") or "")
        client_id = str(subscription_row.get("client_id") or "")
        try:
            web_push_client.send(
                subscription_info=subscription_row.get("subscription") or {},
                payload_json=json.dumps(
                    {
                        "title": title,
                        "body": body,
                        "url": url,
                    }
                ),
            )
            sent += 1
        except Exception as exc:
            details = web_push_client.summarize_exception(exc)
            was_removed = False
            if client_id and endpoint and details["is_invalid_subscription"]:
                was_removed = push_subscription_repo.remove(client_id=client_id, endpoint=endpoint)
                if was_removed:
                    removed += 1
            errors.append(
                {
                    "client_id": client_id,
                    "endpoint": endpoint,
                    "exception_type": details["exception_type"],
                    "message": details["message"],
                    "summary": details["summary"],
                    "removed_due_to_invalid": details["is_invalid_subscription"],
                    "removed": was_removed,
                }
            )
            logger.warning(
                (
                    "daily summary web push send failed: client_id=%s endpoint=%s "
                    "exception_type=%s exception_message=%s invalid_subscription=%s removed=%s"
                ),
                client_id,
                endpoint,
                details["exception_type"],
                details["message"],
                details["is_invalid_subscription"],
                was_removed,
            )

    return {
        "sent": sent,
        "skipped": 0,
        "removed": removed,
        "errors": errors,
    }


def _send_daily_summary_pushover(*, title: str, body: str, url: str) -> dict:
    result = pushover_client.send_pushover_emergency(title=title, message=body, url=url, monospace=True)
    return {
        "sent": 1 if result.get("succeeded") else 0,
        "skipped": 0 if result.get("attempted") else 1,
        "removed": 0,
        "errors": [] if result.get("succeeded") else [{"summary": result.get("reason") or "Pushover send failed"}],
    }


def _notification_mode() -> str:
    try:
        return normalize_notification_mode(push_policy_repo.get_notification_preferences().get("mode"))
    except Exception:
        return DEFAULT_NOTIFICATION_MODE


def _notification_route_for_daily_summary() -> str:
    mode = _notification_mode()
    if mode in {NOTIFICATION_MODE_PUSHOVER_PRIMARY, NOTIFICATION_MODE_PUSHOVER_ONLY}:
        return "pushover"
    return "web_push"


def resolve_upload_filename(headers) -> str:
    encoded_filename = str(headers.get("x-file-name-url") or "").strip()
    decoded_filename = ""
    if encoded_filename:
        try:
            decoded_filename = unquote(encoded_filename).strip()
        except Exception:
            decoded_filename = ""
    legacy_filename = str(headers.get("x-file-name") or "").strip()
    return decoded_filename or legacy_filename or "uploaded-file"


@app.get("/health")
def health():
    return {
        "ok": True,
        "app": SETTINGS.APP_NAME,
        "mode": SETTINGS.APP_HEALTH_MODE,
        "timezone": SETTINGS.APP_TIMEZONE,
    }


@app.get("/dashboard")
def get_dashboard():
    return dashboard_service.get_dashboard()


@app.get("/widget/summary")
def get_widget_summary():
    return dashboard_service.get_widget_summary()


@app.get("/scribbles")
def list_scribbles():
    return {"ok": True, "items": scribble_repo.list_scribbles()}


@app.post("/scribbles")
def create_scribble(payload: dict):
    raw_text = str(payload.get("raw") or payload.get("body") or "")
    try:
        parsed = parse_scribble_raw(raw_text, require_prefix=bool(payload.get("require_prefix")))
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    item = scribble_repo.create_scribble(body=parsed["body"], tags=parsed["tags"])
    return {"ok": True, "kind": "scribble", "item": item, "id": item["id"]}


@app.patch("/scribbles/{scribble_id}")
def update_scribble(scribble_id: str, payload: dict):
    raw_text = str(payload.get("raw") or payload.get("body") or "")
    try:
        parsed = parse_scribble_raw(raw_text, require_prefix=False)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    item = scribble_repo.update_scribble(scribble_id, body=parsed["body"], tags=parsed["tags"])
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.delete("/scribbles/{scribble_id}")
def delete_scribble(scribble_id: str):
    ok = scribble_repo.delete_scribble(scribble_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/tasks")
def list_tasks(mode: str = "active"):
    return {"items": task_service.list_tasks(mode=mode)}


@app.get("/supplies")
def list_supplies(mode: str = "active"):
    return {"items": supply_service.list_supplies(mode=mode)}


@app.post("/supplies")
def create_supply(payload: dict):
    title = str(payload.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": ApiText.TITLE_REQUIRED}
    supply_id, created = supply_service.create_supply(title)
    if not supply_id:
        return {"ok": False, "error": ApiText.TITLE_REQUIRED}
    return {"ok": True, "id": supply_id, "created": created}


@app.post("/supplies/{supply_id}/done")
def mark_supply_done(supply_id: str):
    ok = supply_service.mark_supply_done(supply_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.post("/supplies/{supply_id}/active")
def mark_supply_active(supply_id: str):
    ok = supply_service.mark_supply_active(supply_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.delete("/supplies/{supply_id}")
def delete_supply(supply_id: str):
    ok = supply_service.delete_supply(supply_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/supplies/presets")
def list_supply_presets():
    return {"items": supply_service.list_presets()}


@app.post("/supplies/presets/use")
def use_supply_preset(payload: dict):
    name = str(payload.get("name") or "").strip()
    if not name:
        return {"ok": False, "error": ApiText.TITLE_REQUIRED}
    supply_id, created = supply_service.use_preset(name)
    if not supply_id:
        return {"ok": False, "error": ApiText.TITLE_REQUIRED}
    return {"ok": True, "id": supply_id, "created": created}


@app.get("/events")
def list_events(start_date: str, end_date: str, mode: str = "active"):
    return {"items": event_service.list_events_in_range(start_date=start_date, end_date=end_date, mode=mode)}


@app.get("/weather/daily")
def get_daily_weather(location: str = DEFAULT_WEATHER_LOCATION_ID, start_date: str = "", end_date: str = ""):
    return weather_service.get_daily(location_id=location, start_date=start_date, end_date=end_date)


@app.get("/weather/dayparts")
def get_weather_dayparts(location: str = DEFAULT_WEATHER_LOCATION_ID, date: str = ""):
    return weather_service.get_dayparts(location_id=location, target_date=date)


@app.get("/events/{event_id}")
def get_event(event_id: str):
    item = event_service.get_event(event_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.post("/events")
def create_event(payload: dict):
    title = (payload.get("title") or "").strip()
    start_date = (payload.get("start_date") or "").strip()
    if not title:
        return {"ok": False, "error": ApiText.TITLE_REQUIRED}
    if not start_date:
        return {"ok": False, "error": ApiText.START_DATE_REQUIRED}

    item_id = event_service.create_event(
        title=title,
        start_date=start_date,
        end_date=payload.get("end_date"),
        memo=payload.get("memo"),
    )
    return {"ok": True, "id": item_id}


@app.patch("/events/{event_id}")
def update_event(event_id: str, payload: dict):
    if event_service.is_readonly_event(event_id):
        return {"ok": False, "error": ApiText.READONLY_EVENT}
    ok = event_service.update_event(
        event_id,
        title=payload.get("title"),
        start_date=payload.get("start_date"),
        end_date=payload.get("end_date"),
        memo=payload.get("memo"),
    )
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.patch("/events/{event_id}/classification")
def update_event_classification(event_id: str, payload: dict):
    updated = holiday_sync_service.set_imported_event_public_holiday(
        event_id,
        is_public_holiday=bool(payload.get("is_public_holiday")),
    )
    if updated is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    item = event_service.get_event(event_id)
    return {"ok": True, "item": item}


@app.get("/events/{event_id}/raw")
def get_event_raw(event_id: str):
    raw = event_service.export_event_raw(event_id)
    if raw is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "raw": raw}


@app.patch("/events/{event_id}/raw")
def update_event_raw(event_id: str, payload: dict):
    if event_service.is_readonly_event(event_id):
        return {"ok": False, "error": ApiText.READONLY_EVENT}
    raw_text = str(payload.get("raw") or "")
    ok, error = event_service.update_event_from_raw(event_id, raw_text)
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_EVENT_RAW}
    return {"ok": True}


@app.delete("/events/{event_id}")
def remove_event(event_id: str):
    if event_service.is_readonly_event(event_id):
        return {"ok": False, "error": ApiText.READONLY_EVENT}
    ok = event_service.remove_event(event_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.post("/events/{event_id}/restore")
def restore_event(event_id: str):
    ok = event_service.restore_event(event_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/journals")
def list_journals(mode: str = "active"):
    return {"items": journal_service.list_journals(mode=mode)}



@app.get("/notes")
def list_notes(mode: str = "active"):
    return {"items": note_service.list_notes(mode=mode)}



@app.post("/notes/raw")
def create_note_from_raw(payload: dict):
    raw_text = str(payload.get("raw") or "")
    note_id, error = note_service.create_note_from_raw(raw_text)
    if note_id is None:
        return {"ok": False, "error": error or ApiText.INVALID_NOTE_RAW}
    return {"ok": True, "id": note_id}


@app.get("/notes/{note_id}")
def get_note(note_id: str):
    item = note_service.get_note(note_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.get("/notes/{note_id}/raw")
def get_note_raw(note_id: str):
    raw = note_service.export_note_raw(note_id)
    if raw is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "raw": raw}


@app.patch("/notes/{note_id}/raw")
def update_note_raw(note_id: str, payload: dict):
    raw_text = str(payload.get("raw") or "")
    ok, error = note_service.update_note_from_raw(note_id, raw_text)
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_NOTE_RAW}
    return {"ok": True}


@app.delete("/notes/{note_id}")
def remove_note(note_id: str):
    ok = note_service.remove_note(note_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/files")
def list_files(mode: str = "active"):
    return {"items": file_service.list_files(mode=mode)}


@app.post("/files")
async def create_file(request: Request):
    content = await request.body()
    original_filename = resolve_upload_filename(request.headers)
    mime_type = str(request.headers.get("x-file-type") or "").strip()
    if not content:
        return {"ok": False, "error": ApiText.FILE_BODY_EMPTY}
    item_id = file_service.create_file(
        original_filename=original_filename,
        mime_type=mime_type,
        content=content,
    )
    return {"ok": True, "id": item_id}


@app.get("/files/{file_id}")
def get_file(file_id: str):
    item = file_service.get_file(file_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.get("/files/{file_id}/open")
def open_file(file_id: str):
    result = file_service.get_file_binary(file_id)
    if result is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    detail, path = result
    return FileResponse(
        path=path,
        media_type=detail.get("mime_type") or "application/octet-stream",
        filename=detail.get("original_filename") or detail.get("title") or "file",
    )


@app.get("/files/{file_id}/raw")
def get_file_raw(file_id: str):
    raw = file_service.export_file_raw(file_id)
    if raw is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "raw": raw}


@app.patch("/files/{file_id}/raw")
def update_file_raw(file_id: str, payload: dict):
    raw_text = str(payload.get("raw") or "")
    ok, error = file_service.update_file_from_raw(file_id, raw_text)
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_FILE_RAW}
    return {"ok": True}


@app.delete("/files/{file_id}")
def remove_file(file_id: str):
    ok = file_service.remove_file(file_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/fax")
def list_faxes(mode: str = "active"):
    return {"items": fax_service.list_faxes(mode=mode)}


@app.get("/fax/{fax_id}")
def get_fax(fax_id: str):
    item = fax_service.get_fax(fax_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.get("/fax/{fax_id}/open")
def open_fax_pdf(fax_id: str):
    result = fax_service.get_fax_pdf(fax_id)
    if result is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    detail, path = result
    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename=(detail.get("title") or "fax") + ".pdf",
    )


@app.post("/fax/{fax_id}/save-to-files")
def save_fax_to_files(fax_id: str):
    ok, error, file_id = fax_service.save_incoming_to_files(fax_id)
    if not ok:
        return {"ok": False, "error": error or ApiText.NOT_FOUND}
    return {"ok": True, "id": file_id, "file_id": file_id}


@app.delete("/fax/{fax_id}")
def delete_fax(fax_id: str):
    ok = fax_service.delete_inbox_fax(fax_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.post("/fax/send-from-file")
def send_fax_from_file(payload: dict):
    file_id = str(payload.get("file_id") or "").strip()
    fax_number = str(payload.get("fax_number") or "").strip()
    if not file_id:
        return {"ok": False, "error": "file_id is required"}
    if not fax_number:
        return {"ok": False, "error": "fax number is required"}
    ok, status, fax_id = fax_service.send_file_as_fax(file_id=file_id, fax_number=fax_number)
    return {"ok": ok, "status": status, "id": fax_id, "kind": "fax"}


@app.post("/fax/incoming")
def receive_incoming_fax(payload: dict):
    source_file_path = str(payload.get("source_file_path") or "").strip()
    if not source_file_path:
        return {"ok": False, "error": "source_file_path is required"}
    ok, status, fax_id = fax_service.receive_incoming_raw(
        source_file_path=source_file_path,
        remote_number=str(payload.get("remote_number") or "").strip() or None,
        local_device=str(payload.get("local_device") or "").strip() or None,
        original_filename=str(payload.get("original_filename") or "").strip() or None,
        original_mime_type=str(payload.get("original_mime_type") or "").strip() or None,
    )
    return {"ok": ok, "status": status, "id": fax_id, "kind": "fax"}


@app.delete("/files/{file_id}/hard")
def remove_file_hard(file_id: str):
    ok = file_service.remove_file_hard(file_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/journals/{journal_id}")
def get_journal(journal_id: str):
    item = journal_service.get_journal(journal_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.get("/journals/{journal_id}/raw")
def get_journal_raw(journal_id: str):
    raw = journal_service.export_journal_raw(journal_id)
    if raw is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "raw": raw}


@app.patch("/journals/{journal_id}/raw")
def update_journal_raw(journal_id: str, payload: dict):
    raw_text = str(payload.get("raw") or "")
    ok, error = journal_service.update_journal_from_raw(journal_id, raw_text)
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_JOURNAL_RAW}
    return {"ok": True}


@app.delete("/journals/{journal_id}")
def remove_journal(journal_id: str):
    ok = journal_service.remove_journal(journal_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/reminders")
def list_reminders(mode: str = "active"):
    return {"items": reminder_service.list_reminders(mode=mode)}


@app.get("/reminders/{reminder_id}")
def get_reminder(reminder_id: str):
    item = reminder_service.get_reminder(reminder_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.patch("/reminders/{reminder_id}")
def update_reminder(reminder_id: str, payload: dict):
    raw_text = str(payload.get("raw") or "")
    ok, error = reminder_service.update_standalone_reminder_from_raw(reminder_id, raw_text)
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_REMINDER_RAW}
    return {"ok": True}


@app.get("/reminders/{reminder_id}/raw")
def get_reminder_raw(reminder_id: str):
    raw = reminder_service.export_standalone_reminder_raw(reminder_id)
    if raw is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "raw": raw}


@app.delete("/reminders/{reminder_id}")
def remove_reminder(reminder_id: str):
    ok = reminder_service.remove_reminder(reminder_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.post("/reminders/{reminder_id}/restore")
def restore_reminder(reminder_id: str):
    ok = reminder_service.restore_reminder(reminder_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.post("/tasks")
def create_task(payload: dict):
    title = (payload.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": ApiText.TITLE_REQUIRED}

    item_id = task_service.create_task(
        title=title,
        due_at=payload.get("due_at"),
        memo=payload.get("memo"),
    )
    return {"ok": True, "id": item_id}


@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    item = task_service.get_task(task_id)
    if item is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "item": item}


@app.patch("/tasks/{task_id}")
def update_task(task_id: str, payload: dict):
    ok = task_service.update_task(
        task_id,
        title=payload.get("title"),
        due_at=payload.get("due_at"),
        memo=payload.get("memo"),
        is_done=payload.get("is_done"),
    )
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.delete("/tasks/{task_id}")
def remove_task(task_id: str):
    ok = task_service.remove_task(task_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.post("/tasks/{task_id}/restore")
def restore_task(task_id: str):
    ok = task_service.restore_task(task_id)
    if not ok:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True}


@app.get("/tasks/{task_id}/raw")
def get_task_raw(task_id: str):
    raw = task_service.export_task_raw(task_id)
    if raw is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "raw": raw}


@app.patch("/tasks/{task_id}/raw")
def update_task_raw(task_id: str, payload: dict):
    raw_text = str(payload.get("raw") or "")
    timezone_name = str(payload.get("timezone") or "").strip() or None
    ok, error = task_service.update_task_from_raw(
        task_id,
        raw_text,
        timezone_name=timezone_name,
        edit_scope=payload.get("edit_scope"),
    )
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_RAW_TASK}
    return {"ok": True}


@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: str):
    result = task_service.toggle_task(task_id)
    if result is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "is_done": result}


@app.post("/tasks/{task_id}/subtasks/{subtask_id}/toggle")
def toggle_subtask(task_id: str, subtask_id: str):
    result = task_service.toggle_subtask(task_id, subtask_id)
    if result is None:
        return {"ok": False, "error": ApiText.NOT_FOUND}
    return {"ok": True, "is_done": result}


@app.post("/tasks/{task_id}/reminders")
def create_task_reminder(task_id: str, payload: dict):
    remind_at = (payload.get("remind_at") or "").strip()
    if not remind_at:
        return {"ok": False, "error": ApiText.REMIND_AT_REQUIRED}

    ok, status, reminder_id = reminder_service.create_task_reminder(
        task_item_id=task_id,
        remind_at=remind_at,
        title=payload.get("title"),
        alert_policy=payload.get("alert_policy"),
    )
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "id": reminder_id, "status": status}


@app.post("/capture")
def capture_item(payload: dict):
    raw_text = str(payload.get("raw") or "")
    timezone_name = str(payload.get("timezone") or "").strip() or None
    try:
        parsed = parse_capture_input(raw_text, timezone_name=timezone_name)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    kind = parsed["kind"]

    if kind == "modal":
        modal_type = str(parsed["parsed"].get("modal_type") or "").strip()
        if modal_type == "fax":
            return {"ok": False, "error": "file is required for fax"}
        title = str(parsed["parsed"].get("title") or "").strip() or None
        return {
            "ok": True,
            "kind": "modal",
            "modal_type": modal_type,
            "title": title,
        }

    if kind == "task":
        title = str(parsed["parsed"].get("title") or "").strip()
        if not title:
            return {"ok": False, "error": ApiText.TITLE_REQUIRED}

        item_id = task_service.create_task(title=title)
        ok, error = task_service.update_task_from_raw(
            item_id,
            parsed["raw"],
            reject_past_datetimes=True,
            timezone_name=timezone_name,
        )
        if not ok:
            task_service.remove_task_hard(item_id)
            return {"ok": False, "error": error or ApiText.INVALID_RAW_TASK}
        return {"ok": True, "kind": kind, "id": item_id}

    if kind == "event":
        title = str(parsed["parsed"].get("title") or "").strip()
        start_date = str(parsed["parsed"].get("start_date") or "").strip()
        if not title:
            return {"ok": False, "error": ApiText.TITLE_REQUIRED}
        if not start_date:
            return {"ok": False, "error": ApiText.MISSING_EVENT_DATE}

        item_id = event_service.create_event(
            title=title,
            start_date=start_date,
            end_date=parsed["parsed"].get("end_date"),
            memo=parsed["parsed"].get("memo"),
        )
        ok, error = event_service.update_event_from_raw(
            item_id,
            parsed["raw"],
            reject_past_datetimes=True,
        )
        if not ok:
            event_service.remove_event_hard(item_id)
            return {"ok": False, "error": error or ApiText.INVALID_EVENT_RAW}
        return {"ok": True, "kind": kind, "id": item_id}

    if kind == "simple_reminder":
        title = str(parsed["parsed"].get("title") or "").strip()
        remind_ats = list(parsed["parsed"].get("remind_ats") or [])
        tags = list(parsed["parsed"].get("tags") or [])
        if not title:
            return {"ok": False, "error": ApiText.TITLE_REQUIRED}
        if not remind_ats:
            return {"ok": False, "error": ApiText.REMINDER_REQUIRES_DATETIME}

        created_ids = []
        for remind_at in remind_ats:
            ok, status, reminder_id = reminder_service.create_standalone_reminder(
                title=title,
                remind_at=remind_at,
            )
            if not ok:
                return {"ok": False, "error": status}
            created_ids.append(reminder_id)
            items_repo.replace_item_tags(reminder_id, tags)

        return {"ok": True, "kind": kind, "id": created_ids[0], "ids": created_ids}

    if kind == "journal":
        title = str(parsed["parsed"].get("title") or "").strip()
        memo = str(parsed["parsed"].get("memo") or "").strip()
        body = title if not memo else f"{title}\n{memo}"
        tags = list(parsed["parsed"].get("tags") or [])
        journal_id = journal_service.create_journal(title=title, body=body, tags=tags)
        return {"ok": True, "kind": kind, "id": journal_id}

    if kind == "supply":
        title = str(parsed["parsed"].get("title") or "").strip()
        if not title:
            return {"ok": False, "error": ApiText.TITLE_REQUIRED}
        supply_id, created = supply_service.create_supply(title)
        if not supply_id:
            return {"ok": False, "error": ApiText.TITLE_REQUIRED}
        return {
            "ok": True,
            "kind": kind,
            "id": supply_id,
            "created": created,
            "created_types": ["supply"],
        }

    if kind == "scribble":
        body = str(parsed["parsed"].get("body") or "").strip()
        if not body:
            return {"ok": False, "error": "scribble content is required"}
        item = scribble_repo.create_scribble(body=body, tags=list(parsed["parsed"].get("tags") or []))
        return {"ok": True, "kind": kind, "id": item["id"]}

    return {"ok": False, "error": ApiText.UNSUPPORTED_CAPTURE_KIND}


@app.post("/reminders/{reminder_id}/ack")
def ack_reminder(reminder_id: str):
    ok, status = reminder_service.ack_reminder(reminder_id)
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "status": status}


@app.post("/reminders/{reminder_id}/snooze")
def snooze_reminder(reminder_id: str, payload: dict):
    minutes = normalize_minutes(payload.get("minutes"), default=SETTINGS.DEFAULT_SNOOZE_MINUTES)
    ok, status, snoozed_until = reminder_service.snooze_reminder(reminder_id, minutes=minutes)
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "status": status, "snoozed_until": snoozed_until}


@app.post("/reminders/{reminder_id}/cancel")
def cancel_reminder(reminder_id: str):
    ok, status = reminder_service.cancel_reminder(reminder_id)
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "status": status}


@app.post("/reminders/{reminder_id}/complete")
def complete_reminder(reminder_id: str):
    ok, status = reminder_service.complete_reminder(reminder_id)
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "status": status}




@app.get("/push/subscriptions")
def get_push_public_key():
    if not web_push_client.is_enabled:
        return {"ok": False, "error": "Web push is not configured"}
    return {"ok": True, "public_key": SETTINGS.WEB_PUSH_VAPID_PUBLIC_KEY}


@app.post("/push/subscriptions")
def save_push_subscription(payload: dict):
    if not web_push_client.is_enabled:
        return {"ok": False, "error": "Web push is not configured"}

    client_id = str(payload.get("client_id") or "").strip()
    subscription = payload.get("subscription") or {}
    endpoint = str(subscription.get("endpoint") or "").strip()
    keys = subscription.get("keys") or {}
    p256dh = str(keys.get("p256dh") or "").strip()
    auth = str(keys.get("auth") or "").strip()

    if not client_id:
        return {"ok": False, "error": "client_id is required"}
    if not endpoint or not p256dh or not auth:
        return {"ok": False, "error": "Invalid push subscription"}

    subscription_id = push_subscription_repo.upsert(
        client_id=client_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        subscription_json=subscription,
    )
    return {"ok": True, "id": subscription_id}


@app.delete("/push/subscriptions")
def delete_push_subscription(payload: dict):
    client_id = str(payload.get("client_id") or "").strip()
    endpoint = str(payload.get("endpoint") or "").strip()

    if not client_id or not endpoint:
        return {"ok": False, "error": "client_id and endpoint are required"}

    removed = push_subscription_repo.remove(client_id=client_id, endpoint=endpoint)
    return {"ok": True, "removed": removed}


@app.post("/push/test")
def send_push_test(payload: dict):
    if not web_push_client.is_enabled:
        return {"ok": False, "error": "Web push is not configured"}

    client_id = str(payload.get("client_id") or "").strip()
    requested_endpoint = str(payload.get("endpoint") or "").strip()
    if not client_id:
        return {"ok": False, "error": "client_id is required"}

    raw_subscriptions = push_subscription_repo.list_for_client(client_id)
    deduped_subscriptions = []
    seen_endpoints = set()
    for row in raw_subscriptions:
        endpoint = str(row.get("endpoint") or "")
        if not endpoint or endpoint in seen_endpoints:
            continue
        seen_endpoints.add(endpoint)
        deduped_subscriptions.append(row)

    endpoint_match = None
    if requested_endpoint:
        endpoint_match = requested_endpoint in seen_endpoints

    if not deduped_subscriptions:
        return {"ok": False, "error": ApiText.NO_PUSH_SUBSCRIPTIONS}

    sent = 0
    removed = 0
    errors = []
    for subscription_row in deduped_subscriptions:
        endpoint = str(subscription_row.get("endpoint") or "")
        try:
            web_push_client.send(
                subscription_info=subscription_row.get("subscription") or {},
                payload_json=json.dumps(
                    {
                        "title": PushText.TEST_PUSH_TITLE,
                        "body": PushText.TEST_PUSH_BODY,
                        "url": "/reminders?mode=fired",
                    }
                ),
            )
            sent += 1
        except Exception as exc:
            details = web_push_client.summarize_exception(exc)
            was_removed = False
            if endpoint and details["is_invalid_subscription"]:
                was_removed = push_subscription_repo.remove(client_id=client_id, endpoint=endpoint)
                if was_removed:
                    removed += 1

            logger.warning(
                (
                    "push test send failed: client_id=%s endpoint=%s "
                    "exception_type=%s exception_message=%s invalid_subscription=%s removed=%s"
                ),
                client_id,
                endpoint,
                details["exception_type"],
                details["message"],
                details["is_invalid_subscription"],
                was_removed,
            )
            errors.append(
                {
                    "endpoint": endpoint,
                    "exception_type": details["exception_type"],
                    "message": details["message"],
                    "summary": details["summary"],
                    "removed_due_to_invalid": details["is_invalid_subscription"],
                    "removed": was_removed,
                }
            )

    compact_summary = f"sent={sent} removed={removed} errors={len(errors)}"
    first_error_summary = str(errors[0].get("summary")) if errors else None
    result = {
        "ok": sent > 0,
        "sent": sent,
        "removed": removed,
        "endpoint_match": endpoint_match,
        "summary": compact_summary,
        "errors": errors,
    }
    push_test_diagnostic_repo.upsert_last_test(
        client_id=client_id,
        test_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        ok=result["ok"],
        sent=sent,
        removed=removed,
        first_error_summary=first_error_summary,
    )
    return result


@app.post("/push/pushover-test")
def send_pushover_test():
    result = pushover_client.send_pushover(
        title=PushoverText.TEST_TITLE,
        message=PushoverText.TEST_MESSAGE,
        url=SETTINGS.APP_BASE_URL or None,
        url_title=PushoverText.TEST_URL_TITLE,
        priority=0,
    )
    return {
        "ok": bool(result.get("succeeded")),
        "attempted": bool(result.get("attempted")),
        "succeeded": bool(result.get("succeeded")),
        "reason": result.get("reason"),
        "status": result.get("status"),
        "response": result.get("response"),
    }


@app.get("/push/status")
def get_push_status(client_id: str, endpoint: str | None = None):
    clean_client_id = str(client_id or "").strip()
    if not clean_client_id:
        return {"ok": False, "error": "client_id is required"}

    subscriptions = push_subscription_repo.list_for_client(clean_client_id)
    has_subscription = len(subscriptions) > 0
    endpoint_match = None
    clean_endpoint = str(endpoint or "").strip()
    if clean_endpoint:
        endpoint_match = any(str(row.get("endpoint") or "") == clean_endpoint for row in subscriptions)

    return {
        "ok": True,
        "client_id": clean_client_id,
        "web_push_configured": web_push_client.is_enabled,
        "subscription_count": len(subscriptions),
        "backend_subscription_saved": has_subscription,
        "endpoint_match": endpoint_match,
        "last_test": push_test_diagnostic_repo.get_for_client(clean_client_id),
        "notification_preferences": push_policy_repo.get_notification_preferences(),
    }


@app.get("/push/notification-preferences")
def get_notification_preferences():
    return {
        "ok": True,
        "preferences": push_policy_repo.get_notification_preferences(),
        "supported_modes": NOTIFICATION_SUPPORTED_MODES,
    }


@app.patch("/push/notification-preferences")
def update_notification_preferences(payload: dict):
    mode = str(payload.get("mode") or "").strip()
    if mode not in NOTIFICATION_MODES:
        return {
            "ok": False,
            "error": "invalid notification mode",
            "supported_modes": NOTIFICATION_SUPPORTED_MODES,
        }
    return {
        "ok": True,
        "preferences": push_policy_repo.set_notification_mode(mode),
        "supported_modes": NOTIFICATION_SUPPORTED_MODES,
    }


@app.post("/internal/daily-summary/send")
def send_daily_summary(payload: dict):
    slot = str(payload.get("slot") or "").strip()
    if slot not in DAILY_SUMMARY_SLOTS:
        return {
            "ok": False,
            "error": DailySummaryText.INVALID_SLOT,
            "slot": slot,
            "supported_slots": list(DAILY_SUMMARY_SLOTS),
            "sent": 0,
            "skipped": 0,
            "errors": [],
        }

    local_date = _daily_summary_local_date()
    dedupe_key = f"daily-summary:{local_date}:{slot}"
    subscriptions = push_subscription_repo.list_all() if push_subscription_repo is not None else []
    if not SETTINGS.DAILY_SUMMARY_ENABLED:
        return {
            "ok": True,
            "slot": slot,
            "dedupe_key": dedupe_key,
            "sent": 0,
            "skipped": len(subscriptions),
            "removed": 0,
            "errors": [],
            "error_count": 0,
            "reason": DailySummaryText.DISABLED,
            "error": DailySummaryText.DISABLED,
        }
    delivery_route = _notification_route_for_daily_summary()
    if delivery_route == "web_push" and (web_push_client is None or not web_push_client.is_enabled):
        return {
            "ok": True,
            "slot": slot,
            "dedupe_key": dedupe_key,
            "sent": 0,
            "skipped": len(subscriptions),
            "removed": 0,
            "errors": [],
            "error_count": 0,
        }
    if delivery_route == "pushover" and not SETTINGS.PUSHOVER_EMERGENCY_ENABLED:
        return {
            "ok": True,
            "slot": slot,
            "dedupe_key": dedupe_key,
            "sent": 0,
            "skipped": 1,
            "removed": 0,
            "errors": [],
            "error_count": 0,
            "reason": "Pushover emergency disabled",
            "error": "Pushover emergency disabled",
        }
    if not subscriptions:
        if delivery_route == "pushover":
            subscriptions = [{"client_id": "pushover", "endpoint": "pushover"}]
        else:
            return {
                "ok": True,
                "slot": slot,
                "dedupe_key": dedupe_key,
                "sent": 0,
                "skipped": 0,
                "removed": 0,
                "errors": [],
                "error_count": 0,
            }

    should_send = push_policy_repo.record_event_once(event_key=dedupe_key, event_type="daily-summary")
    if not should_send:
        return {
            "ok": True,
            "slot": slot,
            "dedupe_key": dedupe_key,
            "sent": 0,
            "skipped": len(subscriptions),
            "removed": 0,
            "errors": [],
            "error_count": 0,
        }

    summary = dashboard_service.get_widget_summary()
    title = DAILY_SUMMARY_SLOTS[slot]
    body = _build_daily_summary_body(summary)
    url = reminder_service._build_absolute_url("/") or "/"
    if delivery_route == "pushover":
        result = _send_daily_summary_pushover(title=title, body=body, url=url)
    else:
        result = _send_daily_summary_web_push(title=title, body=body, url=url)
    result["skipped"] = int(result.get("skipped") or 0)
    errors = result.get("errors") or []
    return {
        "ok": True,
        "slot": slot,
        "dedupe_key": dedupe_key,
        "sent": result["sent"],
        "skipped": result["skipped"],
        "removed": result["removed"],
        "errors": errors,
        "error_count": len(errors),
    }


@app.post("/internal/reminders/fire-due")
def fire_due_reminders():
    rows = reminder_service.fire_due_reminders()
    return {"ok": True, "count": len(rows), "items": rows}


@app.post("/internal/reminders/scan-missed")
def scan_missed_reminders():
    rows = reminder_service.scan_missed_reminders()
    overdue_rows = reminder_service.scan_task_overdue_pushes()
    return {
        "ok": True,
        "count": len(rows),
        "items": rows,
        "overdue_push_count": len(overdue_rows),
        "overdue_items": overdue_rows,
    }


@app.post("/internal/tasks/scan-overdue-pushes")
def scan_overdue_pushes():
    rows = reminder_service.scan_task_overdue_pushes()
    return {"ok": True, "count": len(rows), "items": rows}


@app.post("/internal/claim-day/ensure-task")
def internal_ensure_claim_day_task():
    return claim_day_task_service.ensure_today_task()


@app.post("/internal/fax/received")
def notify_fax_received(payload: dict):
    fax_id = str(payload.get("fax_id") or "").strip()
    if not fax_id:
        return {"ok": False, "error": "fax_id is required"}
    title = str(payload.get("title") or "").strip() or None
    event_id = str(payload.get("event_id") or "").strip() or None
    remote_number = str(payload.get("remote_number") or "").strip() or None
    local_device = str(payload.get("local_device") or "").strip() or None
    sent = reminder_service.notify_fax_received(
        fax_id=fax_id,
        title=title,
        event_id=event_id,
        remote_number=remote_number,
        local_device=local_device,
    )
    return {"ok": True, "sent": bool(sent)}


@app.post("/internal/fax/send-failed")
def notify_fax_send_failed(payload: dict):
    fax_id = str(payload.get("fax_id") or "").strip()
    if not fax_id:
        return {"ok": False, "error": "fax_id is required"}
    title = str(payload.get("title") or "").strip() or None
    event_id = str(payload.get("event_id") or "").strip() or None
    target = str(payload.get("target") or payload.get("fax_number") or "").strip() or None
    error_message = str(payload.get("error_message") or payload.get("reason") or "").strip() or None
    sent = reminder_service.notify_fax_send_failed(
        fax_id=fax_id,
        title=title,
        event_id=event_id,
        target=target,
        error_message=error_message,
    )
    return {"ok": True, "sent": bool(sent)}


@app.post("/internal/lifecycle/maintain")
def run_lifecycle_maintenance():
    archived_tasks = task_service.archive_old_done_tasks()
    cleanup = reminder_service.cleanup_removed_items()
    fax_cleanup = fax_service.cleanup_stale_inbox_items()
    return {
        "ok": True,
        "archived_tasks": archived_tasks,
        "hard_deleted_tasks": cleanup["tasks_deleted"],
        "hard_deleted_events": cleanup["events_deleted"],
        "hard_deleted_reminders": cleanup["reminders_deleted"],
        "hard_deleted_fax_inbox": fax_cleanup["fax_inbox_deleted"],
        "fax_temp_files_deleted": fax_cleanup["fax_temp_files_deleted"],
        "fax_inbox_retention_days": fax_cleanup["fax_inbox_retention_days"],
        "fired_retention_days": SETTINGS.LIFECYCLE_FIRED_RETENTION_DAYS,
    }
