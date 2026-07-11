from sqlalchemy import create_engine, text

from app.db.repo.family_repo import FamilyRepo
from app.db.schema_v0 import init_schema_v0


def test_family_backend_v2_schema_and_repo_round_trip(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'family.db'}")
    init_schema_v0(engine)
    repo = FamilyRepo(engine)

    with engine.begin() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'family_%'")
            ).all()
        }

    assert {
        "family_notes",
        "family_tasks",
        "family_events",
        "family_timetables",
        "family_timetable_entries",
        "family_timetable_history",
        "family_caregiver_days",
        "family_caregiver_sessions",
        "family_settings",
        "family_main_links",
    }.issubset(tables)

    repo.replace_notes([{"id": "note-1", "text": "메모"}])
    repo.replace_tasks([{"id": "task-1", "title": "약 사기", "assignee": "쏭 할 일"}])
    repo.replace_events([{"id": "event-1", "title": "병원", "date": "2026-07-11", "color": "blue"}])
    repo.put_timetable_state(
        {
            "plans": [
                {
                    "id": "plan-1",
                    "name": "학교",
                    "items": [{"id": "entry-1", "title": "언어", "dayOfWeek": 1, "startTime": "10:20", "endTime": "11:00"}],
                }
            ],
            "assignments": [{"id": "assignment-1", "planId": "plan-1", "startDate": "2026-07-01"}],
        }
    )
    repo.put_caregiver_days({"2026-07-11": 2.5})
    repo.put_setting("caregiver-hourly-wage", 15000)
    repo.upsert_main_link(family_item_id="task-1", main_item_id="main-1", family_module="tasks")

    assert repo.list_notes()[0]["id"] == "note-1"
    assert repo.list_tasks()[0]["id"] == "task-1"
    assert repo.list_events()[0]["color"] == "blue"
    assert repo.get_timetable_state()["plans"][0]["items"][0]["title"] == "언어"
    assert repo.get_caregiver_days()["2026-07-11"] == 2.5
    assert repo.get_setting("caregiver-hourly-wage") == 15000
    assert repo.list_main_links()[0]["familyItemId"] == "task-1"

    with engine.begin() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM family_records")).scalar_one() == 0


def test_family_records_bridge_writes_known_entities_to_dedicated_tables(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'family-bridge.db'}")
    init_schema_v0(engine)
    repo = FamilyRepo(engine)

    payload = [{"id": "task-1", "title": "약 사기", "assignee": "쏭 할 일"}]
    repo.put_record("family", "tasks", payload)

    assert repo.get_record("family", "tasks") == payload
    assert repo.list_tasks() == payload
    with engine.begin() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM family_records")).scalar_one() == 0
