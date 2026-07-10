from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import SETTINGS
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.utils.ids import new_id
from app.utils.repeat import compute_next_due_at
from app.utils.task_raw import (
    CLAIM_DAY_TASK_DEDUPE_PREFIX,
    REPEAT_TAG_PREFIX,
    export_task_raw,
    normalize_relative_reminder_token,
    parse_task_raw,
    resolve_relative_reminder,
)
from app.utils.timefmt import format_dt_for_ui


ITEM_TYPE_MARKERS = {
    "task": "T",
    "event": "E",
    "journal": "J",
    "note": "N",
    "file": "F",
    "fax": "X",
    "mail": "M",
}

RECURRENCE_SCOPE_CURRENT_ONLY = "current_only"
RECURRENCE_SCOPE_THIS_AND_FUTURE = "this_and_future"
_DUE_UNSET = object()


def _item_type_path(item_type: str, item_id: str) -> str | None:
    if item_type == "task":
        return f"/tasks/{item_id}"
    if item_type == "event":
        return f"/events/{item_id}"
    if item_type == "journal":
        return "/journals"
    if item_type == "note":
        return f"/notes/{item_id}"
    if item_type == "file":
        return f"/files/{item_id}"
    return None


class TaskService:
    def __init__(
        self,
        items_repo: ItemsRepo,
        task_repo: TaskRepo,
        reminder_repo: ReminderRepo | None = None,
    ) -> None:
        self.items_repo = items_repo
        self.task_repo = task_repo
        self.reminder_repo = reminder_repo

    def create_task(self, title: str, due_at: str | None = None, memo: str | None = None) -> str:
        item_id = self.items_repo.create_item("task", title)
        self.task_repo.create_task(item_id, due_at=due_at, memo=memo)
        return item_id

    def list_tasks(self, mode: str = "active") -> list[dict]:
        if mode == "done":
            done_cutoff = (
                datetime.now(timezone.utc) - timedelta(days=SETTINGS.LIFECYCLE_DONE_RETENTION_DAYS)
            ).isoformat(timespec="seconds")
            rows = self.task_repo.list_tasks_done(done_cutoff_iso=done_cutoff)
        elif mode == "archived":
            rows = self.task_repo.list_tasks_archived()
        elif mode == "removed":
            rows = self.task_repo.list_tasks_removed()
        else:
            rows = self.task_repo.list_tasks_active()
        return [self._decorate_task(row, include_reminders=False, include_subtasks=False) for row in rows]

    def get_task(self, item_id: str) -> dict | None:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return None
        return self._decorate_task(detail, include_reminders=True, include_subtasks=True)

    def update_task(
        self,
        item_id: str,
        *,
        title: str | None = None,
        due_at: str | None = None,
        memo: str | None = None,
        is_done: bool | None = None,
    ) -> bool:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False
        if detail.get("status") == "removed":
            return False

        next_title = title if title is not None else detail["title"]
        next_due_at = due_at if due_at is not None else detail.get("due_at")
        next_memo = memo if memo is not None else detail.get("memo")
        next_is_done = is_done if is_done is not None else bool(detail.get("is_done"))

        if next_title != detail["title"]:
            self.items_repo.update_item_title(item_id, next_title)

        self.task_repo.update_task_fields(
            item_id,
            due_at=next_due_at,
            memo=next_memo,
            is_done=next_is_done,
        )
        return True

    def remove_task(self, item_id: str) -> bool:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False
        return self.items_repo.soft_delete_item(item_id)

    def remove_task_hard(self, item_id: str) -> bool:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False
        self.task_repo.hard_delete_task_item(item_id)
        return self.items_repo.hard_delete_item(item_id)

    def restore_task(self, item_id: str) -> bool:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False
        restored = self.items_repo.restore_item(item_id)
        if not restored:
            return False
        self.task_repo.clear_done_state(item_id)
        return True

    def toggle_task(self, item_id: str):
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return None
        if detail.get("status") != "active":
            return None
        was_done = bool(detail.get("is_done"))
        toggled = self.task_repo.toggle_done(item_id)
        if toggled is None:
            return None
        if (not was_done) and toggled:
            relative_reminder_templates = self._relative_reminder_templates_for_rollover(item_id)
            if self.reminder_repo is not None:
                self.reminder_repo.mark_linked_active_completed(item_id)
            self._rollover_repeat_task_on_completion(detail, relative_reminder_templates)
        return toggled

    def toggle_subtask(self, task_id: str, subtask_id: str):
        detail = self.task_repo.get_task_detail(task_id)
        if detail is None:
            return None
        if detail.get("status") != "active":
            return None
        return self.task_repo.toggle_subtask(task_id, subtask_id)

    def archive_old_done_tasks(self) -> int:
        done_cutoff = (
            datetime.now(timezone.utc) - timedelta(days=SETTINGS.LIFECYCLE_DONE_RETENTION_DAYS)
        ).isoformat(timespec="seconds")
        stale = self.task_repo.list_done_tasks_older_than(done_cutoff_iso=done_cutoff)
        count = 0
        for row in stale:
            if self.items_repo.archive_item(row["id"]):
                count += 1
        return count

    def export_task_raw(self, item_id: str) -> str | None:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return None

        tags = self.items_repo.list_item_tags(item_id)
        repeat_rule = None
        visible_tags = []

        for tag in tags:
            if tag.startswith(REPEAT_TAG_PREFIX):
                repeat_rule = tag[len(REPEAT_TAG_PREFIX):]
            elif tag.startswith(CLAIM_DAY_TASK_DEDUPE_PREFIX):
                continue
            else:
                visible_tags.append(tag)

        remind_ats: list[str | dict] = []
        if self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item_id)
            editable_states = {"scheduled", "snoozed", "fired", "missed"}
            for reminder in reminders:
                if reminder.get("state") not in editable_states:
                    continue
                relative_token = normalize_relative_reminder_token(reminder.get("relative_token"))
                if relative_token:
                    remind_ats.append({"remind_at": reminder.get("remind_at"), "relative_token": relative_token})
                    continue
                if reminder.get("state") == "snoozed" and reminder.get("snoozed_until"):
                    remind_ats.append(reminder["snoozed_until"])
                elif reminder.get("remind_at"):
                    remind_ats.append(reminder["remind_at"])

        subtasks = self.task_repo.list_subtasks(item_id)

        return export_task_raw(
            detail,
            tags=visible_tags,
            remind_ats=remind_ats,
            repeat_rule=repeat_rule,
            linked_item_ids=self.items_repo.list_item_links(item_id),
            subtasks=subtasks,
        )

    def update_task_from_raw(
        self,
        item_id: str,
        raw_text: str,
        *,
        reject_past_datetimes: bool = False,
        timezone_name: str | None = None,
        edit_scope: str | None = None,
    ) -> tuple[bool, str | None]:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_task_raw(
                raw_text,
                reject_past_datetimes=reject_past_datetimes,
                timezone_name=timezone_name,
            )
        except ValueError as exc:
            return False, str(exc)

        try:
            self.items_repo.validate_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        except ValueError as exc:
            return False, str(exc)

        current_repeat_rule, _ = self._extract_repeat_and_visible_tags(item_id)
        parsed_repeat_rule = str(parsed.get("repeat_rule") or "").strip() or None
        normalized_scope = self._normalize_edit_scope(edit_scope)

        if (current_repeat_rule or parsed_repeat_rule) and normalized_scope == RECURRENCE_SCOPE_THIS_AND_FUTURE:
            ok, error = self._update_recurrence_this_and_future(item_id, detail, parsed)
            if not ok:
                return False, error
            return True, None

        ok = self._apply_parsed_task_update(item_id, parsed, include_links=True, include_reminders=True)
        if not ok:
            return False, "not found"

        if parsed_repeat_rule:
            self._ensure_recurrence_metadata(item_id, detail)

        return True, None

    def _normalize_edit_scope(self, edit_scope: str | None) -> str:
        scope = str(edit_scope or RECURRENCE_SCOPE_CURRENT_ONLY).strip().lower().replace("-", "_")
        if scope in {RECURRENCE_SCOPE_CURRENT_ONLY, RECURRENCE_SCOPE_THIS_AND_FUTURE}:
            return scope
        return RECURRENCE_SCOPE_CURRENT_ONLY

    def _apply_parsed_task_update(
        self,
        item_id: str,
        parsed: dict,
        *,
        due_at=_DUE_UNSET,
        include_links: bool = False,
        include_reminders: bool = False,
    ) -> bool:
        ok = self.update_task(
            item_id,
            title=parsed.get("title"),
            due_at=parsed.get("due_at") if due_at is _DUE_UNSET else due_at,
            memo=parsed.get("memo"),
            is_done=parsed.get("is_done"),
        )
        if not ok:
            return False

        self.task_repo.replace_subtasks(item_id, list(parsed.get("subtasks") or []))

        hidden_tags = [
            tag
            for tag in self.items_repo.list_item_tags(item_id)
            if tag.startswith(CLAIM_DAY_TASK_DEDUPE_PREFIX)
        ]
        tags = [
            tag
            for tag in list(parsed.get("tags") or [])
            if not tag.startswith(CLAIM_DAY_TASK_DEDUPE_PREFIX)
        ]
        repeat_rule = str(parsed.get("repeat_rule") or "").strip()
        if repeat_rule:
            tags.append(REPEAT_TAG_PREFIX + repeat_rule)
        self.items_repo.replace_item_tags(item_id, [*tags, *dict.fromkeys(hidden_tags)])
        if include_links:
            self.items_repo.replace_item_links(item_id, list(parsed.get("linked_item_ids") or []))

        if include_reminders and self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item_id)
            editable_states = {"scheduled", "snoozed", "fired", "missed"}

            for reminder in reminders:
                if reminder.get("state") in editable_states:
                    self.reminder_repo.mark_cancelled(reminder["id"])

            reminder_title = f"Reminder • {parsed.get('title')}"
            relative_by_remind_at = {
                item.get("remind_at"): normalize_relative_reminder_token(item.get("relative_token"))
                for item in parsed.get("relative_reminders") or []
                if isinstance(item, dict)
            }
            for remind_at in parsed.get("remind_ats") or []:
                self.reminder_repo.create_reminder_item(
                    title=reminder_title,
                    remind_at=remind_at,
                    parent_item_id=item_id,
                    relative_token=relative_by_remind_at.get(remind_at),
                )

        return True

    def _ensure_recurrence_metadata(self, item_id: str, detail: dict) -> str:
        group_id = str(detail.get("recurrence_group_id") or "").strip()
        if group_id:
            return group_id
        group_id = new_id()
        self.task_repo.set_recurrence_metadata(
            item_id,
            recurrence_group_id=group_id,
            recurrence_sequence=int(detail.get("recurrence_sequence") or 0),
            recurrence_parent_id=detail.get("recurrence_parent_id"),
        )
        return group_id

    def _update_recurrence_this_and_future(self, item_id: str, detail: dict, parsed: dict) -> tuple[bool, str | None]:
        if detail.get("status") != "active" or bool(detail.get("is_done")):
            return False, "this-and-future edits require an active recurrence task"
        group_id = str(detail.get("recurrence_group_id") or "").strip()
        if not group_id:
            return False, "recurrence metadata is missing"

        current_sequence = int(detail.get("recurrence_sequence") or 0)
        affected_tasks = self.task_repo.list_active_future_recurrence_tasks(
            recurrence_group_id=group_id,
            min_sequence=current_sequence,
        )
        affected_ids = [str(task["id"]) for task in affected_tasks]
        if item_id not in affected_ids:
            return False, "recurrence metadata is missing"

        previous_values = self._recurrence_snapshot(item_id)
        due_delta = self._due_delta(detail.get("due_at"), parsed.get("due_at"))

        for task in affected_tasks:
            target_id = str(task["id"])
            next_due_at = parsed.get("due_at")
            if target_id != item_id:
                shifted_due_at = self._shift_due_at(task.get("due_at"), due_delta)
                next_due_at = shifted_due_at if shifted_due_at is not None else task.get("due_at")
            self._apply_parsed_task_update(
                target_id,
                parsed,
                due_at=next_due_at,
                include_links=target_id == item_id,
                include_reminders=target_id == item_id,
            )

        new_values = self._recurrence_snapshot(item_id)
        self.task_repo.create_recurrence_history(
            recurrence_group_id=group_id,
            edited_task_id=item_id,
            previous_values=previous_values,
            new_values=new_values,
            affected_task_ids=affected_ids,
        )
        return True, None

    def _recurrence_snapshot(self, item_id: str) -> dict:
        detail = self.task_repo.get_task_detail(item_id) or {}
        repeat_rule, visible_tags = self._extract_repeat_and_visible_tags(item_id)
        return {
            "title": detail.get("title"),
            "due_at": detail.get("due_at"),
            "repeat_rule": repeat_rule,
            "tags": visible_tags,
            "memo": detail.get("memo"),
            "subtasks": [
                {"content": subtask.get("content"), "is_done": bool(subtask.get("is_done"))}
                for subtask in self.task_repo.list_subtasks(item_id)
            ],
        }

    def _due_delta(self, old_due_at: str | None, new_due_at: str | None) -> timedelta | None:
        if not old_due_at or not new_due_at:
            return None
        try:
            return datetime.fromisoformat(str(new_due_at)) - datetime.fromisoformat(str(old_due_at))
        except ValueError:
            return None

    def _shift_due_at(self, due_at: str | None, delta: timedelta | None) -> str | None:
        if not due_at or delta is None:
            return None
        try:
            shifted = datetime.fromisoformat(str(due_at)) + delta
        except ValueError:
            return None
        return shifted.isoformat(timespec="seconds")

    def _rollover_repeat_task_on_completion(
        self,
        completed_task_detail: dict,
        relative_reminder_templates: list[str] | None = None,
    ) -> None:
        repeat_rule, visible_tags = self._extract_repeat_and_visible_tags(completed_task_detail["id"])
        if not repeat_rule:
            return

        due_at = completed_task_detail.get("due_at")
        if not due_at:
            return

        try:
            next_due_at = compute_next_due_at(due_at, repeat_rule)
        except ValueError:
            return

        recurrence_group_id = str(completed_task_detail.get("recurrence_group_id") or "").strip()
        recurrence_sequence = int(completed_task_detail.get("recurrence_sequence") or 0)
        if recurrence_group_id and self.task_repo.exists_active_recurrence_occurrence(
            recurrence_group_id=recurrence_group_id,
            due_at=next_due_at,
        ):
            return
        if not recurrence_group_id:
            recurrence_group_id = self._ensure_recurrence_metadata(
                completed_task_detail["id"],
                completed_task_detail,
            )

        if self.task_repo.exists_active_task_occurrence(
            title=str(completed_task_detail.get("title") or ""),
            due_at=next_due_at,
            repeat_rule=repeat_rule,
        ):
            return

        new_item_id = self.items_repo.create_item("task", str(completed_task_detail.get("title") or ""))
        self.task_repo.create_task(
            new_item_id,
            due_at=next_due_at,
            memo=completed_task_detail.get("memo"),
            recurrence_group_id=recurrence_group_id,
            recurrence_sequence=recurrence_sequence + 1,
            recurrence_parent_id=completed_task_detail["id"],
        )

        self.items_repo.replace_item_tags(
            new_item_id,
            [*visible_tags, f"{REPEAT_TAG_PREFIX}{repeat_rule}"],
        )

        source_subtasks = self.task_repo.list_subtasks(completed_task_detail["id"])
        reset_subtasks = [{"content": st.get("content"), "is_done": False} for st in source_subtasks]
        self.task_repo.replace_subtasks(new_item_id, reset_subtasks)

        if self.reminder_repo is None or not relative_reminder_templates:
            return

        reminder_title = f"Reminder • {completed_task_detail.get('title')}"
        for relative_token in relative_reminder_templates:
            try:
                remind_at = resolve_relative_reminder(relative_token, next_due_at)
            except ValueError:
                continue
            self.reminder_repo.create_reminder_item(
                title=reminder_title,
                remind_at=remind_at,
                parent_item_id=new_item_id,
                relative_token=relative_token,
            )

    def _relative_reminder_templates_for_rollover(self, item_id: str) -> list[str]:
        if self.reminder_repo is None:
            return []

        template_states = {"scheduled", "snoozed", "missed", "fired"}
        templates: list[str] = []
        for reminder in self.reminder_repo.list_linked_reminders(item_id):
            if reminder.get("state") not in template_states:
                continue
            relative_token = normalize_relative_reminder_token(reminder.get("relative_token"))
            if relative_token and relative_token not in templates:
                templates.append(relative_token)
        return templates

    def _extract_repeat_and_visible_tags(self, item_id: str) -> tuple[str | None, list[str]]:
        tags = self.items_repo.list_item_tags(item_id)
        repeat_rule = None
        visible_tags: list[str] = []
        for tag in tags:
            if tag.startswith(REPEAT_TAG_PREFIX):
                repeat_rule = tag[len(REPEAT_TAG_PREFIX):]
            elif tag.startswith(CLAIM_DAY_TASK_DEDUPE_PREFIX):
                continue
            elif tag.startswith("family-task:") or tag.startswith("family-priority:"):
                continue
            else:
                visible_tags.append(tag)
        return repeat_rule, visible_tags

    def _due_metatag(self, due_at: str | None) -> str:
        if not due_at:
            return ""

        try:
            due_dt = datetime.fromisoformat(str(due_at))
            local_tz = ZoneInfo(SETTINGS.APP_TIMEZONE)
            due_local = due_dt.astimezone(local_tz)
            now_local = datetime.now(local_tz)
            delta_days = (due_local.date() - now_local.date()).days
        except Exception:
            return ""

        if delta_days == 0:
            return "t"
        if delta_days > 0:
            return f"-{delta_days}d"
        return f"+{abs(delta_days)}d"

    def _decorate_task(self, task: dict, *, include_reminders: bool, include_subtasks: bool) -> dict:
        item = dict(task)
        item["due_at_display"] = format_dt_for_ui(item.get("due_at"))
        item["done_at_display"] = format_dt_for_ui(item.get("done_at"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["item_type"] = item.get("item_type") or "task"

        item["subtask_total"] = int(item.get("subtask_total") or 0)
        item["subtask_done"] = int(item.get("subtask_done") or 0)

        repeat_rule, visible_tags = self._extract_repeat_and_visible_tags(item["id"])

        item["tags"] = visible_tags
        item["repeat_rule"] = repeat_rule
        item["has_tags"] = bool(visible_tags)
        item["recurrence_group_id"] = item.get("recurrence_group_id")
        item["recurrence_sequence"] = item.get("recurrence_sequence")
        item["recurrence_parent_id"] = item.get("recurrence_parent_id")

        linked_reminders = []
        if self.reminder_repo is not None:
            linked_reminders = self.reminder_repo.list_linked_reminders(item["id"])

        item["has_reminders"] = bool(linked_reminders)
        item["metatag_due"] = self._due_metatag(item.get("due_at"))

        if include_subtasks:
            item["subtasks"] = self.task_repo.list_subtasks(item["id"])
        else:
            item["subtasks"] = []

        if include_reminders and self.reminder_repo is not None:
            for reminder in linked_reminders:
                reminder["remind_at_display"] = format_dt_for_ui(reminder.get("remind_at"))
                reminder["last_fired_at_display"] = format_dt_for_ui(reminder.get("last_fired_at"))
                reminder["acked_at_display"] = format_dt_for_ui(reminder.get("acked_at"))
                reminder["snoozed_until_display"] = format_dt_for_ui(reminder.get("snoozed_until"))
            item["reminders"] = linked_reminders
        else:
            item["reminders"] = []

        item["recurrence_history"] = []
        if include_subtasks and item.get("recurrence_group_id"):
            history_rows = self.task_repo.list_recurrence_history(str(item["recurrence_group_id"]))
            for history in history_rows:
                history["edited_at_display"] = format_dt_for_ui(history.get("edited_at"))
            item["recurrence_history"] = history_rows

        resolved_links = self.items_repo.list_resolved_item_links(item["id"])
        item["links"] = []
        for link in resolved_links:
            target_id = str(link.get("target_item_id") or "")
            target_type = str(link.get("target_item_type") or "").lower()
            title = str(link.get("target_title") or "").strip()
            marker = ITEM_TYPE_MARKERS.get(target_type, "?")
            item["links"].append(
                {
                    "id": target_id,
                    "item_type": target_type or None,
                    "title": title or "missing item",
                    "marker": marker,
                    "is_missing": not bool(title),
                    "href": _item_type_path(target_type, target_id),
                }
            )

        return item
