from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "supplies-v0-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.core.db as db_module
    import app.main as main_module

    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def test_capture_supply_creates_item(main_module) -> None:
    payload = main_module.capture_item({"raw": "$$ gauze"})
    assert payload["ok"] is True
    assert payload["kind"] == "supply"

    active = main_module.list_supplies(mode="active")
    assert len(active["items"]) == 1
    assert active["items"][0]["title"] == "gauze"


def test_capture_supply_empty_fails(main_module) -> None:
    payload = main_module.capture_item({"raw": "$$"})
    assert payload["ok"] is False
    assert payload["error"] == "title is required"


def test_supply_create_updates_preset_history(main_module) -> None:
    created = main_module.create_supply({"title": "alcohol swab"})
    assert created["ok"] is True

    presets = main_module.list_supply_presets()
    assert [item["name"] for item in presets["items"]] == ["alcohol swab"]


def test_preset_history_unique_and_capped_to_fifteen(main_module) -> None:
    for idx in range(20):
        result = main_module.create_supply({"title": f"item {idx}"})
        assert result["ok"] is True

    reused = main_module.create_supply({"title": "item 12"})
    assert reused["ok"] is True

    presets = main_module.list_supply_presets()["items"]
    assert len(presets) == 15
    assert presets[0]["name"] == "item 12"
    assert len({item["normalized_name"] for item in presets}) == 15


def test_duplicate_active_supply_not_duplicated(main_module) -> None:
    one = main_module.create_supply({"title": "tongue depressor"})
    two = main_module.create_supply({"title": "Tongue   Depressor"})

    assert one["ok"] is True
    assert two["ok"] is True
    assert two["created"] is False

    active = main_module.list_supplies(mode="active")
    assert len(active["items"]) == 1


def test_mark_done_moves_supply_from_active_to_done(main_module) -> None:
    created = main_module.create_supply({"title": "gloves"})
    assert created["ok"] is True

    marked = main_module.mark_supply_done(created["id"])
    assert marked["ok"] is True

    active = main_module.list_supplies(mode="active")
    done = main_module.list_supplies(mode="done")
    assert active["items"] == []
    assert len(done["items"]) == 1
    assert done["items"][0]["title"] == "gloves"


def test_done_items_group_by_date_shape(main_module) -> None:
    first = main_module.create_supply({"title": "gauze"})
    second = main_module.create_supply({"title": "bandage"})
    assert first["ok"] and second["ok"]

    assert main_module.mark_supply_done(first["id"])["ok"] is True
    assert main_module.mark_supply_done(second["id"])["ok"] is True

    done_items = main_module.list_supplies(mode="done")["items"]
    groups = {}
    for row in done_items:
        key = str(row["done_at"])[:10]
        groups[key] = groups.get(key, 0) + 1

    assert len(groups) == 1
    assert list(groups.values())[0] == 2


def test_hard_delete_done_supply_removes_permanently(main_module) -> None:
    created = main_module.create_supply({"title": "alcohol"})
    assert created["ok"] is True
    assert main_module.mark_supply_done(created["id"])["ok"] is True

    deleted = main_module.delete_supply(created["id"])
    assert deleted["ok"] is True

    done = main_module.list_supplies(mode="done")
    assert done["items"] == []


def test_preset_use_adds_supply_and_refreshes_recency(main_module) -> None:
    assert main_module.create_supply({"title": "mask"})["ok"] is True
    assert main_module.create_supply({"title": "swab"})["ok"] is True

    used = main_module.use_supply_preset({"name": "mask"})
    assert used["ok"] is True

    active_titles = [item["title"] for item in main_module.list_supplies(mode="active")["items"]]
    assert active_titles == ["mask", "swab"]

    presets = main_module.list_supply_presets()["items"]
    assert presets[0]["name"] == "mask"


def test_duplicate_create_integrity_conflict_returns_existing_active(main_module) -> None:
    first = main_module.create_supply({"title": "gauze"})
    assert first["ok"] is True

    original_lookup = main_module.supply_service.supply_repo.get_active_by_normalized_title
    call_count = {"value": 0}

    def flaky_lookup(normalized_title: str):
        call_count["value"] += 1
        if call_count["value"] == 1:
            return None
        return original_lookup(normalized_title)

    def raise_integrity(*, item_id: str, normalized_title: str) -> None:
        raise IntegrityError("simulated unique conflict", params={}, orig=None)

    original_create = main_module.supply_service.supply_repo.create_supply
    main_module.supply_service.supply_repo.get_active_by_normalized_title = flaky_lookup
    main_module.supply_service.supply_repo.create_supply = raise_integrity
    try:
        duplicate = main_module.create_supply({"title": "GAUZE"})
    finally:
        main_module.supply_service.supply_repo.get_active_by_normalized_title = original_lookup
        main_module.supply_service.supply_repo.create_supply = original_create

    assert duplicate["ok"] is True
    assert duplicate["created"] is False
    assert duplicate["id"] == first["id"]

    active = main_module.list_supplies(mode="active")["items"]
    assert len(active) == 1


def test_done_grouping_uses_local_app_timezone_date_key(main_module) -> None:
    created = main_module.create_supply({"title": "midnight edge"})
    assert created["ok"] is True
    assert main_module.mark_supply_done(created["id"])["ok"] is True

    with main_module.engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE supply_items
                SET done_at = :done_at
                WHERE item_id = :item_id
                """
            ),
            {
                "item_id": created["id"],
                "done_at": "2026-04-22T23:30:00+00:00",
            },
        )

    done = main_module.list_supplies(mode="done")["items"]
    target = next(item for item in done if item["id"] == created["id"])
    assert str(target["done_at"]).startswith("2026-04-22")
    assert target["done_date_key"] == "2026-04-23"
