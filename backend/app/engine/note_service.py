from app.db.repo.items_repo import ItemsRepo
from app.db.repo.note_repo import NoteRepo
from app.utils.note_raw import derive_note_title, export_note_raw, parse_note_raw
from app.utils.timefmt import format_dt_for_ui


class NoteService:
    def __init__(self, items_repo: ItemsRepo, note_repo: NoteRepo) -> None:
        self.items_repo = items_repo
        self.note_repo = note_repo

    def create_note(self, *, body: str) -> str:
        title = derive_note_title(body)
        item_id = self.items_repo.create_item("note", title)
        self.note_repo.create_note(item_id, body=body)
        return item_id

    def list_notes(self, mode: str = "active") -> list[dict]:
        rows = self.note_repo.list_notes(mode=mode)
        return [self._decorate_note(row) for row in rows]

    def get_note(self, item_id: str) -> dict | None:
        detail = self.note_repo.get_note_detail(item_id)
        if detail is None:
            return None
        return self._decorate_note(detail)

    def update_note_from_raw(self, item_id: str, raw_text: str) -> tuple[bool, str | None]:
        detail = self.note_repo.get_note_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_note_raw(raw_text)
        except ValueError as exc:
            return False, str(exc)

        body = parsed["body"]
        self.note_repo.update_note_body(item_id, body=body)
        self.items_repo.update_item_title(item_id, derive_note_title(body))
        return True, None

    def export_note_raw(self, item_id: str) -> str | None:
        detail = self.note_repo.get_note_detail(item_id)
        if detail is None:
            return None
        return export_note_raw(detail)

    def remove_note(self, item_id: str) -> bool:
        if self.note_repo.get_note_detail(item_id) is None:
            return False
        return self.items_repo.soft_delete_item(item_id)

    def _decorate_note(self, note: dict) -> dict:
        item = dict(note)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))
        return item
