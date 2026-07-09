from sqlalchemy import create_engine, text

from app.db.repo.family_repo import FamilyRepo
from app.db.schema_v0 import init_schema_v0


def test_family_records_schema_and_repo_round_trip(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'family.db'}")
    init_schema_v0(engine)
    repo = FamilyRepo(engine)

    with engine.begin() as conn:
        table_count = conn.execute(
            text("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='family_records'")
        ).scalar_one()
    assert table_count == 1

    assert repo.get_record("family", "tasks") is None

    payload = [{"id": "task-1", "title": "약 사기", "assignee": "쏭 할 일"}]
    repo.put_record("family", "tasks", payload)
    assert repo.get_record("family", "tasks") == payload

    next_payload = [{"id": "task-2", "title": "학교 전화"}]
    repo.put_record("family", "tasks", next_payload)
    assert repo.get_record("family", "tasks") == next_payload
