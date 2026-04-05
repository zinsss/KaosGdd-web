from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.utils.task_raw import REPEAT_TAG_PREFIX, export_task_raw, parse_task_raw
from app.utils.timefmt import format_dt_for_ui


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

    def list_tasks(self) -> list[dict]:
        rows = self.task_repo.list_active_tasks()
        return [self._decorate_task(row, include_reminders=False) for row in rows]

    def get_task(self, item_id: str) -> dict | None:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return None
        return self._decorate_task(detail, include_reminders=True)

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

    def toggle_task(self, item_id: str):
        return self.task_repo.toggle_done(item_id)

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
            else:
                visible_tags.append(tag)

        remind_ats: list[str] = []
        if self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item_id)
            for reminder in reminders:
                if reminder.get("state") in {"scheduled", "snoozed", "fired", "missed"}:
                    if reminder.get("state") == "snoozed" and reminder.get("snoozed_until"):
                        remind_ats.append(reminder["snoozed_until"])
                    elif reminder.get("remind_at"):
                        remind_ats.append(reminder["remind_at"])

        return export_task_raw(
            detail,
            tags=visible_tags,
            remind_ats=remind_ats,
            repeat_rule=repeat_rule,
        )

    def update_task_from_raw(self, item_id: str, raw_text: str) -> tuple[bool, str | None]:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_task_raw(raw_text)
        except ValueError as exc:
            return False, str(exc)

        ok = self.update_task(
            item_id,
            title=parsed.get("title"),
            due_at=parsed.get("due_at"),
            memo=parsed.get("memo"),
        )
        if not ok:
            return False, "not found"

        tags = list(parsed.get("tags") or [])
        repeat_rule = str(parsed.get("repeat_rule") or "").strip()
        if repeat_rule:
            tags.append(REPEAT_TAG_PREFIX + repeat_rule)
        self.items_repo.replace_item_tags(item_id, tags)

        if self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item_id)
            for reminder in reminders:
                if reminder.get("state") in {"scheduled", "snoozed", "fired", "missed"}:
                    self.reminder_repo.mark_cancelled(reminder["id"])

            reminder_title = f"Reminder • {parsed.get('title')}"
            for remind_at in parsed.get("remind_ats") or []:
                self.reminder_repo.create_reminder_item(
                    title=reminder_title,
                    remind_at=remind_at,
                    parent_item_id=item_id,
                )

        return True, None

    def _decorate_task(self, task: dict, *, include_reminders: bool) -> dict:
        item = dict(task)
        item["due_at_display"] = format_dt_for_ui(item.get("due_at"))
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["item_type"] = item.get("item_type") or "task"

        tags = self.items_repo.list_item_tags(item["id"])
        visible_tags = []
        repeat_rule = None

        for tag in tags:
            if tag.startswith(REPEAT_TAG_PREFIX):
                repeat_rule = tag[len(REPEAT_TAG_PREFIX):]
            else:
                visible_tags.append(tag)

        item["tags"] = visible_tags
        item["repeat_rule"] = repeat_rule

        if include_reminders and self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item["id"])
            for reminder in reminders:
                reminder["remind_at_display"] = format_dt_for_ui(reminder.get("remind_at"))
                reminder["last_fired_at_display"] = format_dt_for_ui(reminder.get("last_fired_at"))
                reminder["acked_at_display"] = format_dt_for_ui(reminder.get("acked_at"))
                reminder["snoozed_until_display"] = format_dt_for_ui(reminder.get("snoozed_until"))
            item["reminders"] = reminders
        else:
            item["reminders"] = []

        return item