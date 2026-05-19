from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest

from app.engine.holiday_service import HolidaySyncService
from app.integrations.holiday_ical_provider import Holiday, IcalHolidayProvider


class FakeHolidayProvider:
    def __init__(self, holidays: list[Holiday] | None = None, *, error: Exception | None = None) -> None:
        self.holidays = holidays or []
        self.error = error

    def fetch_holidays(self, *, start_year: int, end_year: int) -> list[Holiday]:
        if self.error is not None:
            raise self.error
        return self.holidays


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "korean-holiday-sync-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ.pop("KOREAN_HOLIDAY_ICAL_URL", None)

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    yield main_module
    main_module.stop_holiday_sync_scheduler()


def sync_service(main_module, holidays: list[Holiday] | None = None, *, error: Exception | None = None):
    return HolidaySyncService(
        main_module.items_repo,
        main_module.event_repo,
        provider=FakeHolidayProvider(holidays, error=error),
    )


def list_all_2026_events(main_module, mode: str = "active") -> list[dict]:
    return main_module.event_service.list_events_in_range(
        start_date="2026-01-01",
        end_date="2026-12-31",
        mode=mode,
    )


def test_sync_creates_korean_holiday_events(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-new-year", uid="uid-new-year", title="신정", start_date="2026-01-01")],
    )

    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["ok"] is True
    assert result["created"] == 1
    events = list_all_2026_events(main_module)
    assert len(events) == 1
    assert events[0]["title"] == "신정"
    assert events[0]["start_date"] == "2026-01-01"
    assert {"system:kr-holiday", "readonly"}.issubset(set(events[0]["tags"]))
    assert events[0]["reminders"] == []


def test_sync_is_idempotent(main_module) -> None:
    holidays = [Holiday(external_id="uid-lunar", uid="uid-lunar", title="설날", start_date="2026-02-17")]
    service = sync_service(main_module, holidays)

    first = service.sync_years(start_year=2026, end_year=2026)
    second = service.sync_years(start_year=2026, end_year=2026)

    assert first["created"] == 1
    assert second["created"] == 0
    assert second["updated"] == 0
    assert len(list_all_2026_events(main_module)) == 1


def test_changed_holiday_name_and_date_updates_existing_synced_event(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-alt", uid="uid-alt", title="대체공휴일", start_date="2026-05-05")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider(
        [Holiday(external_id="uid-alt", uid="uid-alt", title="대체 휴일", start_date="2026-05-06")]
    )
    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["updated"] == 1
    events = list_all_2026_events(main_module)
    assert len(events) == 1
    assert events[0]["title"] == "대체 휴일"
    assert events[0]["start_date"] == "2026-05-06"


def test_removed_upstream_holiday_archives_old_synced_event(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-removed", uid="uid-removed", title="삭제된 휴일", start_date="2026-10-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider([])
    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["archived"] == 1
    assert list_all_2026_events(main_module) == []
    archived = list_all_2026_events(main_module, mode="archived")
    assert len(archived) == 1
    assert archived[0]["title"] == "삭제된 휴일"


def test_user_created_events_are_untouched(main_module) -> None:
    user_id = main_module.event_service.create_event(title="User holiday plan", start_date="2026-10-01")
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-sync", uid="uid-sync", title="시스템 휴일", start_date="2026-10-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider([])
    service.sync_years(start_year=2026, end_year=2026)

    detail = main_module.get_event(user_id)
    assert detail["ok"] is True
    assert detail["item"]["status"] == "active"
    assert detail["item"]["title"] == "User holiday plan"


def test_readonly_system_holiday_protection_blocks_normal_mutation(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="uid-readonly", uid="uid-readonly", title="읽기 전용", start_date="2026-03-01")],
    )
    service.sync_years(start_year=2026, end_year=2026)
    event_id = list_all_2026_events(main_module)[0]["id"]

    patch = main_module.update_event(event_id, {"title": "Changed"})
    raw_patch = main_module.update_event_raw(event_id, {"raw": "^^ 2026-03-02\nChanged"})
    deleted = main_module.remove_event(event_id)

    assert patch == {"ok": False, "error": "event is read-only"}
    assert raw_patch == {"ok": False, "error": "event is read-only"}
    assert deleted == {"ok": False, "error": "event is read-only"}
    detail = main_module.get_event(event_id)
    assert detail["item"]["title"] == "읽기 전용"
    assert detail["item"]["status"] == "active"


def test_startup_monthly_sync_registration_does_not_duplicate_jobs(main_module, monkeypatch) -> None:
    class FakeTask:
        def __init__(self) -> None:
            self.cancelled = False

        def done(self) -> bool:
            return self.cancelled

        def cancel(self) -> None:
            self.cancelled = True

    created = []

    def fake_create_task(coro):
        coro.close()
        task = FakeTask()
        created.append(task)
        return task

    monkeypatch.setattr(main_module.SETTINGS, "KOREAN_HOLIDAY_ICAL_URL", "https://example.invalid/kr.ics")

    assert main_module.start_holiday_sync_scheduler(create_task=fake_create_task) is True
    assert main_module.start_holiday_sync_scheduler(create_task=fake_create_task) is False
    assert len(created) == 1


def test_missing_or_unreachable_ical_url_fails_safely(main_module) -> None:
    missing = HolidaySyncService(main_module.items_repo, main_module.event_repo, ical_url="")
    assert missing.sync_years(start_year=2026, end_year=2026)["skipped"] is True

    service = sync_service(main_module, error=OSError("network unavailable"))
    result = service.sync_years(start_year=2026, end_year=2026)

    assert result["ok"] is False
    assert result["skipped"] is True
    assert list_all_2026_events(main_module) == []


def test_uid_based_identity_works_correctly(main_module) -> None:
    service = sync_service(
        main_module,
        [Holiday(external_id="stable-upstream-uid", uid="stable-upstream-uid", title="Old", start_date="2026-08-15")],
    )
    service.sync_years(start_year=2026, end_year=2026)

    service.provider = FakeHolidayProvider(
        [Holiday(external_id="stable-upstream-uid", uid="stable-upstream-uid", title="New", start_date="2026-08-16")]
    )
    service.sync_years(start_year=2026, end_year=2026)

    events = list_all_2026_events(main_module)
    assert len(events) == 1
    assert events[0]["title"] == "New"
    assert events[0]["start_date"] == "2026-08-16"


def test_ical_provider_reads_vevent_uid_summary_and_date(tmp_path: Path) -> None:
    ics_path = tmp_path / "holidays.ics"
    ics_path.write_text(
        "\n".join(
            [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "BEGIN:VEVENT",
                "UID:naver-uid-1",
                "SUMMARY:개천절",
                "DTSTART;VALUE=DATE:20261003",
                "DTEND;VALUE=DATE:20261004",
                "END:VEVENT",
                "END:VCALENDAR",
            ]
        ),
        encoding="utf-8",
    )

    holidays = IcalHolidayProvider(ics_path.as_uri()).fetch_holidays(start_year=2026, end_year=2026)

    assert holidays == [
        Holiday(
            external_id="naver-uid-1",
            uid="naver-uid-1",
            title="개천절",
            start_date="2026-10-03",
            end_date=None,
        )
    ]
