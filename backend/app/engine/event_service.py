from app.db.repo.event_repo import EventRepo
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.utils.event_raw import export_event_raw, parse_event_raw
from app.utils.timefmt import format_dt_for_ui


class EventService:
    def __init__(
        self,
        items_repo: ItemsRepo,
        event_repo: EventRepo,
        reminder_repo: ReminderRepo | None = None,
    ) -> None:
        self.items_repo = items_repo
        self.event_repo = event_repo
        self.reminder_repo = reminder_repo

    def create_event(self, *, title: str, start_date: str, end_date: str | None = None, memo: str | None = None) -> str:
        item_id = self.items_repo.create_item("event", title)
        self.event_repo.create_event(item_id, start_date=start_date, end_date=end_date, memo=memo)
        return item_id

    def get_event(self, item_id: str) -> dict | None:
        row = self.event_repo.get_event_detail(item_id)
        if row is None:
            return None
        return self._decorate_event(row, include_reminders=True)

    def list_events_in_range(self, *, start_date: str, end_date: str, mode: str = "active") -> list[dict]:
        rows = self.event_repo.list_events_in_range(start_date=start_date, end_date=end_date, mode=mode)
        return [self._decorate_event(row, include_reminders=False) for row in rows]

    def update_event(
        self,
        item_id: str,
        *,
        title: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        memo: str | None = None,
    ) -> bool:
        detail = self.event_repo.get_event_detail(item_id)
        if detail is None or detail.get("status") == "removed":
            return False

        next_title = title if title is not None else detail["title"]
        next_start = start_date if start_date is not None else detail["start_date"]
        next_end = end_date if end_date is not None else detail.get("end_date")
        next_memo = memo if memo is not None else detail.get("memo")

        if next_title != detail["title"]:
            self.items_repo.update_item_title(item_id, next_title)

        self.event_repo.update_event_fields(item_id, start_date=next_start, end_date=next_end, memo=next_memo)
        return True

    def update_event_from_raw(
        self,
        item_id: str,
        raw_text: str,
        *,
        reject_past_datetimes: bool = False,
    ) -> tuple[bool, str | None]:
        detail = self.event_repo.get_event_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_event_raw(raw_text, reject_past_datetimes=reject_past_datetimes)
        except ValueError as exc:
            return False, str(exc)

        ok = self.update_event(
            item_id,
            title=parsed.get("title"),
            start_date=parsed.get("start_date"),
            end_date=parsed.get("end_date"),
            memo=parsed.get("memo"),
        )
        if not ok:
            return False, "not found"

        self.items_repo.replace_item_tags(item_id, list(parsed.get("tags") or []))

        if self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item_id)
            editable_states = {"scheduled", "snoozed", "fired", "missed"}
            for reminder in reminders:
                if reminder.get("state") in editable_states:
                    self.reminder_repo.mark_cancelled(reminder["id"])
            remind_ats = list(parsed.get("remind_ats") or [])
            if remind_ats:
                self.reminder_repo.create_reminder_item(
                    title=f"Reminder • {parsed.get('title')}",
                    remind_at=remind_ats[0],
                    parent_item_id=item_id,
                )

        return True, None

    def export_event_raw(self, item_id: str) -> str | None:
        detail = self.event_repo.get_event_detail(item_id)
        if detail is None:
            return None
        tags = self.items_repo.list_item_tags(item_id)
        reminder_value = None
        if self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item_id)
            editable_states = {"scheduled", "snoozed", "fired", "missed"}
            for reminder in reminders:
                if reminder.get("state") not in editable_states:
                    continue
                if reminder.get("state") == "snoozed" and reminder.get("snoozed_until"):
                    reminder_value = reminder["snoozed_until"]
                elif reminder.get("remind_at"):
                    reminder_value = reminder["remind_at"]
                break
        return export_event_raw(detail, tags=tags, remind_at=reminder_value)

    def remove_event(self, item_id: str) -> bool:
        if self.event_repo.get_event_detail(item_id) is None:
            return False
        return self.items_repo.soft_delete_item(item_id)

    def restore_event(self, item_id: str) -> bool:
        if self.event_repo.get_event_detail(item_id) is None:
            return False
        return self.items_repo.restore_item(item_id)

    def _decorate_event(self, event: dict, *, include_reminders: bool) -> dict:
        item = dict(event)
        item["start_date_display"] = str(item.get("start_date") or "")
        item["end_date_display"] = str(item.get("end_date") or "")
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))
        item["tags"] = self.items_repo.list_item_tags(item["id"])

        if include_reminders and self.reminder_repo is not None:
            reminders = self.reminder_repo.list_linked_reminders(item["id"])
            for reminder in reminders:
                reminder["remind_at_display"] = format_dt_for_ui(reminder.get("remind_at"))
                reminder["snoozed_until_display"] = format_dt_for_ui(reminder.get("snoozed_until"))
            item["reminders"] = reminders
        else:
            item["reminders"] = []
        return item
