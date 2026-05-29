from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from app.db.repo.items_repo import ItemsRepo
from app.db.repo.supply_repo import SupplyRepo
from app.utils.timefmt import format_dt_for_ui, local_date_key_for_ui


class SupplyService:
    def __init__(self, items_repo: ItemsRepo, supply_repo: SupplyRepo) -> None:
        self.items_repo = items_repo
        self.supply_repo = supply_repo

    @staticmethod
    def normalize_title(title: str) -> str:
        return " ".join(str(title or "").strip().lower().split())

    @staticmethod
    def clean_title(title: str) -> str:
        return " ".join(str(title or "").strip().split())

    def create_supply(self, title: str) -> tuple[str | None, bool]:
        clean_title = self.clean_title(title)
        if not clean_title:
            return None, False

        normalized_title = self.normalize_title(clean_title)
        self.supply_repo.touch_preset(clean_title, normalized_title)

        existing = self.supply_repo.get_active_by_normalized_title(normalized_title)
        if existing is not None:
            return str(existing.get("id") or ""), False

        item_id = self.items_repo.create_item(item_type="supply", title=clean_title, status="active")
        try:
            self.supply_repo.create_supply(item_id=item_id, normalized_title=normalized_title)
            return item_id, True
        except IntegrityError:
            self.supply_repo.hard_delete(item_id)
            existing = self.supply_repo.get_active_by_normalized_title(normalized_title)
            if existing is not None:
                return str(existing.get("id") or ""), False
            raise

    def create_supply_with_undo(self, title: str) -> tuple[str | None, bool, dict | None]:
        supply_id, created = self.create_supply(title)
        undo = None
        if supply_id and created:
            undo = self.supply_repo.record_undo(action="mark_pending", supply_id=supply_id, previous_state=None)
        return supply_id, created, undo

    def list_supplies(self, mode: str = "active") -> list[dict]:
        normalized_mode = str(mode or "active").strip().lower()
        if normalized_mode == "done":
            return [self._decorate_supply_row(row) for row in self.supply_repo.list_done()]
        return [self._decorate_supply_row(row) for row in self.supply_repo.list_active()]

    def mark_supply_done(self, supply_id: str) -> tuple[bool, dict | None]:
        previous = self.supply_repo.get_supply_snapshot(supply_id)
        if previous is None or previous.get("done_at") is not None:
            return False, None
        ok = self.supply_repo.mark_done(supply_id)
        if not ok:
            return False, None
        undo = self.supply_repo.record_undo(action="mark_stocked", supply_id=supply_id, previous_state=previous)
        return True, undo

    def delete_supply(self, supply_id: str) -> tuple[bool, dict | None]:
        previous = self.supply_repo.get_supply_snapshot(supply_id)
        if previous is None:
            return False, None
        ok = self.supply_repo.hard_delete(supply_id)
        if not ok:
            return False, None
        undo = self.supply_repo.record_undo(action="remove", supply_id=supply_id, previous_state=previous)
        return True, undo

    def undo_supply(self, undo_token: str) -> tuple[bool, str | None, dict | None]:
        token = str(undo_token or "").strip()
        if not token:
            return False, "undo token is required", None

        undo = self.supply_repo.get_undo(token)
        if undo is None:
            return False, "undo token not found", None
        if undo.get("used_at"):
            return False, "undo token was already used", None
        if undo.get("invalidated_at"):
            return False, "undo token was replaced by a newer supply action", None

        try:
            expires_at = datetime.fromisoformat(str(undo.get("expires_at")))
        except ValueError:
            return False, "undo token is invalid", None
        if expires_at < datetime.now(timezone.utc):
            return False, "undo token expired", None

        action = str(undo.get("action") or "")
        supply_id = str(undo.get("supply_id") or "")
        previous = undo.get("previous_state")

        try:
            if action == "mark_pending":
                if self.supply_repo.get_supply_snapshot(supply_id) is None:
                    return False, "supply no longer exists", None
                if not self.supply_repo.hard_delete(supply_id):
                    return False, "supply no longer exists", None
            elif action in {"mark_stocked", "remove"}:
                if not previous:
                    return False, "undo snapshot is missing", None
                if action == "mark_stocked" and self.supply_repo.get_supply_snapshot(supply_id) is None:
                    return False, "supply no longer exists", None
                self.supply_repo.restore_supply_snapshot(previous)
            else:
                return False, "undo action is unsupported", None
        except IntegrityError:
            return False, "undo conflicts with current supply state", None

        self.supply_repo.mark_undo_used(token)
        return True, None, {"action": action, "supply_id": supply_id}

    def list_presets(self) -> list[dict]:
        return self.supply_repo.list_presets(limit=15)

    def use_preset(self, name: str) -> tuple[str | None, bool]:
        return self.create_supply(name)

    def use_preset_with_undo(self, name: str) -> tuple[str | None, bool, dict | None]:
        return self.create_supply_with_undo(name)

    def _decorate_supply_row(self, row: dict) -> dict:
        decorated = dict(row)
        done_at = decorated.get("done_at")
        decorated["done_at_display"] = format_dt_for_ui(done_at)
        decorated["done_date_key"] = local_date_key_for_ui(done_at)
        return decorated
