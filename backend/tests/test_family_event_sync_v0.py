from sqlalchemy import create_engine

from app.db.repo.event_repo import EventRepo
from app.db.repo.family_repo import FamilyRepo
from app.db.repo.items_repo import ItemsRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.event_service import EventService
from app.engine.family_event_sync_service import (
    FAMILY_CALENDAR_RECORD_KEY,
    FAMILY_EVENT_MIRROR_TAG_PREFIX,
    FAMILY_EVENT_SONG_TAG,
    FamilyEventSyncService,
)


def make_sync_service(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'family-event-sync.db'}")
    init_schema_v0(engine)
    items_repo = ItemsRepo(engine)
    event_repo = EventRepo(engine)
    reminder_repo = ReminderRepo(engine)
    family_repo = FamilyRepo(engine)
    event_service = EventService(items_repo, event_repo, reminder_repo)
    return FamilyEventSyncService(
        items_repo=items_repo,
        event_repo=event_repo,
        event_service=event_service,
        family_repo=family_repo,
    ), items_repo, event_repo, event_service, family_repo


def mirrored_event_id(items_repo: ItemsRepo, family_event_id: str) -> str:
    rows = items_repo.list_items_by_tag_prefix(f"{FAMILY_EVENT_MIRROR_TAG_PREFIX}{family_event_id}")
    active = [row for row in rows if row["status"] == "active"]
    assert len(active) == 1
    return active[0]["id"]


def active_mirror_count(items_repo: ItemsRepo, family_event_id: str) -> int:
    return sum(
        1
        for row in items_repo.list_items_by_tag_prefix(f"{FAMILY_EVENT_MIRROR_TAG_PREFIX}{family_event_id}")
        if row["status"] == "active"
    )


def test_shared_family_all_day_event_creates_main_projection(tmp_path) -> None:
    sync_service, items_repo, event_repo, event_service, family_repo = make_sync_service(tmp_path)

    synced = sync_service.save_calendar_items(
        [
            {
                "id": "family-event-1",
                "title": "학교 휴무",
                "date": "2026-07-10",
                "allDay": True,
                "memo": "준비물 확인",
                "sharedWithSong": True,
            }
        ]
    )

    mirror_id = mirrored_event_id(items_repo, "family-event-1")
    detail = event_repo.get_event_detail(mirror_id)
    assert detail["title"] == "학교 휴무"
    assert detail["start_date"] == "2026-07-10"
    assert detail["end_date"] == "2026-07-10"
    assert detail["memo"] == "준비물 확인\n\n#family"
    assert synced[0]["mainItemId"] == mirror_id
    assert items_repo.list_item_tags(mirror_id) == [
        "family",
        "family-event:family-event-1",
    ]
    assert event_service.get_event(mirror_id)["tags"] == ["family"]
    assert "family-event:family-event-1" not in event_service.export_event_raw(mirror_id)
    assert family_repo.list_main_links()[0]["familyItemId"] == "family-event-1"
    assert family_repo.list_main_links()[0]["mainItemId"] == mirror_id


def test_shared_family_timed_event_projects_as_main_all_day_with_time_in_memo(tmp_path) -> None:
    sync_service, items_repo, event_repo, _, _ = make_sync_service(tmp_path)

    sync_service.save_calendar_items(
        [
            {
                "id": "family-event-1",
                "title": "언어치료",
                "date": "2026-07-10",
                "allDay": False,
                "startTime": "14:30",
                "endTime": "16:00",
                "memo": "카드 챙기기",
                "sharedWithSong": True,
            }
        ]
    )

    mirror_id = mirrored_event_id(items_repo, "family-event-1")
    detail = event_repo.get_event_detail(mirror_id)
    assert detail["start_date"] == "2026-07-10"
    assert detail["end_date"] == "2026-07-10"
    assert detail["memo"] == "시간: 14:30–16:00\n\n카드 챙기기\n\n#family"


def test_family_event_repeated_sync_does_not_duplicate_main_projection(tmp_path) -> None:
    sync_service, items_repo, _, _, _ = make_sync_service(tmp_path)
    payload = [
        {
            "id": "family-event-1",
            "title": "병원",
            "date": "2026-07-10",
            "allDay": True,
            "sharedWithSong": True,
        }
    ]

    sync_service.save_calendar_items(payload)
    sync_service.save_calendar_items(payload)

    assert active_mirror_count(items_repo, "family-event-1") == 1


def test_unshared_family_event_removes_main_projection(tmp_path) -> None:
    sync_service, items_repo, event_repo, _, _ = make_sync_service(tmp_path)

    sync_service.save_calendar_items(
        [
            {
                "id": "family-event-1",
                "title": "병원",
                "date": "2026-07-10",
                "allDay": True,
                "sharedWithSong": True,
            }
        ]
    )
    mirror_id = mirrored_event_id(items_repo, "family-event-1")

    synced = sync_service.save_calendar_items(
        [
            {
                "id": "family-event-1",
                "title": "병원",
                "date": "2026-07-10",
                "allDay": True,
                "sharedWithSong": False,
            }
        ]
    )

    assert synced[0]["sharedWithSong"] is False
    assert event_repo.get_event_detail(mirror_id)["status"] == "removed"


def test_main_family_tagged_event_is_adopted_once(tmp_path) -> None:
    sync_service, items_repo, event_repo, event_service, family_repo = make_sync_service(tmp_path)
    main_id = event_service.create_event(
        title="메인 일정",
        start_date="2026-07-10",
        end_date="2026-07-10",
        memo="시간: 14:30–16:00\n\n메모\n\n#family",
    )
    items_repo.replace_item_tags(main_id, [FAMILY_EVENT_SONG_TAG])

    loaded = sync_service.load_calendar_items()
    loaded_again = sync_service.load_calendar_items()

    assert len(loaded) == 1
    assert len(loaded_again) == 1
    assert loaded[0]["title"] == "메인 일정"
    assert loaded[0]["date"] == "2026-07-10"
    assert loaded[0]["allDay"] is False
    assert loaded[0]["startTime"] == "14:30"
    assert loaded[0]["endTime"] == "16:00"
    assert loaded[0]["memo"] == "메모"
    assert loaded[0]["sharedWithSong"] is True
    assert loaded[0]["mainItemId"] == main_id
    assert loaded[0]["adoptedFromMain"] is True
    assert items_repo.list_item_tags(main_id) == [
        "family",
        f"family-event:{loaded[0]['id']}",
    ]
    assert family_repo.list_events() == loaded
    assert event_repo.get_event_detail(main_id)["status"] == "active"


def test_main_family_tagged_event_reads_time_from_memo_with_spaced_dash(tmp_path) -> None:
    sync_service, items_repo, _, event_service, _ = make_sync_service(tmp_path)
    main_id = event_service.create_event(
        title="메인 일정",
        start_date="2026-07-10",
        end_date="2026-07-10",
        memo="시간: 09:10 - 10:40\n\n메모\n\n#family",
    )
    items_repo.replace_item_tags(main_id, [FAMILY_EVENT_SONG_TAG])

    loaded = sync_service.load_calendar_items()

    assert len(loaded) == 1
    assert loaded[0]["allDay"] is False
    assert loaded[0]["startTime"] == "09:10"
    assert loaded[0]["endTime"] == "10:40"
    assert loaded[0]["memo"] == "메모"


def test_main_mirror_edit_reconciles_time_memo_back_to_family_event(tmp_path) -> None:
    sync_service, items_repo, event_repo, event_service, family_repo = make_sync_service(tmp_path)
    synced = sync_service.save_calendar_items(
        [
            {
                "id": "family-event-1",
                "title": "언어치료",
                "date": "2026-07-10",
                "allDay": False,
                "startTime": "14:30",
                "endTime": "16:00",
                "memo": "카드 챙기기",
                "sharedWithSong": True,
            }
        ]
    )
    mirror_id = mirrored_event_id(items_repo, "family-event-1")
    assert event_repo.get_event_detail(mirror_id)["memo"] == "시간: 14:30–16:00\n\n카드 챙기기\n\n#family"

    event_service.update_event(
        mirror_id,
        title="언어치료 변경",
        start_date="2026-07-11",
        end_date="2026-07-11",
        memo="시간: 15:00 ~ 16:20\n\n다른 메모\n\n#family",
    )

    loaded = sync_service.load_calendar_items()

    assert synced[0]["mainItemId"] == mirror_id
    assert loaded[0]["id"] == "family-event-1"
    assert loaded[0]["title"] == "언어치료 변경"
    assert loaded[0]["date"] == "2026-07-11"
    assert loaded[0]["allDay"] is False
    assert loaded[0]["startTime"] == "15:00"
    assert loaded[0]["endTime"] == "16:20"
    assert loaded[0]["memo"] == "다른 메모"
    assert family_repo.list_events() == loaded


def test_main_mirror_reconcile_preserves_family_event_color(tmp_path) -> None:
    sync_service, items_repo, event_repo, event_service, family_repo = make_sync_service(tmp_path)
    synced = sync_service.save_calendar_items(
        [
            {
                "id": "family-event-1",
                "title": "병원",
                "date": "2026-07-10",
                "allDay": False,
                "startTime": "10:00",
                "endTime": "11:00",
                "memo": "",
                "color": "blue",
                "sharedWithSong": True,
            }
        ]
    )
    mirror_id = mirrored_event_id(items_repo, "family-event-1")

    event_service.update_event(
        mirror_id,
        title="병원 변경",
        start_date="2026-07-10",
        end_date="2026-07-10",
        memo="시간: 10:20–11:20\n\n#family",
    )
    loaded = sync_service.load_calendar_items()

    assert synced[0]["color"] == "blue"
    assert loaded[0]["title"] == "병원 변경"
    assert loaded[0]["startTime"] == "10:20"
    assert loaded[0]["endTime"] == "11:20"
    assert loaded[0]["color"] == "blue"
    assert family_repo.list_events()[0]["color"] == "blue"


def test_removing_family_song_tag_from_adopted_main_event_disconnects_projection(tmp_path) -> None:
    sync_service, items_repo, event_repo, event_service, family_repo = make_sync_service(tmp_path)
    main_id = event_service.create_event(
        title="메인 일정",
        start_date="2026-07-10",
        end_date="2026-07-10",
        memo="#family",
    )
    items_repo.replace_item_tags(main_id, [FAMILY_EVENT_SONG_TAG])
    adopted = sync_service.load_calendar_items()
    family_id = adopted[0]["id"]
    items_repo.replace_item_tags(main_id, [f"{FAMILY_EVENT_MIRROR_TAG_PREFIX}{family_id}"])

    loaded = sync_service.load_calendar_items()

    assert loaded[0]["id"] == family_id
    assert loaded[0]["sharedWithSong"] is False
    assert loaded[0]["mainItemId"] == ""
    assert family_repo.list_events() == loaded
    assert event_repo.get_event_detail(main_id)["status"] == "removed"
