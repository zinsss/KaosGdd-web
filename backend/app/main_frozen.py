import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import engine
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.task_service import TaskService


APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")

items_repo = ItemsRepo(engine)
task_repo = TaskRepo(engine)
task_service = TaskService(items_repo, task_repo)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema_v0(engine)
    yield


app = FastAPI(title=APP_NAME, lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True, "app": APP_NAME, "mode": "frozen-v0"}


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
