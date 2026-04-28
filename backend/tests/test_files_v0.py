from __future__ import annotations

import importlib
import os
from pathlib import Path
from urllib.parse import quote

import pytest


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "files-v0.db"
    upload_dir = tmp_path / "uploads"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["FILE_STORAGE_DIR"] = str(upload_dir)

    import app.core.db as db_module
    import app.config as config_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


def _upload(main_module, name: str, content: bytes, mime: str = "application/pdf") -> str:
    return main_module.file_service.create_file(
        original_filename=name,
        mime_type=mime,
        content=content,
    )


def test_upload_creates_file_item_and_persists_metadata(main_module) -> None:
    file_id = _upload(main_module, "insurer_form.pdf", b"%PDF-1.7 demo", "application/pdf")

    detail = main_module.get_file(file_id)
    assert detail["ok"] is True
    item = detail["item"]

    assert item["id"] == file_id
    assert item["item_type"] == "file"
    assert item["original_filename"] == "insurer_form.pdf"
    assert item["mime_type"] == "application/pdf"
    assert item["size_bytes"] == len(b"%PDF-1.7 demo")
    assert Path(item["stored_path"]).is_file()


def test_files_list_newest_first(main_module) -> None:
    first = _upload(main_module, "old.pdf", b"old", "application/pdf")
    second = _upload(main_module, "new.pdf", b"new", "application/pdf")

    listing = main_module.list_files()
    assert listing["items"][0]["id"] == second
    assert listing["items"][1]["id"] == first


def test_file_open_returns_stored_content(main_module) -> None:
    data = b"hello image bytes"
    file_id = _upload(main_module, "photo.png", data, "image/png")

    detail = main_module.get_file(file_id)["item"]
    file_response = main_module.open_file(file_id)
    assert file_response.path == detail["stored_path"]
    assert file_response.media_type == "image/png"
    with open(file_response.path, "rb") as handle:
        assert handle.read() == data


def test_unsafe_filename_is_not_used_as_storage_path(main_module) -> None:
    file_id = _upload(main_module, "../../etc/passwd", b"nope", "application/octet-stream")

    detail = main_module.get_file(file_id)["item"]
    stored_path = Path(detail["stored_path"])
    assert stored_path.is_absolute()
    assert stored_path.name != "../../etc/passwd"
    assert "etc/passwd" not in stored_path.as_posix()
    assert ".." not in detail["stored_path"]


def test_file_items_support_linking_and_detail_resolves_links(main_module) -> None:
    file_id = _upload(main_module, "linked.pdf", b"data", "application/pdf")

    target = main_module.capture_item({"raw": "-- linked task"})
    assert target["ok"] is True

    updated = main_module.update_file_raw(file_id, {"raw": f"++ linked.pdf\nl:{target['id']}"})
    assert updated["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert len(detail["links"]) == 1
    assert detail["links"][0]["id"] == target["id"]
    assert detail["links"][0]["marker"] == "T"


def test_task_can_link_to_file_item(main_module) -> None:
    file_id = _upload(main_module, "target.pdf", b"target", "application/pdf")

    source = main_module.capture_item({"raw": "-- task source"})
    assert source["ok"] is True

    patched = main_module.update_task_raw(source["id"], {"raw": f"-- task source\nl:{file_id}"})
    assert patched["ok"] is True

    detail = main_module.get_task(source["id"])
    assert detail["ok"] is True
    assert detail["item"]["links"][0]["id"] == file_id
    assert detail["item"]["links"][0]["marker"] == "F"


def test_file_raw_update_can_change_title(main_module) -> None:
    file_id = _upload(main_module, "before.pdf", b"content")

    updated = main_module.update_file_raw(file_id, {"raw": "++ After Title"})
    assert updated["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert detail["title"] == "After Title"


def test_file_raw_update_can_save_memo(main_module) -> None:
    file_id = _upload(main_module, "memo.pdf", b"content")

    updated = main_module.update_file_raw(
        file_id,
        {"raw": "++ Memo Title\n\n\"\"\"\nline1\nline2\n\"\"\""},
    )
    assert updated["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert detail["memo"] == "line1\nline2"


def test_file_raw_update_can_save_tags(main_module) -> None:
    file_id = _upload(main_module, "tags.pdf", b"content")

    updated = main_module.update_file_raw(file_id, {"raw": "++ Tagged File\n#alpha #beta #alpha"})
    assert updated["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert detail["tags"] == ["alpha", "beta"]


def test_file_raw_update_can_save_fax_number(main_module) -> None:
    file_id = _upload(main_module, "fax.pdf", b"content")

    updated = main_module.update_file_raw(file_id, {"raw": "++ Faxed File\nx:02-1234-5678"})
    assert updated["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert detail["fax_number"] == "02-1234-5678"

    exported = main_module.get_file_raw(file_id)
    assert exported["ok"] is True
    assert exported["raw"].startswith("++ Faxed File")
    assert "x:02-1234-5678" in exported["raw"]

def test_file_raw_update_preserves_links(main_module) -> None:
    file_id = _upload(main_module, "link-preserve.pdf", b"content")
    target = main_module.capture_item({"raw": "-- linked target"})
    assert target["ok"] is True

    first_update = main_module.update_file_raw(file_id, {"raw": f"++ Initial\nl:{target['id']}"})
    assert first_update["ok"] is True

    second_update = main_module.update_file_raw(file_id, {"raw": f"++ Renamed\n#meta\nl:{target['id']}"})
    assert second_update["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert [link["id"] for link in detail["links"]] == [target["id"]]


def test_file_remove_changes_status_to_removed(main_module) -> None:
    file_id = _upload(main_module, "remove-me.pdf", b"content")

    removed = main_module.remove_file(file_id)
    assert removed["ok"] is True

    detail = main_module.get_file(file_id)["item"]
    assert detail["status"] == "removed"


def test_removed_file_is_excluded_from_active_file_list(main_module) -> None:
    keep_id = _upload(main_module, "keep.pdf", b"keep")
    remove_id = _upload(main_module, "remove.pdf", b"remove")

    removed = main_module.remove_file(remove_id)
    assert removed["ok"] is True

    active_ids = [item["id"] for item in main_module.list_files()["items"]]
    removed_ids = [item["id"] for item in main_module.list_files(mode="removed")["items"]]

    assert keep_id in active_ids
    assert remove_id not in active_ids
    assert remove_id in removed_ids


def test_removed_file_binary_is_not_hard_deleted(main_module) -> None:
    file_id = _upload(main_module, "binary-stays.pdf", b"persist")
    path = Path(main_module.get_file(file_id)["item"]["stored_path"])
    assert path.exists()

    removed = main_module.remove_file(file_id)
    assert removed["ok"] is True

    assert path.exists()


def test_file_raw_requires_plus_plus_title_prefix(main_module) -> None:
    file_id = _upload(main_module, "title-format.pdf", b"content")

    updated = main_module.update_file_raw(file_id, {"raw": "Plain title\n#a"})
    assert updated["ok"] is False
    assert "++" in str(updated["error"])


def test_hard_remove_file_deletes_db_item_and_binary(main_module) -> None:
    file_id = _upload(main_module, "cleanup.pdf", b"payload")
    path = Path(main_module.get_file(file_id)["item"]["stored_path"])
    assert path.exists()

    removed = main_module.remove_file_hard(file_id)
    assert removed["ok"] is True
    assert not path.exists()

    detail = main_module.get_file(file_id)
    assert detail["ok"] is False


def test_file_upload_accepts_urlencoded_filename_header(main_module) -> None:
    korean_name = "(붙임)HPV 국가예방접종 12세 남아 확대 시행 안내.pdf"
    encoded = quote(korean_name, safe="")

    resolved = main_module.resolve_upload_filename(
        {
            "x-file-name-url": encoded,
            "x-file-name": "legacy-name.pdf",
        }
    )

    assert resolved == korean_name
