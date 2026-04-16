from __future__ import annotations

import importlib
import os
from pathlib import Path

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

    updated = main_module.update_file_raw(file_id, {"raw": f"linked.pdf\nl:{target['id']}"})
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
