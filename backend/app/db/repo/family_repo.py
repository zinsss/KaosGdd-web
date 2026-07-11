import json
from typing import Any

from sqlalchemy import bindparam, text

from app.config import DbTables
from app.utils.clock import now_iso


FAMILY_RECORD_KEY_MEMO = "memo-messages"
FAMILY_RECORD_KEY_TASKS = "tasks"
FAMILY_RECORD_KEY_LEGACY_TIMETABLE = "legacy-timetable"
FAMILY_RECORD_KEY_CALENDAR_ITEMS = "calendar-items"
FAMILY_RECORD_KEY_ROUN_STATE = "roun-state"
FAMILY_RECORD_KEY_ROUNY_OVERRIDES = "rouny-overrides"
FAMILY_RECORD_KEY_CAREGIVER_HOURS = "caregiver-hours"
FAMILY_RECORD_KEY_CAREGIVER_HOURLY_WAGE = "caregiver-hourly-wage"
FAMILY_RECORD_KEY_CAREGIVER_MONTHLY_SETTINGS = "caregiver-monthly-settings"


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _json_load(value: str | None, fallback: Any = None) -> Any:
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return fallback


def _payload(row: dict[str, Any] | None) -> Any:
    if not row:
        return None
    loaded = _json_load(row.get("payload_json"), {})
    return loaded if isinstance(loaded, dict) else {}


def _bool_int(value: Any) -> int:
    return 1 if value is True else 0


class FamilyRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def list_notes(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT payload_json
                    FROM {table}
                    WHERE deleted_at IS NULL
                    ORDER BY sort_order ASC, created_at ASC
                    """.format(table=DbTables.FAMILY_NOTES)
                )
            ).mappings().all()
        return [payload for payload in (_payload(row) for row in rows) if payload]

    def replace_notes(self, notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = [note for note in notes if isinstance(note, dict) and str(note.get("id") or "").strip()]
        now = now_iso()
        active_ids = {str(note["id"]) for note in normalized}
        with self.engine.begin() as conn:
            if active_ids:
                conn.execute(
                    text(
                        """
                        UPDATE {table}
                        SET deleted_at = :deleted_at, updated_at = :updated_at
                        WHERE deleted_at IS NULL AND id NOT IN :active_ids
                        """.format(table=DbTables.FAMILY_NOTES)
                    ).bindparams(bindparam("active_ids", expanding=True)),
                    {"active_ids": tuple(active_ids), "deleted_at": now, "updated_at": now},
                )
            else:
                conn.execute(
                    text(
                        "UPDATE {table} SET deleted_at = :deleted_at, updated_at = :updated_at WHERE deleted_at IS NULL".format(
                            table=DbTables.FAMILY_NOTES
                        )
                    ),
                    {"deleted_at": now, "updated_at": now},
                )
            for index, note in enumerate(normalized):
                payload_json = _json_dump(note)
                note_type = "checklist" if note.get("type") == "checklist" else "message"
                conn.execute(
                    text(
                        """
                        INSERT INTO {table}(
                            id, note_type, title, body, checklist_json, payload_json, sort_order, created_at, updated_at, deleted_at
                        )
                        VALUES (
                            :id, :note_type, :title, :body, :checklist_json, :payload_json, :sort_order, :created_at, :updated_at, NULL
                        )
                        ON CONFLICT(id) DO UPDATE SET
                            note_type = excluded.note_type,
                            title = excluded.title,
                            body = excluded.body,
                            checklist_json = excluded.checklist_json,
                            payload_json = excluded.payload_json,
                            sort_order = excluded.sort_order,
                            updated_at = excluded.updated_at,
                            deleted_at = NULL
                        """.format(table=DbTables.FAMILY_NOTES)
                    ),
                    {
                        "id": str(note["id"]),
                        "note_type": note_type,
                        "title": str(note.get("title") or ""),
                        "body": str(note.get("text") or ""),
                        "checklist_json": _json_dump(note.get("items") if isinstance(note.get("items"), list) else []),
                        "payload_json": payload_json,
                        "sort_order": index,
                        "created_at": now,
                        "updated_at": now,
                    },
                )
        return normalized

    def list_tasks(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT payload_json
                    FROM {table}
                    WHERE deleted_at IS NULL
                    ORDER BY sort_order ASC, created_at ASC
                    """.format(table=DbTables.FAMILY_TASKS)
                )
            ).mappings().all()
        return [payload for payload in (_payload(row) for row in rows) if payload]

    def replace_tasks(self, tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = [task for task in tasks if isinstance(task, dict) and str(task.get("id") or "").strip()]
        now = now_iso()
        active_ids = {str(task["id"]) for task in normalized}
        with self.engine.begin() as conn:
            self._soft_delete_missing(conn, DbTables.FAMILY_TASKS, active_ids, now)
            for index, task in enumerate(normalized):
                conn.execute(
                    text(
                        """
                        INSERT INTO {table}(
                            id, title, memo, due_date, priority, assignee, is_done, completed_at,
                            main_item_id, adopted_from_main, payload_json, sort_order, created_at, updated_at, deleted_at
                        )
                        VALUES (
                            :id, :title, :memo, :due_date, :priority, :assignee, :is_done, :completed_at,
                            :main_item_id, :adopted_from_main, :payload_json, :sort_order, :created_at, :updated_at, NULL
                        )
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            memo = excluded.memo,
                            due_date = excluded.due_date,
                            priority = excluded.priority,
                            assignee = excluded.assignee,
                            is_done = excluded.is_done,
                            completed_at = excluded.completed_at,
                            main_item_id = excluded.main_item_id,
                            adopted_from_main = excluded.adopted_from_main,
                            payload_json = excluded.payload_json,
                            sort_order = excluded.sort_order,
                            updated_at = excluded.updated_at,
                            deleted_at = NULL
                        """.format(table=DbTables.FAMILY_TASKS)
                    ),
                    {
                        "id": str(task["id"]),
                        "title": str(task.get("title") or ""),
                        "memo": str(task.get("description") or ""),
                        "due_date": str(task.get("due_date") or ""),
                        "priority": str(task.get("priority") or ""),
                        "assignee": str(task.get("assignee") or ""),
                        "is_done": _bool_int(task.get("done")),
                        "completed_at": task.get("completed_at"),
                        "main_item_id": str(task.get("mainItemId") or "") or None,
                        "adopted_from_main": _bool_int(task.get("adoptedFromMain")),
                        "payload_json": _json_dump(task),
                        "sort_order": index,
                        "created_at": now,
                        "updated_at": now,
                    },
                )
        return normalized

    def list_events(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT payload_json
                    FROM {table}
                    WHERE deleted_at IS NULL
                    ORDER BY event_date ASC, start_time ASC, created_at ASC
                    """.format(table=DbTables.FAMILY_EVENTS)
                )
            ).mappings().all()
        return [payload for payload in (_payload(row) for row in rows) if payload]

    def replace_events(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = [event for event in events if isinstance(event, dict) and str(event.get("id") or "").strip()]
        now = now_iso()
        active_ids = {str(event["id"]) for event in normalized}
        with self.engine.begin() as conn:
            self._soft_delete_missing(conn, DbTables.FAMILY_EVENTS, active_ids, now)
            for event in normalized:
                conn.execute(
                    text(
                        """
                        INSERT INTO {table}(
                            id, title, event_date, end_date, all_day, start_time, end_time, memo, color, priority,
                            shared_with_song, main_item_id, adopted_from_main, payload_json, created_at, updated_at, deleted_at
                        )
                        VALUES (
                            :id, :title, :event_date, :end_date, :all_day, :start_time, :end_time, :memo, :color, :priority,
                            :shared_with_song, :main_item_id, :adopted_from_main, :payload_json, :created_at, :updated_at, NULL
                        )
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            event_date = excluded.event_date,
                            end_date = excluded.end_date,
                            all_day = excluded.all_day,
                            start_time = excluded.start_time,
                            end_time = excluded.end_time,
                            memo = excluded.memo,
                            color = excluded.color,
                            priority = excluded.priority,
                            shared_with_song = excluded.shared_with_song,
                            main_item_id = excluded.main_item_id,
                            adopted_from_main = excluded.adopted_from_main,
                            payload_json = excluded.payload_json,
                            updated_at = excluded.updated_at,
                            deleted_at = NULL
                        """.format(table=DbTables.FAMILY_EVENTS)
                    ),
                    {
                        "id": str(event["id"]),
                        "title": str(event.get("title") or ""),
                        "event_date": str(event.get("date") or ""),
                        "end_date": str(event.get("endDate") or "") or None,
                        "all_day": _bool_int(event.get("allDay")),
                        "start_time": str(event.get("startTime") or ""),
                        "end_time": str(event.get("endTime") or ""),
                        "memo": str(event.get("memo") or ""),
                        "color": str(event.get("color") or "pink"),
                        "priority": str(event.get("priority") or ""),
                        "shared_with_song": _bool_int(event.get("sharedWithSong")),
                        "main_item_id": str(event.get("mainItemId") or "") or None,
                        "adopted_from_main": _bool_int(event.get("adoptedFromMain")),
                        "payload_json": _json_dump(event),
                        "created_at": now,
                        "updated_at": now,
                    },
                )
        return normalized

    def get_timetable_state(self) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            plans = conn.execute(
                text(
                    """
                    SELECT id, title, payload_json, sort_order
                    FROM {plans}
                    WHERE deleted_at IS NULL
                    ORDER BY sort_order ASC, created_at ASC
                    """.format(plans=DbTables.FAMILY_TIMETABLES)
                )
            ).mappings().all()
            entries = conn.execute(
                text(
                    """
                    SELECT timetable_id, payload_json, sort_order
                    FROM {entries}
                    WHERE deleted_at IS NULL
                    ORDER BY sort_order ASC, created_at ASC
                    """.format(entries=DbTables.FAMILY_TIMETABLE_ENTRIES)
                )
            ).mappings().all()
            assignments = conn.execute(
                text(
                    """
                    SELECT payload_json
                    FROM {history}
                    WHERE deleted_at IS NULL
                    ORDER BY start_date ASC, created_at ASC
                    """.format(history=DbTables.FAMILY_TIMETABLE_APPLICATION_HISTORY)
                )
            ).mappings().all()
        if not plans and not assignments:
            return None
        items_by_plan: dict[str, list[dict[str, Any]]] = {}
        for entry in entries:
            items_by_plan.setdefault(str(entry["timetable_id"]), []).append(_payload(entry))
        return {
            "plans": [
                {
                    **_payload(plan),
                    "id": str(plan["id"]),
                    "name": _payload(plan).get("name") or str(plan["title"]),
                    "items": items_by_plan.get(str(plan["id"]), []),
                }
                for plan in plans
            ],
            "assignments": [payload for payload in (_payload(row) for row in assignments) if payload],
        }

    def put_timetable_state(self, state: dict[str, Any]) -> dict[str, Any]:
        plans = state.get("plans") if isinstance(state, dict) else []
        assignments = state.get("assignments") if isinstance(state, dict) else []
        normalized_plans = [plan for plan in plans if isinstance(plan, dict) and str(plan.get("id") or "").strip()]
        normalized_assignments = [
            assignment for assignment in assignments if isinstance(assignment, dict) and str(assignment.get("id") or "").strip()
        ]
        now = now_iso()
        with self.engine.begin() as conn:
            self._soft_delete_missing(conn, DbTables.FAMILY_TIMETABLES, {str(plan["id"]) for plan in normalized_plans}, now)
            self._soft_delete_missing(
                conn,
                DbTables.FAMILY_TIMETABLE_APPLICATION_HISTORY,
                {str(assignment["id"]) for assignment in normalized_assignments},
                now,
            )
            for plan_index, plan in enumerate(normalized_plans):
                conn.execute(
                    text(
                        """
                        INSERT INTO {table}(id, title, payload_json, sort_order, created_at, updated_at, deleted_at)
                        VALUES (:id, :title, :payload_json, :sort_order, :created_at, :updated_at, NULL)
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            payload_json = excluded.payload_json,
                            sort_order = excluded.sort_order,
                            updated_at = excluded.updated_at,
                            deleted_at = NULL
                        """.format(table=DbTables.FAMILY_TIMETABLES)
                    ),
                    {
                        "id": str(plan["id"]),
                        "title": str(plan.get("name") or plan.get("title") or "시간표"),
                        "payload_json": _json_dump({**plan, "items": []}),
                        "sort_order": plan_index,
                        "created_at": now,
                        "updated_at": now,
                    },
                )
                items = [item for item in plan.get("items", []) if isinstance(item, dict) and str(item.get("id") or "").strip()]
                self._soft_delete_timetable_entries(conn, str(plan["id"]), {str(item["id"]) for item in items}, now)
                for item_index, item in enumerate(items):
                    conn.execute(
                        text(
                            """
                            INSERT INTO {table}(
                                id, timetable_id, entry_type, title, day_of_week, start_time, end_time, color,
                                font_family, memo, payload_json, sort_order, created_at, updated_at, deleted_at
                            )
                            VALUES (
                                :id, :timetable_id, 'template', :title, :day_of_week, :start_time, :end_time, :color,
                                :font_family, :memo, :payload_json, :sort_order, :created_at, :updated_at, NULL
                            )
                            ON CONFLICT(id) DO UPDATE SET
                                timetable_id = excluded.timetable_id,
                                title = excluded.title,
                                day_of_week = excluded.day_of_week,
                                start_time = excluded.start_time,
                                end_time = excluded.end_time,
                                color = excluded.color,
                                font_family = excluded.font_family,
                                memo = excluded.memo,
                                payload_json = excluded.payload_json,
                                sort_order = excluded.sort_order,
                                updated_at = excluded.updated_at,
                                deleted_at = NULL
                            """.format(table=DbTables.FAMILY_TIMETABLE_ENTRIES)
                        ),
                        {
                            "id": str(item["id"]),
                            "timetable_id": str(plan["id"]),
                            "title": str(item.get("title") or ""),
                            "day_of_week": int(item.get("dayOfWeek") or 1),
                            "start_time": str(item.get("startTime") or "09:00"),
                            "end_time": str(item.get("endTime") or "09:40"),
                            "color": str(item.get("color") or "pink"),
                            "font_family": str(item.get("fontFamily") or "system"),
                            "memo": str(item.get("memo") or ""),
                            "payload_json": _json_dump(item),
                            "sort_order": item_index,
                            "created_at": now,
                            "updated_at": now,
                        },
                    )
            for assignment in normalized_assignments:
                conn.execute(
                    text(
                        """
                        INSERT INTO {table}(id, timetable_id, start_date, payload_json, created_at, updated_at, deleted_at)
                        VALUES (:id, :timetable_id, :start_date, :payload_json, :created_at, :updated_at, NULL)
                        ON CONFLICT(id) DO UPDATE SET
                            timetable_id = excluded.timetable_id,
                            start_date = excluded.start_date,
                            payload_json = excluded.payload_json,
                            updated_at = excluded.updated_at,
                            deleted_at = NULL
                        """.format(table=DbTables.FAMILY_TIMETABLE_APPLICATION_HISTORY)
                    ),
                    {
                        "id": str(assignment["id"]),
                        "timetable_id": str(assignment.get("planId") or ""),
                        "start_date": str(assignment.get("startDate") or ""),
                        "payload_json": _json_dump(assignment),
                        "created_at": now,
                        "updated_at": now,
                    },
                )
        return {"plans": normalized_plans, "assignments": normalized_assignments}

    def get_calendar_state(self, state_key: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT payload_json FROM {table} WHERE state_key = :state_key LIMIT 1".format(
                        table=DbTables.FAMILY_CALENDAR
                    )
                ),
                {"state_key": state_key},
            ).mappings().first()
        if not row:
            return None
        return _json_load(row.get("payload_json"))

    def put_calendar_state(self, state_key: str, payload):
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {table}(id, state_key, payload_json, created_at, updated_at)
                    VALUES (:id, :state_key, :payload_json, :created_at, :updated_at)
                    ON CONFLICT(state_key) DO UPDATE SET
                        payload_json = excluded.payload_json,
                        updated_at = excluded.updated_at
                    """.format(table=DbTables.FAMILY_CALENDAR)
                ),
                {
                    "id": state_key,
                    "state_key": state_key,
                    "payload_json": _json_dump(payload),
                    "created_at": now,
                    "updated_at": now,
                },
            )
        return payload

    def get_caregiver_days(self) -> dict[str, Any]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    "SELECT date_key, payload_json FROM {table} WHERE deleted_at IS NULL ORDER BY date_key ASC".format(
                        table=DbTables.FAMILY_CAREGIVER_DAYS
                    )
                )
            ).mappings().all()
        return {str(row["date_key"]): _json_load(row.get("payload_json"), 0) for row in rows}

    def put_caregiver_days(self, days: dict[str, Any]) -> dict[str, Any]:
        normalized = days if isinstance(days, dict) else {}
        now = now_iso()
        active_dates = {str(date_key) for date_key, value in normalized.items() if value}
        with self.engine.begin() as conn:
            if active_dates:
                conn.execute(
                    text(
                        """
                        UPDATE {table}
                        SET deleted_at = :deleted_at, updated_at = :updated_at
                        WHERE deleted_at IS NULL AND date_key NOT IN :active_dates
                        """.format(table=DbTables.FAMILY_CAREGIVER_DAYS)
                    ).bindparams(bindparam("active_dates", expanding=True)),
                    {"active_dates": tuple(active_dates), "deleted_at": now, "updated_at": now},
                )
            else:
                conn.execute(
                    text(
                        "UPDATE {table} SET deleted_at = :deleted_at, updated_at = :updated_at WHERE deleted_at IS NULL".format(
                            table=DbTables.FAMILY_CAREGIVER_DAYS
                        )
                    ),
                    {"deleted_at": now, "updated_at": now},
                )
            for date_key, value in normalized.items():
                if not value:
                    continue
                total_hours = float(value) if isinstance(value, (int, float)) else float(value.get("totalHours") or 0)
                conn.execute(
                    text(
                        """
                        INSERT INTO {table}(date_key, total_hours, extra_total, payload_json, created_at, updated_at, deleted_at)
                        VALUES (:date_key, :total_hours, :extra_total, :payload_json, :created_at, :updated_at, NULL)
                        ON CONFLICT(date_key) DO UPDATE SET
                            total_hours = excluded.total_hours,
                            extra_total = excluded.extra_total,
                            payload_json = excluded.payload_json,
                            updated_at = excluded.updated_at,
                            deleted_at = NULL
                        """.format(table=DbTables.FAMILY_CAREGIVER_DAYS)
                    ),
                    {
                        "date_key": str(date_key),
                        "total_hours": total_hours,
                        "extra_total": int(value.get("extraTotal") or 0) if isinstance(value, dict) else 0,
                        "payload_json": _json_dump(value),
                        "created_at": now,
                        "updated_at": now,
                    },
                )
        return normalized

    def get_setting(self, setting_key: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT payload_json FROM {table} WHERE setting_key = :setting_key LIMIT 1".format(
                        table=DbTables.FAMILY_SETTINGS
                    )
                ),
                {"setting_key": setting_key},
            ).mappings().first()
        return _json_load(row.get("payload_json")) if row else None

    def put_setting(self, setting_key: str, payload):
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {table}(setting_key, payload_json, created_at, updated_at)
                    VALUES (:setting_key, :payload_json, :created_at, :updated_at)
                    ON CONFLICT(setting_key) DO UPDATE SET
                        payload_json = excluded.payload_json,
                        updated_at = excluded.updated_at
                    """.format(table=DbTables.FAMILY_SETTINGS)
                ),
                {
                    "setting_key": setting_key,
                    "payload_json": _json_dump(payload),
                    "created_at": now,
                    "updated_at": now,
                },
            )
        return payload

    def list_main_links(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT family_item_id, main_item_id, family_module, origin, adopted_from_main, shared_with_main, created_at, updated_at
                    FROM {table}
                    ORDER BY family_module ASC, created_at ASC
                    """.format(table=DbTables.FAMILY_MAIN_LINKS)
                )
            ).mappings().all()
        return [
            {
                "familyItemId": str(row["family_item_id"]),
                "mainItemId": str(row["main_item_id"]),
                "familyModule": str(row["family_module"]),
                "origin": str(row["origin"]),
                "adoptedFromMain": bool(row["adopted_from_main"]),
                "sharedWithMain": bool(row["shared_with_main"]),
                "createdAt": str(row["created_at"]),
                "updatedAt": str(row["updated_at"]),
            }
            for row in rows
        ]

    def upsert_main_link(
        self,
        *,
        family_item_id: str,
        main_item_id: str,
        family_module: str,
        origin: str = "family",
        adopted_from_main: bool = False,
        shared_with_main: bool = True,
    ) -> None:
        family_item_id = str(family_item_id or "").strip()
        main_item_id = str(main_item_id or "").strip()
        family_module = str(family_module or "").strip()
        if not family_item_id or not main_item_id or not family_module:
            return
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {table}(
                        family_item_id, main_item_id, family_module, origin, adopted_from_main, shared_with_main, created_at, updated_at
                    )
                    VALUES (
                        :family_item_id, :main_item_id, :family_module, :origin, :adopted_from_main, :shared_with_main, :created_at, :updated_at
                    )
                    ON CONFLICT(family_item_id, main_item_id) DO UPDATE SET
                        family_module = excluded.family_module,
                        origin = excluded.origin,
                        adopted_from_main = excluded.adopted_from_main,
                        shared_with_main = excluded.shared_with_main,
                        updated_at = excluded.updated_at
                    """.format(table=DbTables.FAMILY_MAIN_LINKS)
                ),
                {
                    "family_item_id": family_item_id,
                    "main_item_id": main_item_id,
                    "family_module": family_module,
                    "origin": origin,
                    "adopted_from_main": _bool_int(adopted_from_main),
                    "shared_with_main": _bool_int(shared_with_main),
                    "created_at": now,
                    "updated_at": now,
                },
            )

    def remove_main_links_for_family_item(self, family_item_id: str, family_module: str | None = None) -> None:
        family_item_id = str(family_item_id or "").strip()
        if not family_item_id:
            return
        with self.engine.begin() as conn:
            if family_module:
                conn.execute(
                    text(
                        """
                        DELETE FROM {table}
                        WHERE family_item_id = :family_item_id
                          AND family_module = :family_module
                        """.format(table=DbTables.FAMILY_MAIN_LINKS)
                    ),
                    {"family_item_id": family_item_id, "family_module": str(family_module)},
                )
            else:
                conn.execute(
                    text(
                        "DELETE FROM {table} WHERE family_item_id = :family_item_id".format(
                            table=DbTables.FAMILY_MAIN_LINKS
                        )
                    ),
                    {"family_item_id": family_item_id},
                )

    def count_entity_rows(self) -> int:
        with self.engine.begin() as conn:
            counts = [
                conn.execute(text("SELECT COUNT(*) FROM {table} WHERE deleted_at IS NULL".format(table=table))).scalar_one()
                for table in [
                    DbTables.FAMILY_NOTES,
                    DbTables.FAMILY_TASKS,
                    DbTables.FAMILY_EVENTS,
                    DbTables.FAMILY_TIMETABLES,
                    DbTables.FAMILY_TIMETABLE_ENTRIES,
                    DbTables.FAMILY_TIMETABLE_APPLICATION_HISTORY,
                    DbTables.FAMILY_CAREGIVER_DAYS,
                    DbTables.FAMILY_CAREGIVER_SESSIONS,
                ]
            ]
            settings_count = conn.execute(text("SELECT COUNT(*) FROM {table}".format(table=DbTables.FAMILY_SETTINGS))).scalar_one()
            links_count = conn.execute(text("SELECT COUNT(*) FROM {table}".format(table=DbTables.FAMILY_MAIN_LINKS))).scalar_one()
        return int(sum(int(count) for count in counts) + int(settings_count) + int(links_count))

    def get_record(self, namespace: str, record_key: str):
        if namespace == "family":
            if record_key == FAMILY_RECORD_KEY_MEMO:
                return self.list_notes()
            if record_key == FAMILY_RECORD_KEY_TASKS:
                return self.list_tasks()
            if record_key == FAMILY_RECORD_KEY_LEGACY_TIMETABLE:
                return self.get_setting("legacy-timetable") or []
            if record_key == FAMILY_RECORD_KEY_CALENDAR_ITEMS:
                return self.list_events()
            if record_key == FAMILY_RECORD_KEY_ROUN_STATE:
                return self.get_timetable_state()
            if record_key == FAMILY_RECORD_KEY_ROUNY_OVERRIDES:
                return self.get_calendar_state("rouny-overrides")
            if record_key == FAMILY_RECORD_KEY_CAREGIVER_HOURS:
                return self.get_caregiver_days()
            if record_key == FAMILY_RECORD_KEY_CAREGIVER_HOURLY_WAGE:
                return self.get_setting("caregiver-hourly-wage")
            if record_key == FAMILY_RECORD_KEY_CAREGIVER_MONTHLY_SETTINGS:
                return self.get_setting("caregiver-monthly-settings")

        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT payload_json
                    FROM {family_records}
                    WHERE namespace = :namespace
                      AND record_key = :record_key
                    LIMIT 1
                    """.format(family_records=DbTables.FAMILY_RECORDS)
                ),
                {"namespace": namespace, "record_key": record_key},
            ).mappings().first()
        return _json_load(row.get("payload_json")) if row else None

    def put_record(self, namespace: str, record_key: str, payload) -> dict:
        if namespace == "family":
            if record_key == FAMILY_RECORD_KEY_MEMO:
                return {"namespace": namespace, "record_key": record_key, "payload": self.replace_notes(payload if isinstance(payload, list) else [])}
            if record_key == FAMILY_RECORD_KEY_TASKS:
                return {"namespace": namespace, "record_key": record_key, "payload": self.replace_tasks(payload if isinstance(payload, list) else [])}
            if record_key == FAMILY_RECORD_KEY_LEGACY_TIMETABLE:
                return {"namespace": namespace, "record_key": record_key, "payload": self.put_setting("legacy-timetable", payload if isinstance(payload, list) else [])}
            if record_key == FAMILY_RECORD_KEY_CALENDAR_ITEMS:
                return {"namespace": namespace, "record_key": record_key, "payload": self.replace_events(payload if isinstance(payload, list) else [])}
            if record_key == FAMILY_RECORD_KEY_ROUN_STATE:
                return {"namespace": namespace, "record_key": record_key, "payload": self.put_timetable_state(payload if isinstance(payload, dict) else {"plans": [], "assignments": []})}
            if record_key == FAMILY_RECORD_KEY_ROUNY_OVERRIDES:
                return {"namespace": namespace, "record_key": record_key, "payload": self.put_calendar_state("rouny-overrides", payload if isinstance(payload, list) else [])}
            if record_key == FAMILY_RECORD_KEY_CAREGIVER_HOURS:
                return {"namespace": namespace, "record_key": record_key, "payload": self.put_caregiver_days(payload if isinstance(payload, dict) else {})}
            if record_key == FAMILY_RECORD_KEY_CAREGIVER_HOURLY_WAGE:
                return {"namespace": namespace, "record_key": record_key, "payload": self.put_setting("caregiver-hourly-wage", payload)}
            if record_key == FAMILY_RECORD_KEY_CAREGIVER_MONTHLY_SETTINGS:
                return {"namespace": namespace, "record_key": record_key, "payload": self.put_setting("caregiver-monthly-settings", payload if isinstance(payload, dict) else {})}

        now = now_iso()
        record_id = f"{namespace}:{record_key}"
        payload_json = _json_dump(payload)
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {family_records}(id, namespace, record_key, payload_json, created_at, updated_at)
                    VALUES (:id, :namespace, :record_key, :payload_json, :created_at, :updated_at)
                    ON CONFLICT(namespace, record_key) DO UPDATE SET
                        payload_json = excluded.payload_json,
                        updated_at = excluded.updated_at
                    """.format(family_records=DbTables.FAMILY_RECORDS)
                ),
                {
                    "id": record_id,
                    "namespace": namespace,
                    "record_key": record_key,
                    "payload_json": payload_json,
                    "created_at": now,
                    "updated_at": now,
                },
            )
        return {"namespace": namespace, "record_key": record_key, "payload": payload}

    def _soft_delete_missing(self, conn, table_name: str, active_ids: set[str], now: str) -> None:
        if active_ids:
            conn.execute(
                text(
                    """
                    UPDATE {table}
                    SET deleted_at = :deleted_at, updated_at = :updated_at
                    WHERE deleted_at IS NULL AND id NOT IN :active_ids
                    """.format(table=table_name)
                ).bindparams(bindparam("active_ids", expanding=True)),
                {"active_ids": tuple(active_ids), "deleted_at": now, "updated_at": now},
            )
        else:
            conn.execute(
                text(
                    "UPDATE {table} SET deleted_at = :deleted_at, updated_at = :updated_at WHERE deleted_at IS NULL".format(
                        table=table_name
                    )
                ),
                {"deleted_at": now, "updated_at": now},
            )

    def _soft_delete_timetable_entries(self, conn, timetable_id: str, active_ids: set[str], now: str) -> None:
        if active_ids:
            conn.execute(
                text(
                    """
                    UPDATE {table}
                    SET deleted_at = :deleted_at, updated_at = :updated_at
                    WHERE timetable_id = :timetable_id
                      AND deleted_at IS NULL
                      AND id NOT IN :active_ids
                    """.format(table=DbTables.FAMILY_TIMETABLE_ENTRIES)
                ).bindparams(bindparam("active_ids", expanding=True)),
                {"timetable_id": timetable_id, "active_ids": tuple(active_ids), "deleted_at": now, "updated_at": now},
            )
        else:
            conn.execute(
                text(
                    """
                    UPDATE {table}
                    SET deleted_at = :deleted_at, updated_at = :updated_at
                    WHERE timetable_id = :timetable_id
                      AND deleted_at IS NULL
                    """.format(table=DbTables.FAMILY_TIMETABLE_ENTRIES)
                ),
                {"timetable_id": timetable_id, "deleted_at": now, "updated_at": now},
            )
