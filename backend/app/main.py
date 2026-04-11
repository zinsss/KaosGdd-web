import os
import asyncio
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import SETTINGS
from app.core.db import engine
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.task_service import TaskService
from app.engine.reminder_service import ReminderService
from app.schemas.reminders import normalize_minutes
from app.strings import ApiText
from app.utils.capture_parse import parse_capture_input


APP_NAME = os.getenv("APP_NAME", SETTINGS.APP_NAME)

items_repo = ItemsRepo(engine)
task_repo = TaskRepo(engine)
reminder_repo = ReminderRepo(engine)
task_service = TaskService(items_repo, task_repo, reminder_repo)
reminder_service = ReminderService(reminder_repo, task_repo, items_repo)


async def _run_lifecycle_once() -> None:
    task_service.archive_old_done_tasks()
    reminder_service.cleanup_removed_items()


async def _lifecycle_scheduler_loop() -> None:
    while True:
        now = datetime.now(timezone.utc)
        next_run = now.replace(
            hour=SETTINGS.LIFECYCLE_DAILY_UTC_HOUR,
            minute=SETTINGS.LIFECYCLE_DAILY_UTC_MINUTE,
            second=0,
            microsecond=0,
        )
        if next_run <= now:
            next_run = next_run + timedelta(days=1)
        sleep_seconds = max(1, int((next_run - now).total_seconds()))
        await asyncio.sleep(sleep_seconds)
        await _run_lifecycle_once()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema_v0(engine)
    scheduler_task = None
    if SETTINGS.LIFECYCLE_RUN_ON_STARTUP:
        await _run_lifecycle_once()
    if SETTINGS.LIFECYCLE_SCHEDULER_ENABLED:
        scheduler_task = asyncio.create_task(_lifecycle_scheduler_loop())
    yield
    if scheduler_task is not None:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title=APP_NAME, lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "ok": True,
        "app": APP_NAME,
        "mode": "frozen-v0-raw-edit",
        "timezone": SETTINGS.APP_TIMEZONE,
    }


@app.get("/tasks")
def list_tasks(mode: str = "active"):
    return {"items": task_service.list_tasks(mode=mode)}


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
        return {"ok": False, "error": error or "invalid reminder raw"}
    return {"ok": True}


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
    ok, error = task_service.update_task_from_raw(task_id, raw_text)
    if not ok:
        return {"ok": False, "error": error or ApiText.INVALID_RAW_TASK}
    return {"ok": True}


@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: str):
    result = task_service.toggle_task(task_id)
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
    try:
        parsed = parse_capture_input(raw_text)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    kind = parsed["kind"]

    if kind == "modal":
        modal_type = str(parsed["parsed"].get("modal_type") or "").strip()
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
        ok, error = task_service.update_task_from_raw(item_id, parsed["raw"])
        if not ok:
            return {"ok": False, "error": error or ApiText.INVALID_RAW_TASK}
        return {"ok": True, "kind": kind, "id": item_id}

    if kind == "simple_reminder":
        title = str(parsed["parsed"].get("title") or "").strip()
        remind_ats = list(parsed["parsed"].get("remind_ats") or [])
        if not title:
            return {"ok": False, "error": "title is required"}
        if not remind_ats:
            return {"ok": False, "error": "!! requires at least one reminder datetime"}

        created_ids = []
        for remind_at in remind_ats:
            ok, status, reminder_id = reminder_service.create_standalone_reminder(
                title=title,
                remind_at=remind_at,
            )
            if not ok:
                return {"ok": False, "error": status}
            created_ids.append(reminder_id)

        return {"ok": True, "kind": kind, "id": created_ids[0], "ids": created_ids}

    if kind == "journal":
        return {"ok": False, "error": "// journal not supported yet in this schema"}

    if kind == "event":
        return {"ok": False, "error": "^^ event not supported yet in this schema"}

    return {"ok": False, "error": "unsupported capture kind"}


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


@app.post("/internal/reminders/fire-due")
def fire_due_reminders():
    rows = reminder_service.fire_due_reminders()
    return {"ok": True, "count": len(rows), "items": rows}


@app.post("/internal/reminders/scan-missed")
def scan_missed_reminders():
    rows = reminder_service.scan_missed_reminders()
    return {"ok": True, "count": len(rows), "items": rows}


@app.post("/internal/lifecycle/maintain")
def run_lifecycle_maintenance():
    archived_tasks = task_service.archive_old_done_tasks()
    cleanup = reminder_service.cleanup_removed_items()
    return {
        "ok": True,
        "archived_tasks": archived_tasks,
        "hard_deleted_tasks": cleanup["tasks_deleted"],
        "hard_deleted_reminders": cleanup["reminders_deleted"],
        "fired_retention_days": SETTINGS.LIFECYCLE_FIRED_RETENTION_DAYS,
    }
