from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.config import DbTables, SETTINGS
from app.engine.event_service import EventService
from app.engine.holiday_service import EVENT_CLASS_CLAIM_DAY
from app.engine.task_service import TaskService

CLAIM_DAY_TASK_TITLE = "청구하기"
CLAIM_DAY_TASK_TAG = "claim-day"
AUTO_TASK_TAG = "auto"
CLAIM_DAY_TASK_DEDUPE_PREFIX = "claim-day-task:"


def _local_today() -> date:
    try:
        return datetime.now(ZoneInfo(SETTINGS.APP_TIMEZONE)).date()
    except Exception:
        return datetime.now(timezone.utc).date()


def claim_day_task_dedupe_tag(claim_date: date | str) -> str:
    return f"{CLAIM_DAY_TASK_DEDUPE_PREFIX}{claim_date}"


def claim_day_task_raw(claim_date: date | str) -> str:
    claim_date_text = str(claim_date)
    return "\n".join(
        [
            f"-- {CLAIM_DAY_TASK_TITLE}",
            f"d:{claim_date_text} 22:00",
            f"r:{claim_date_text} 20:00",
            f"r:{claim_date_text} 21:00",
            f"#{CLAIM_DAY_TASK_TAG} #{AUTO_TASK_TAG}",
        ]
    )


class ClaimDayTaskService:
    def __init__(self, *, event_service: EventService, task_service: TaskService) -> None:
        self.event_service = event_service
        self.task_service = task_service

    def ensure_today_task(self) -> dict:
        return self.ensure_task_for_date(_local_today())

    def ensure_task_for_date(self, claim_date: date) -> dict:
        if not self.is_claim_day(claim_date):
            return {"ok": True, "created": False, "skipped": True, "reason": "not claim day"}

        dedupe_tag = claim_day_task_dedupe_tag(claim_date)
        existing_id = self._find_existing_task_id(dedupe_tag)
        if existing_id:
            return {"ok": True, "created": False, "skipped": True, "reason": "already exists", "id": existing_id}

        item_id = self.task_service.create_task(title=CLAIM_DAY_TASK_TITLE)
        ok, error = self.task_service.update_task_from_raw(
            item_id,
            claim_day_task_raw(claim_date),
            timezone_name=SETTINGS.APP_TIMEZONE,
        )
        if not ok:
            self.task_service.remove_task_hard(item_id)
            return {
                "ok": False,
                "created": False,
                "skipped": True,
                "reason": "raw setup failed",
                "error": error or "invalid task raw",
            }

        tags = self.task_service.items_repo.list_item_tags(item_id)
        self.task_service.items_repo.replace_item_tags(item_id, [*tags, dedupe_tag])
        return {"ok": True, "created": True, "skipped": False, "id": item_id}

    def is_claim_day(self, claim_date: date) -> bool:
        claim_date_text = claim_date.isoformat()
        events = self.event_service.list_events_in_range(
            start_date=claim_date_text,
            end_date=claim_date_text,
            mode="active",
        )
        return any(
            event.get("event_class") == EVENT_CLASS_CLAIM_DAY
            and event.get("start_date") <= claim_date_text <= (event.get("end_date") or event.get("start_date"))
            for event in events
        )

    def _find_existing_task_id(self, dedupe_tag: str) -> str | None:
        with self.task_service.task_repo.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id
                    FROM {items} i
                    JOIN {task_items} t ON t.item_id = i.id
                    JOIN {item_tags} it ON it.item_id = i.id
                    WHERE i.item_type = 'task'
                      AND it.tag = :dedupe_tag
                    LIMIT 1
                    """.format(
                        items=DbTables.ITEMS,
                        task_items=DbTables.TASK_ITEMS,
                        item_tags=DbTables.ITEM_TAGS,
                    )
                ),
                {"dedupe_tag": dedupe_tag},
            ).mappings().first()
        return str(row["id"]) if row else None
