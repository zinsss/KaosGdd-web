from __future__ import annotations

import re
from typing import Any

from app.db.repo.event_repo import EventRepo
from app.db.repo.family_repo import FamilyRepo
from app.db.repo.items_repo import ItemsRepo
from app.engine.event_service import EventService


FAMILY_CALENDAR_RECORD_KEY = "calendar-items"
FAMILY_EVENT_MIRROR_TAG_PREFIX = "family-event:"
FAMILY_EVENT_SONG_TAG = "family"
FAMILY_EVENT_LEGACY_SONG_TAGS = {"family쏭", "family-song", "family:song"}
FAMILY_EVENT_MEMO_MARKERS = {"#family", "#family쏭"}
FAMILY_EVENT_TIME_MEMO_RE = re.compile(
    r"^시간:\s*(\d{2}:\d{2})\s*[–~-]\s*(\d{2}:\d{2})\s*$",
    flags=re.MULTILINE,
)


def _clean(value: Any) -> str:
    return str(value or "").strip()


def normalize_family_event(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    title = _clean(item.get("title"))
    date = _clean(item.get("date"))
    if not title or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return None
    all_day = item.get("allDay") is True
    return {
        **item,
        "id": _clean(item.get("id")) or f"family-event-{date}-{abs(hash((title, date))) % 10_000_000}",
        "title": title,
        "date": date,
        "startTime": "" if all_day else (_clean(item.get("startTime")) or "09:00"),
        "endTime": "" if all_day else (_clean(item.get("endTime")) or "09:40"),
        "memo": str(item.get("memo") or ""),
        "color": _clean(item.get("color")) or "pink",
        "allDay": all_day,
        "sharedWithSong": item.get("sharedWithSong") is True,
        "mainItemId": _clean(item.get("mainItemId")),
        "adoptedFromMain": item.get("adoptedFromMain") is True,
    }


def _family_event_time_memo(item: dict[str, Any]) -> str:
    memo = str(item.get("memo") or "").strip()
    if item.get("allDay"):
        return f"{memo}\n\n#family".strip()
    time_line = f"시간: {item.get('startTime')}–{item.get('endTime')}"
    return "\n\n".join(part for part in [time_line, memo, "#family"] if part).strip()


def _strip_family_marker_from_memo(memo: str | None) -> str:
    lines = [line for line in str(memo or "").splitlines() if line.strip() not in FAMILY_EVENT_MEMO_MARKERS]
    return "\n".join(lines).strip()


def _event_from_main(detail: dict[str, Any]) -> dict[str, Any]:
    memo = _strip_family_marker_from_memo(detail.get("memo"))
    time_match = FAMILY_EVENT_TIME_MEMO_RE.search(memo)
    all_day = time_match is None
    start_time = time_match.group(1) if time_match else ""
    end_time = time_match.group(2) if time_match else ""
    if time_match:
        memo = FAMILY_EVENT_TIME_MEMO_RE.sub("", memo).strip()
    main_id = _clean(detail.get("id"))
    return normalize_family_event(
        {
            "id": f"main-event-{main_id}",
            "title": detail.get("title"),
            "date": detail.get("start_date"),
            "allDay": all_day,
            "startTime": start_time,
            "endTime": end_time,
            "memo": memo,
            "sharedWithSong": True,
            "mainItemId": main_id,
            "adoptedFromMain": True,
        }
    )


def _system_holiday_from_main(detail: dict[str, Any]) -> dict[str, Any] | None:
    if not detail.get("is_imported_calendar_event"):
        return None
    event_class = _clean(detail.get("event_class")) or "observance"
    return normalize_family_event(
        {
            "id": f"system-holiday-{_clean(detail.get('canonical_event_id') or detail.get('id'))}",
            "title": detail.get("title"),
            "date": detail.get("start_date"),
            "endDate": detail.get("end_date") if detail.get("end_date") != detail.get("start_date") else "",
            "allDay": True,
            "memo": detail.get("memo") or "",
            "color": "pink" if event_class == "public-holiday" else "gray",
            "sharedWithSong": False,
            "mainItemId": _clean(detail.get("canonical_event_id") or detail.get("id")),
            "adoptedFromMain": False,
            "readOnly": True,
            "systemEvent": True,
            "isImportedCalendarEvent": True,
            "eventClass": event_class,
            "classificationSource": _clean(detail.get("classification_source")),
        }
    )


class FamilyEventSyncService:
    def __init__(
        self,
        *,
        items_repo: ItemsRepo,
        event_repo: EventRepo,
        event_service: EventService,
        family_repo: FamilyRepo,
    ) -> None:
        self.items_repo = items_repo
        self.event_repo = event_repo
        self.event_service = event_service
        self.family_repo = family_repo

    def load_calendar_items(self, *, start_date: str | None = None, end_date: str | None = None) -> list[dict[str, Any]]:
        items = [event for event in (normalize_family_event(item) for item in self.family_repo.list_events()) if event]
        adopted, adopted_changed = self.adopt_main_family_events(items)
        reconciled, reconciled_changed = self.reconcile_from_mirrors(adopted)
        if adopted_changed or reconciled_changed:
            self.family_repo.replace_events(reconciled)
        return [*reconciled, *self._system_holidays(start_date=start_date, end_date=end_date)]

    def save_calendar_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = [
            event
            for event in (
                normalize_family_event(item)
                for item in items
                if isinstance(item, dict) and not item.get("readOnly") and not item.get("systemEvent")
            )
            if event
        ]
        synced = self.sync(normalized)
        self.family_repo.replace_events(synced)
        return synced

    def sync(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        active_ids = {item["id"].lower() for item in items}
        for item in items:
            if item.get("sharedWithSong"):
                self._upsert_mirror(item)
            else:
                self._remove_mirrors(item["id"])
        self._remove_stale_mirrors(active_ids)
        return items

    def adopt_main_family_events(self, items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
        next_items = list(items)
        existing_main_ids = {_clean(item.get("mainItemId")) for item in next_items if item.get("mainItemId")}
        existing_family_ids = {_clean(item.get("id")).lower() for item in next_items}
        changed = False
        candidates = [
            *self.items_repo.list_items_by_tag_prefix(FAMILY_EVENT_SONG_TAG),
            *(row for tag in FAMILY_EVENT_LEGACY_SONG_TAGS for row in self.items_repo.list_items_by_tag_prefix(tag)),
        ]
        seen_rows = set()
        for row in candidates:
            if row.get("id") in seen_rows:
                continue
            seen_rows.add(row.get("id"))
            if row.get("item_type") != "event" or row.get("status") == "removed":
                continue
            main_id = _clean(row.get("id"))
            tags = self.items_repo.list_item_tags(main_id)
            if FAMILY_EVENT_SONG_TAG not in tags and not FAMILY_EVENT_LEGACY_SONG_TAGS.intersection(tags):
                continue
            if any(tag.startswith(FAMILY_EVENT_MIRROR_TAG_PREFIX) for tag in tags):
                continue
            if main_id in existing_main_ids:
                continue
            detail = self.event_service.get_event(main_id)
            adopted = _event_from_main(detail) if detail else None
            if not adopted or adopted["id"].lower() in existing_family_ids:
                continue
            next_items.append(adopted)
            self.items_repo.replace_item_tags(main_id, [*tags, self._mirror_tag(adopted["id"])])
            self._link_family_main(adopted["id"], main_id, adopted_from_main=True, shared_with_main=True)
            existing_main_ids.add(main_id)
            existing_family_ids.add(adopted["id"].lower())
            changed = True
        return next_items, changed

    def reconcile_from_mirrors(self, items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
        changed = False
        next_items = []
        for item in items:
            if not item.get("sharedWithSong"):
                next_items.append(item)
                continue
            mirrors = [mirror for mirror in self._find_mirrors(item["id"]) if mirror.get("status") != "removed"]
            if not mirrors:
                next_items.append(item)
                continue
            detail = self.event_service.get_event(mirrors[0]["id"])
            mirror_tags = self.items_repo.list_item_tags(mirrors[0]["id"])
            if FAMILY_EVENT_SONG_TAG not in mirror_tags and not FAMILY_EVENT_LEGACY_SONG_TAGS.intersection(mirror_tags):
                next_item = {**item, "sharedWithSong": False, "mainItemId": ""}
                self.items_repo.soft_delete_item(mirrors[0]["id"])
                next_items.append(next_item)
                changed = True
                continue
            if not detail:
                next_items.append(item)
                continue
            adopted = _event_from_main({**detail, "id": mirrors[0]["id"]})
            if not adopted:
                next_items.append(item)
                continue
            next_item = {
                **item,
                **adopted,
                "id": item["id"],
                "color": item.get("color") or adopted.get("color") or "pink",
                "mainItemId": mirrors[0]["id"],
                "sharedWithSong": True,
            }
            if next_item != item:
                changed = True
            next_items.append(next_item)
        return next_items, changed

    def _mirror_tag(self, family_event_id: str) -> str:
        return f"{FAMILY_EVENT_MIRROR_TAG_PREFIX}{_clean(family_event_id).lower()}"

    def _find_mirrors(self, family_event_id: str) -> list[dict[str, Any]]:
        mirror_tag = self._mirror_tag(family_event_id)
        rows = self.items_repo.list_items_by_tag_prefix(mirror_tag)
        return [row for row in rows if mirror_tag in self.items_repo.list_item_tags(row["id"])]

    def _upsert_mirror(self, item: dict[str, Any]) -> str:
        mirrors = self._find_mirrors(item["id"])
        primary = mirrors[0] if mirrors else None
        for duplicate in mirrors[1:]:
            self.items_repo.soft_delete_item(duplicate["id"])
        memo = _family_event_time_memo(item)
        if primary is None:
            main_id = self.event_service.create_event(title=item["title"], start_date=item["date"], end_date=item["date"], memo=memo)
        else:
            main_id = primary["id"]
            if primary.get("status") == "removed":
                self.items_repo.restore_item(main_id)
            self.event_service.update_event(main_id, title=item["title"], start_date=item["date"], end_date=item["date"], memo=memo)
        tags = [FAMILY_EVENT_SONG_TAG, self._mirror_tag(item["id"])]
        self.items_repo.replace_item_tags(main_id, tags)
        item["mainItemId"] = main_id
        self._link_family_main(
            item["id"],
            main_id,
            adopted_from_main=bool(item.get("adoptedFromMain")),
            shared_with_main=True,
        )
        return main_id

    def _remove_mirrors(self, family_event_id: str) -> None:
        for mirror in self._find_mirrors(family_event_id):
            self.items_repo.soft_delete_item(mirror["id"])
        self._unlink_family_main(family_event_id)

    def _remove_stale_mirrors(self, active_family_ids: set[str]) -> None:
        for row in self.items_repo.list_items_by_tag_prefix(FAMILY_EVENT_MIRROR_TAG_PREFIX):
            tags = self.items_repo.list_item_tags(row["id"])
            family_tags = [tag for tag in tags if tag.startswith(FAMILY_EVENT_MIRROR_TAG_PREFIX)]
            if not family_tags:
                continue
            family_id = family_tags[0][len(FAMILY_EVENT_MIRROR_TAG_PREFIX):]
            if family_id not in active_family_ids:
                self.items_repo.soft_delete_item(row["id"])
                self._unlink_family_main(family_id)

    def _link_family_main(
        self,
        family_event_id: str,
        main_item_id: str,
        *,
        adopted_from_main: bool,
        shared_with_main: bool,
    ) -> None:
        self.family_repo.upsert_main_link(
            family_item_id=family_event_id,
            main_item_id=main_item_id,
            family_module="events",
            origin="main" if adopted_from_main else "family",
            adopted_from_main=adopted_from_main,
            shared_with_main=shared_with_main,
        )

    def _unlink_family_main(self, family_event_id: str) -> None:
        self.family_repo.remove_main_links_for_family_item(family_event_id, "events")

    def _system_holidays(self, *, start_date: str | None, end_date: str | None) -> list[dict[str, Any]]:
        if not start_date or not end_date:
            return []
        events = self.event_service.list_events_in_range(start_date=start_date, end_date=end_date, mode="active")
        holidays = [_system_holiday_from_main(event) for event in events]
        return [holiday for holiday in holidays if holiday]
