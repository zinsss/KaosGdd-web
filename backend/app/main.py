import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import create_engine, text


APP_NAME = os.getenv("APP_NAME", "KaosGdd Web")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/kaosgdd.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    is_done INTEGER NOT NULL DEFAULT 0,
                    due_at TEXT NULL,
                    reminder_at TEXT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=APP_NAME, lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True, "app": APP_NAME}


@app.get("/tasks")
def list_tasks():
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, title, is_done, due_at, reminder_at, created_at, updated_at
                FROM tasks
                ORDER BY is_done ASC, id DESC
                """
            )
        ).mappings().all()
    return {"items": [dict(row) for row in rows]}


@app.post("/tasks")
def create_task(payload: dict):
    title = (payload.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": "title is required"}

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO tasks (title, due_at, reminder_at)
                VALUES (:title, :due_at, :reminder_at)
                """
            ),
            {
                "title": title,
                "due_at": payload.get("due_at"),
                "reminder_at": payload.get("reminder_at"),
            },
        )

    return {"ok": True}


@app.get("/tasks/{task_id}")
def get_task(task_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, title, is_done, due_at, reminder_at, created_at, updated_at
                FROM tasks
                WHERE id = :task_id
                """
            ),
            {"task_id": task_id},
        ).mappings().first()

    if not row:
        return {"ok": False, "error": "not found"}

    return {"ok": True, "item": dict(row)}


@app.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: dict):
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT id FROM tasks WHERE id = :task_id"),
            {"task_id": task_id},
        ).first()

        if not exists:
            return {"ok": False, "error": "not found"}

        conn.execute(
            text(
                """
                UPDATE tasks
                SET
                    title = COALESCE(:title, title),
                    due_at = :due_at,
                    reminder_at = :reminder_at,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :task_id
                """
            ),
            {
                "task_id": task_id,
                "title": payload.get("title"),
                "due_at": payload.get("due_at"),
                "reminder_at": payload.get("reminder_at"),
            },
        )

    return {"ok": True}


@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT is_done FROM tasks WHERE id = :task_id"),
            {"task_id": task_id},
        ).first()

        if not row:
            return {"ok": False, "error": "not found"}

        new_value = 0 if row[0] else 1

        conn.execute(
            text(
                """
                UPDATE tasks
                SET is_done = :is_done,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :task_id
                """
            ),
            {"task_id": task_id, "is_done": new_value},
        )

    return {"ok": True, "is_done": bool(new_value)}
