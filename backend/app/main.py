import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import engine
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.task_service import TaskService
from app.engine.reminder_service import ReminderService
from app.schemas.reminders import normalize_minutes


APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")

items_repo = ItemsRepo(engine)
task_repo = TaskRepo(engine)
reminder_repo = ReminderRepo(engine)
task_service = TaskService(items_repo, task_repo)
reminder_service = ReminderService(reminder_repo, task_repo)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema_v0(engine)
    yield


app = FastAPI(title=APP_NAME, lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True, "app": APP_NAME, "mode": "frozen-v0-step4"}


@app.get("/tasks")
def list_tasks():
    return {"items": task_service.list_tasks()}


@app.post("/tasks")
def create_task(payload: dict):
    title = (payload.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": "title is required"}

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
        return {"ok": False, "error": "not found"}
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
        return {"ok": False, "error": "not found"}
    return {"ok": True}


@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: str):
    result = task_service.toggle_task(task_id)
    if result is None:
        return {"ok": False, "error": "not found"}
    return {"ok": True, "is_done": result}


@app.post("/tasks/{task_id}/reminders")
def create_task_reminder(task_id: str, payload: dict):
    remind_at = (payload.get("remind_at") or "").strip()
    if not remind_at:
        return {"ok": False, "error": "remind_at is required"}

    ok, status, reminder_id = reminder_service.create_task_reminder(
        task_item_id=task_id,
        remind_at=remind_at,
        title=payload.get("title"),
        alert_policy=payload.get("alert_policy"),
    )
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "id": reminder_id, "status": status}


@app.post("/reminders/{reminder_id}/ack")
def ack_reminder(reminder_id: str):
    ok, status = reminder_service.ack_reminder(reminder_id)
    if not ok:
        return {"ok": False, "error": status}
    return {"ok": True, "status": status}


@app.post("/reminders/{reminder_id}/snooze")
def snooze_reminder(reminder_id: str, payload: dict):
    minutes = normalize_minutes(payload.get("minutes"), default=10)
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