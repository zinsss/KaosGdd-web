from __future__ import annotations

import importlib
import os
from datetime import datetime
from pathlib import Path

import pytest
from app.utils import datetime_parse
from app.utils.capture_parse import parse_capture_input
from app.utils.datetime_parse import parse_local_datetime_to_iso


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "capture-reminder-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_capture_standalone_reminder_multiline_datetime_first(main_module) -> None:
    payload = main_module.capture_item({"raw": "!! 2026-12-15 23:38\n테스팅"})

    assert payload["ok"] is True
    detail = main_module.get_reminder(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "테스팅"


def test_capture_standalone_reminder_single_line_datetime_first(main_module) -> None:
    payload = main_module.capture_item({"raw": "!! 2026-12-15 23:38 테스팅"})

    assert payload["ok"] is True
    detail = main_module.get_reminder(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "테스팅"


def test_capture_standalone_reminder_tags_parsed_in_new_grammar(main_module) -> None:
    payload = main_module.capture_item({"raw": "!! 2026-12-15 23:38\n테스팅\n#work #clinic"})

    assert payload["ok"] is True
    detail = main_module.get_reminder(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["tags"] == ["clinic", "work"]


def test_capture_standalone_reminder_missing_datetime_fails(main_module) -> None:
    payload = main_module.capture_item({"raw": "!! 테스팅"})

    assert payload["ok"] is False
    assert payload["error"] == "!! requires at least one reminder datetime"


def test_capture_standalone_reminder_invalid_datetime_fails(main_module) -> None:
    payload = main_module.capture_item({"raw": "!! 2026-13-15 23:38 테스팅"})

    assert payload["ok"] is False
    assert payload["error"] == "invalid datetime format: 2026-13-15 23:38"


def test_capture_standalone_reminder_old_r_form_still_accepted(main_module) -> None:
    payload = main_module.capture_item({"raw": "!! 테스팅\nr:2026-12-15 23:38"})

    assert payload["ok"] is True
    detail = main_module.get_reminder(payload["id"])
    assert detail["ok"] is True
    assert detail["item"]["title"] == "테스팅"


def test_reminder_raw_export_uses_datetime_first_canonical_form(main_module) -> None:
    created = main_module.capture_item({"raw": "!! 2026-12-15 23:38\nsimple reminder title\n#work #clinic"})
    assert created["ok"] is True

    raw = main_module.get_reminder_raw(created["id"])
    assert raw["ok"] is True
    assert raw["raw"] == "!! 2026-12-15 23:38\nsimple reminder title\n#clinic #work"


def test_reminder_raw_update_roundtrips_datetime_first_form(main_module) -> None:
    created = main_module.capture_item({"raw": "!! 2026-12-15 23:38\nfirst title\n#one"})
    assert created["ok"] is True

    updated = main_module.update_reminder(
        created["id"],
        {"raw": "!! 2026-12-16 09:10\nupdated reminder title\n#work #clinic"},
    )
    assert updated["ok"] is True

    raw = main_module.get_reminder_raw(created["id"])
    assert raw["ok"] is True
    assert raw["raw"] == "!! 2026-12-16 09:10\nupdated reminder title\n#clinic #work"


def test_capture_uses_client_timezone_for_near_future_validation(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T02:28:00+00:00")  # 19:28 in America/Los_Angeles
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    payload = main_module.capture_item(
        {
            "raw": "!! 2026-04-18 19:29 timezone check",
            "timezone": "America/Los_Angeles",
        }
    )

    assert payload["ok"] is True


def test_standalone_reminder_today_defaults_to_1030(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T14:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    parsed = parse_capture_input(
        "!! today buy batteries",
        timezone_name="America/Los_Angeles",
    )

    assert parsed["kind"] == "simple_reminder"
    assert parsed["parsed"]["title"] == "buy batteries"
    assert parsed["parsed"]["remind_ats"] == ["2026-04-19T17:30:00+00:00"]


def test_standalone_reminder_tomorrow_defaults_to_1030(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T14:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    parsed = parse_capture_input(
        "!! tomorrow call clinic",
        timezone_name="America/Los_Angeles",
    )

    assert parsed["kind"] == "simple_reminder"
    assert parsed["parsed"]["title"] == "call clinic"
    assert parsed["parsed"]["remind_ats"] == ["2026-04-20T17:30:00+00:00"]


def test_standalone_reminder_relative_day_with_time(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T14:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    parsed = parse_capture_input(
        "!! +3d 09:00 send fax",
        timezone_name="America/Los_Angeles",
    )

    assert parsed["kind"] == "simple_reminder"
    assert parsed["parsed"]["title"] == "send fax"
    assert parsed["parsed"]["remind_ats"] == ["2026-04-22T16:00:00+00:00"]


def test_standalone_reminder_time_only_defaults_to_today(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T14:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    parsed = parse_capture_input(
        "!! 09:00 call lab",
        timezone_name="America/Los_Angeles",
    )

    assert parsed["kind"] == "simple_reminder"
    assert parsed["parsed"]["title"] == "call lab"
    assert parsed["parsed"]["remind_ats"] == ["2026-04-19T16:00:00+00:00"]


def test_standalone_reminder_date_only_defaults_to_1030(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T14:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    parsed = parse_capture_input(
        "!! 2026-04-25 send fax",
        timezone_name="America/Los_Angeles",
    )

    assert parsed["kind"] == "simple_reminder"
    assert parsed["parsed"]["title"] == "send fax"
    assert parsed["parsed"]["remind_ats"] == ["2026-04-25T17:30:00+00:00"]


def test_standalone_and_r_parsing_share_same_datetime_normalization(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T14:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    standalone = parse_capture_input("!! +3d 09:00 title", timezone_name="America/Los_Angeles")
    from_r = parse_local_datetime_to_iso(
        "+3d 09:00",
        allow_past=False,
        timezone_name="America/Los_Angeles",
    )

    assert standalone["parsed"]["remind_ats"] == [from_r]


def test_standalone_past_datetime_matches_shared_parser_behavior(main_module, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_now = datetime.fromisoformat("2026-04-19T20:00:00+00:00")
    monkeypatch.setattr(datetime_parse, "_current_utc_now", lambda: fixed_now)

    with pytest.raises(ValueError, match="resolved datetime is in the past"):
        parse_capture_input(
            "!! today title",
            timezone_name="America/Los_Angeles",
        )
