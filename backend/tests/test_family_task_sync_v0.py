from sqlalchemy import create_engine

from app.db.repo.items_repo import ItemsRepo
from app.db.repo.reminder_repo import ReminderRepo
from app.db.repo.task_repo import TaskRepo
from app.db.schema_v0 import init_schema_v0
from app.engine.family_task_sync_service import (
    FAMILY_TASK_MIRROR_TAG_PREFIX,
    FAMILY_TASK_SHARED_ASSIGNEE,
    FamilyTaskSyncService,
    build_family_task_canonical_raw,
    extract_family_task_checklist,
)
from app.engine.task_service import TaskService


def make_sync_service(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'family-task-sync.db'}")
    init_schema_v0(engine)
    items_repo = ItemsRepo(engine)
    task_repo = TaskRepo(engine)
    reminder_repo = ReminderRepo(engine)
    task_service = TaskService(items_repo, task_repo, reminder_repo)
    return FamilyTaskSyncService(items_repo, task_repo, task_service), items_repo, task_repo, task_service


def mirrored_task_id(items_repo: ItemsRepo, family_task_id: str) -> str:
    rows = items_repo.list_items_by_tag_prefix(f"{FAMILY_TASK_MIRROR_TAG_PREFIX}{family_task_id}")
    assert len(rows) == 1
    return rows[0]["id"]


def active_mirror_count(items_repo: ItemsRepo, family_task_id: str) -> int:
    return sum(
        1
        for row in items_repo.list_items_by_tag_prefix(f"{FAMILY_TASK_MIRROR_TAG_PREFIX}{family_task_id}")
        if row["status"] == "active"
    )


def test_family_task_checklist_extraction_contract() -> None:
    extracted = extract_family_task_checklist(
        "장보기\n\n"
        "djdjekdkdkdkdkdkdkdkdkd\n"
        "blablabla\n"
        "- 우유\n"
        "blah blah blah\n"
        "+ 계란\n"
        "- 빵"
    )

    assert extracted["memo"] == "장보기\n\ndjdjekdkdkdkdkdkdkdkdkd\nblablabla\n\nblah blah blah"
    assert extracted["subtasks"] == [
        {"content": "우유", "is_done": False, "position": 0},
        {"content": "계란", "is_done": True, "position": 1},
        {"content": "빵", "is_done": False, "position": 2},
    ]

    assert extract_family_task_checklist("- \n+ \nnot - checklist") == {
        "memo": "not - checklist",
        "subtasks": [],
    }


def test_family_task_canonical_raw_uses_main_task_subtask_grammar() -> None:
    raw = build_family_task_canonical_raw(
        {
            "id": "family-1",
            "title": "장보기",
            "description": "메모 앞\n- 우유\n+ 계란\n메모 뒤",
        }
    )

    assert raw == '-- 장보기\n--- 우유\n--x 계란\n"""\n메모 앞\n\n메모 뒤\n"""'


def test_shared_family_task_creates_main_task_with_real_subtasks(tmp_path) -> None:
    sync_service, items_repo, task_repo, _ = make_sync_service(tmp_path)

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "메모\n- 우유\n+ 계란",
                "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
                "due_date": "2026-07-10",
                "priority": "⭐️ 중요",
            }
        ]
    )

    mirror_id = mirrored_task_id(items_repo, "family-1")
    detail = task_repo.get_task_detail(mirror_id)
    assert detail["title"] == "장보기"
    assert detail["memo"] == "메모"
    assert detail["due_at"] == "2026-07-10T00:00:00+09:00"
    assert items_repo.list_item_tags(mirror_id) == [
        "family-priority:important",
        "family-song",
        "family-task:family-1",
    ]
    assert [
        {"content": row["content"], "is_done": bool(row["is_done"]), "position": row["position"]}
        for row in task_repo.list_subtasks(mirror_id)
    ] == [
        {"content": "우유", "is_done": False, "position": 0},
        {"content": "계란", "is_done": True, "position": 1},
    ]


def test_family_mirror_internal_tags_are_hidden_from_main_task_output(tmp_path) -> None:
    sync_service, items_repo, _, task_service = make_sync_service(tmp_path)

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "- 우유",
                "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
                "priority": "⭐️ 중요",
            }
        ]
    )

    mirror_id = mirrored_task_id(items_repo, "family-1")
    assert items_repo.list_item_tags(mirror_id) == [
        "family-priority:important",
        "family-song",
        "family-task:family-1",
    ]
    assert task_service.get_task(mirror_id)["tags"] == ["family-song"]


def test_family_task_repeated_sync_does_not_duplicate_mirror_or_subtasks(tmp_path) -> None:
    sync_service, items_repo, task_repo, _ = make_sync_service(tmp_path)
    payload = [
        {
            "id": "family-1",
            "title": "장보기",
            "description": "- 우유\n+ 계란",
            "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
        }
    ]

    sync_service.sync(payload)
    sync_service.sync(payload)

    mirror_id = mirrored_task_id(items_repo, "family-1")
    assert active_mirror_count(items_repo, "family-1") == 1
    assert len(task_repo.list_subtasks(mirror_id)) == 2


def test_family_task_edit_add_delete_reorder_propagates_to_main_subtasks(tmp_path) -> None:
    sync_service, items_repo, task_repo, _ = make_sync_service(tmp_path)

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "- 우유\n+ 계란\n- 빵",
                "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
            }
        ]
    )
    mirror_id = mirrored_task_id(items_repo, "family-1")

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "+ 빵\n- 사과",
                "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
            }
        ]
    )

    assert [
        {"content": row["content"], "is_done": bool(row["is_done"]), "position": row["position"]}
        for row in task_repo.list_subtasks(mirror_id)
    ] == [
        {"content": "빵", "is_done": True, "position": 0},
        {"content": "사과", "is_done": False, "position": 1},
    ]


def test_unshared_family_task_removes_mirror_without_affecting_unrelated_tasks(tmp_path) -> None:
    sync_service, items_repo, task_repo, task_service = make_sync_service(tmp_path)
    unrelated_id = task_service.create_task("main only")

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "- 우유",
                "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
            }
        ]
    )
    mirror_id = mirrored_task_id(items_repo, "family-1")

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "- 우유",
                "assignee": "내 할 일",
            }
        ]
    )

    assert task_repo.get_task_detail(mirror_id)["status"] == "removed"
    assert task_repo.get_task_detail(unrelated_id)["status"] == "active"


def test_missing_family_task_removes_stale_mirror_without_affecting_unrelated_tasks(tmp_path) -> None:
    sync_service, items_repo, task_repo, task_service = make_sync_service(tmp_path)
    unrelated_id = task_service.create_task("main only")

    sync_service.sync(
        [
            {
                "id": "family-1",
                "title": "장보기",
                "description": "- 우유",
                "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
            }
        ]
    )
    mirror_id = mirrored_task_id(items_repo, "family-1")

    sync_service.sync([])

    assert task_repo.get_task_detail(mirror_id)["status"] == "removed"
    assert task_repo.get_task_detail(unrelated_id)["status"] == "active"


def test_main_mirror_done_state_reconciles_back_to_family_task(tmp_path) -> None:
    sync_service, items_repo, _, task_service = make_sync_service(tmp_path)
    family_tasks = [
        {
            "id": "family-1",
            "title": "장보기",
            "description": "- 우유",
            "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
            "done": False,
        }
    ]
    sync_service.sync(family_tasks)
    mirror_id = mirrored_task_id(items_repo, "family-1")

    assert task_service.toggle_task(mirror_id) is True

    reconciled, changed = sync_service.reconcile_from_mirrors(family_tasks)
    assert changed is True
    assert reconciled[0]["done"] is True
    assert reconciled[0]["completed_at"]


def test_main_mirror_subtask_done_state_reconciles_back_to_family_markers(tmp_path) -> None:
    sync_service, items_repo, task_repo, task_service = make_sync_service(tmp_path)
    family_tasks = [
        {
            "id": "family-1",
            "title": "장보기",
            "description": "메모 앞\n- 우유\n+ 계란\n- 빵\n메모 뒤",
            "assignee": FAMILY_TASK_SHARED_ASSIGNEE,
            "done": False,
        }
    ]
    sync_service.sync(family_tasks)
    mirror_id = mirrored_task_id(items_repo, "family-1")
    subtasks = task_repo.list_subtasks(mirror_id)

    assert task_service.toggle_subtask(mirror_id, subtasks[0]["id"]) is True
    assert task_service.toggle_subtask(mirror_id, subtasks[1]["id"]) is False

    reconciled, changed = sync_service.reconcile_from_mirrors(family_tasks)
    assert changed is True
    assert reconciled[0]["description"] == "메모 앞\n+ 우유\n- 계란\n- 빵\n메모 뒤"
