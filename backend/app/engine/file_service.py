import mimetypes
import os
from pathlib import Path
from uuid import uuid4

from app.config import SETTINGS
from app.db.repo.file_repo import FileRepo
from app.db.repo.items_repo import ItemsRepo
from app.utils.file_raw import export_file_raw, parse_file_raw
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


class FileService:
    def __init__(self, items_repo: ItemsRepo, file_repo: FileRepo) -> None:
        self.items_repo = items_repo
        self.file_repo = file_repo

    def _safe_storage_path(self, original_filename: str) -> str:
        root = os.path.abspath(SETTINGS.FILE_STORAGE_DIR)
        os.makedirs(root, exist_ok=True)

        suffix = Path(str(original_filename or "")).suffix.lower()
        safe_suffix = suffix if suffix and len(suffix) <= 10 and suffix.replace(".", "").isalnum() else ""
        generated_name = f"{uuid4().hex}{safe_suffix}"
        path = os.path.abspath(os.path.join(root, generated_name))
        if not path.startswith(root + os.sep):
            raise ValueError("unsafe storage path")
        return path

    def create_file(self, *, original_filename: str, mime_type: str, content: bytes) -> str:
        display_name = str(original_filename or "").strip() or "uploaded-file"
        detected_mime = str(mime_type or "").strip() or mimetypes.guess_type(display_name)[0] or "application/octet-stream"

        item_id = self.items_repo.create_item("file", display_name)
        stored_path = self._safe_storage_path(display_name)
        with open(stored_path, "wb") as handle:
            handle.write(content)

        self.file_repo.create_file(
            item_id,
            original_filename=display_name,
            stored_path=stored_path,
            mime_type=detected_mime,
            size_bytes=len(content),
        )
        return item_id

    def list_files(self, mode: str = "active") -> list[dict]:
        rows = self.file_repo.list_files(mode=mode)
        return [self._decorate_file(row) for row in rows]

    def get_file(self, item_id: str) -> dict | None:
        row = self.file_repo.get_file_detail(item_id)
        if row is None:
            return None
        return self._decorate_file(row)

    def get_file_binary(self, item_id: str) -> tuple[dict, str] | None:
        detail = self.file_repo.get_file_detail(item_id)
        if detail is None:
            return None
        path = str(detail.get("stored_path") or "")
        if not path or not os.path.isfile(path):
            return None
        return detail, path

    def export_file_raw(self, item_id: str) -> str | None:
        detail = self.file_repo.get_file_detail(item_id)
        if detail is None:
            return None
        tags = self.items_repo.list_item_tags(item_id)
        return export_file_raw(
            detail,
            tags=tags,
            linked_item_ids=self.items_repo.list_item_links(item_id),
        )

    def update_file_from_raw(self, item_id: str, raw_text: str) -> tuple[bool, str | None]:
        detail = self.file_repo.get_file_detail(item_id)
        if detail is None:
            return False, "not found"

        try:
            parsed = parse_file_raw(raw_text)
            self.items_repo.validate_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        except ValueError as exc:
            return False, str(exc)

        self.items_repo.update_item_title(item_id, parsed["title"])
        self.file_repo.update_file_meta(item_id, memo=parsed.get("memo"), fax_number=parsed.get("fax_number"))
        self.items_repo.replace_item_tags(item_id, list(parsed.get("tags") or []))
        self.items_repo.replace_item_links(item_id, list(parsed.get("linked_item_ids") or []))
        return True, None

    def remove_file(self, item_id: str) -> bool:
        if self.file_repo.get_file_detail(item_id) is None:
            return False
        return self.items_repo.soft_delete_item(item_id)

    def _decorate_file(self, row: dict) -> dict:
        item = dict(row)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["removed_at_display"] = format_dt_for_ui(item.get("deleted_at"))
        item["tags"] = self.items_repo.list_item_tags(item["id"])

        resolved_links = self.items_repo.list_resolved_item_links(item["id"])
        item["links"] = []
        for link in resolved_links:
            target_id = str(link.get("target_item_id") or "")
            target_type = str(link.get("target_item_type") or "").lower()
            title = str(link.get("target_title") or "").strip()
            item["links"].append(
                {
                    "id": target_id,
                    "item_type": target_type or None,
                    "title": title or "missing item",
                    "marker": ITEM_TYPE_MARKERS.get(target_type, "?"),
                    "is_missing": not bool(title),
                    "href": _item_type_path(target_type, target_id),
                }
            )
        return item
