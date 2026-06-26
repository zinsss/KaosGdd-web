from __future__ import annotations

import importlib
import os
import subprocess
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import text

from app.config import DbTables
from app.engine.fax_pdf_conversion_service import FaxPdfConversionService
from app.engine.fax_service import FaxService


@pytest.fixture()
def main_module(tmp_path: Path):
    db_path = tmp_path / "fax-v0.db"
    upload_dir = tmp_path / "uploads"
    fax_dir = tmp_path / "fax"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["FILE_STORAGE_DIR"] = str(upload_dir)
    os.environ["FAX_STORAGE_DIR"] = str(fax_dir)
    os.environ["FAX_SEND_ENABLED"] = "false"

    import app.core.db as db_module
    import app.config as config_module
    import app.engine.file_service as file_service_module
    import app.engine.fax_service as fax_service_module
    import app.engine.fax_pdf_conversion_service as fax_conversion_module
    import app.main as main_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(file_service_module)
    importlib.reload(fax_conversion_module)
    importlib.reload(fax_service_module)
    importlib.reload(main_module)
    main_module.init_schema_v0(main_module.engine)
    return main_module


class FakeConverter:
    def __init__(self, output_pdf: Path | None = None, error: str | None = None) -> None:
        self.output_pdf = output_pdf
        self.error = error
        self.calls = []

    def convert_to_pdf(self, **kwargs) -> str:
        self.calls.append(kwargs)
        if self.error:
            from app.engine.fax_pdf_conversion_service import FaxConversionError

            raise FaxConversionError(self.error)
        assert self.output_pdf is not None
        self.output_pdf.write_bytes(b"%PDF-1.7\nfake fax pdf\n")
        return str(self.output_pdf)


class FakeReminderService:
    def __init__(self) -> None:
        self.received = []
        self.failed = []

    def notify_fax_received(self, **kwargs) -> bool:
        self.received.append(kwargs)
        return True

    def notify_fax_send_failed(self, **kwargs) -> bool:
        self.failed.append(kwargs)
        return True


def _upload(main_module, name: str, content: bytes, mime: str) -> str:
    return main_module.file_service.create_file(original_filename=name, mime_type=mime, content=content)


def _service_with_converter(main_module, converter, reminder_service=None) -> FaxService:
    return FaxService(
        items_repo=main_module.items_repo,
        fax_repo=main_module.fax_repo,
        file_repo=main_module.file_repo,
        conversion_service=converter,
        reminder_service=reminder_service,
        send_enabled=False,
    )


def _minimal_jpeg() -> bytes:
    return (
        b"\xff\xd8"
        b"\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x03\x01\x11\x00\x02\x11\x00\x03\x11\x00"
        b"\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\x00"
        b"\xff\xd9"
    )


def _png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    import binascii

    checksum = binascii.crc32(chunk_type + payload) & 0xFFFFFFFF
    return len(payload).to_bytes(4, "big") + chunk_type + payload + checksum.to_bytes(4, "big")


def _minimal_png() -> bytes:
    ihdr = (1).to_bytes(4, "big") + (1).to_bytes(4, "big") + bytes([8, 2, 0, 0, 0])
    raw_scanline = b"\x00\xff\x00\x00"
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(raw_scanline))
        + _png_chunk(b"IEND", b"")
    )


def test_pdf_input_remains_pdf_and_is_accepted(main_module, tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    source.write_bytes(b"%PDF-1.7\nsource\n")
    converter = FaxPdfConversionService(storage_dir=str(tmp_path / "converted"))

    pdf_path = converter.convert_to_pdf(
        input_path=str(source),
        original_filename="source.pdf",
        mime_type="application/pdf",
    )

    assert Path(pdf_path).read_bytes().startswith(b"%PDF-")


def test_jpg_and_png_images_convert_to_pdf(main_module, tmp_path: Path) -> None:
    converter = FaxPdfConversionService(storage_dir=str(tmp_path / "converted"))
    jpg = tmp_path / "scan.jpg"
    png = tmp_path / "scan.png"
    jpg.write_bytes(_minimal_jpeg())
    png.write_bytes(_minimal_png())

    jpg_pdf = converter.convert_to_pdf(input_path=str(jpg), original_filename="scan.jpg", mime_type="image/jpeg")
    png_pdf = converter.convert_to_pdf(input_path=str(png), original_filename="scan.png", mime_type="image/png")

    assert Path(jpg_pdf).read_bytes().startswith(b"%PDF-")
    assert Path(png_pdf).read_bytes().startswith(b"%PDF-")


def test_image_input_converts_to_pdf_before_send(main_module, tmp_path: Path) -> None:
    file_id = _upload(main_module, "scan.png", _minimal_png(), "image/png")
    converter = FaxPdfConversionService(storage_dir=str(tmp_path / "fax"))
    fax_service = _service_with_converter(main_module, converter)

    ok, status, fax_id = fax_service.send_file_as_fax(file_id=file_id, fax_number="02-1234-5678")

    assert ok is True
    assert status == "queued"
    fax = fax_service.get_fax(fax_id)
    assert fax["pdf_available"] is True
    assert Path(fax["pdf_file_path"]).read_bytes().startswith(b"%PDF-")


def test_docx_odt_txt_conversion_uses_libreoffice_or_fails_clearly(main_module, tmp_path: Path, monkeypatch) -> None:
    converter = FaxPdfConversionService(storage_dir=str(tmp_path / "converted"))

    if os.system("command -v libreoffice >/dev/null 2>&1 || command -v soffice >/dev/null 2>&1") != 0:
        source = tmp_path / "letter.docx"
        source.write_bytes(b"not a pdf")
        with pytest.raises(Exception, match="Document to PDF conversion requires LibreOffice."):
            converter.convert_to_pdf(
                input_path=str(source),
                original_filename="letter.docx",
                mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )

    calls = []

    def fake_which(name: str):
        return "/usr/bin/libreoffice" if name == "libreoffice" else None

    def fake_run(args, **_kwargs):
        calls.append(args)
        out_dir = Path(args[args.index("--outdir") + 1])
        source = Path(args[-1])
        (out_dir / f"{source.stem}.pdf").write_bytes(b"%PDF-1.7\nconverted\n")
        return subprocess.CompletedProcess(args=args, returncode=0, stdout="", stderr="")

    import app.engine.fax_pdf_conversion_service as conversion_module

    monkeypatch.setattr(conversion_module.shutil, "which", fake_which)
    converter = FaxPdfConversionService(storage_dir=str(tmp_path / "lo-converted"), run_command=fake_run)
    for name, mime in [
        ("letter.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("letter.odt", "application/vnd.oasis.opendocument.text"),
        ("letter.txt", "text/plain"),
    ]:
        source = tmp_path / name
        source.write_bytes(b"document")
        pdf_path = converter.convert_to_pdf(input_path=str(source), original_filename=name, mime_type=mime)
        assert Path(pdf_path).read_bytes().startswith(b"%PDF-")
    assert calls


def test_outgoing_fax_does_not_queue_if_pdf_conversion_fails(main_module, tmp_path: Path) -> None:
    file_id = _upload(main_module, "bad.docx", b"bad", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    fax_service = _service_with_converter(main_module, FakeConverter(error="conversion failed"))

    ok, status, fax_id = fax_service.send_file_as_fax(file_id=file_id, fax_number="02-1234-5678")

    assert ok is False
    assert status == "conversion failed"
    fax = fax_service.get_fax(fax_id)
    assert fax["fax_status"] == "conversion_failed"
    assert fax["pdf_file_path"] is None


def test_unsupported_format_never_queues_fax_raw(main_module, tmp_path: Path) -> None:
    file_id = _upload(main_module, "payload.bin", b"raw", "application/octet-stream")
    fax_service = _service_with_converter(
        main_module,
        FaxPdfConversionService(storage_dir=str(tmp_path / "fax")),
    )

    ok, _status, fax_id = fax_service.send_file_as_fax(file_id=file_id, fax_number="02-1234-5678")

    assert ok is False
    fax = fax_service.get_fax(fax_id)
    assert fax["fax_status"] == "conversion_failed"
    assert fax["pdf_file_path"] is None


def test_incoming_raw_fax_converts_to_pdf_before_alert(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv.tif"
    raw.write_bytes(b"raw-tiff")
    pdf = tmp_path / "recv.pdf"
    reminder = FakeReminderService()
    fax_service = _service_with_converter(main_module, FakeConverter(pdf), reminder)

    ok, status, fax_id = fax_service.receive_incoming_raw(
        source_file_path=str(raw),
        remote_number="031",
        local_device="ttyACM0",
    )

    assert ok is True
    assert status == "received"
    assert pdf.exists()
    assert reminder.received == [
        {
            "fax_id": fax_id,
            "title": "Received fax",
            "remote_number": "031",
            "local_device": "ttyACM0",
        }
    ]
    fax = fax_service.get_fax(fax_id)
    assert fax["pdf_file_path"] == str(pdf)
    assert fax["pdf_available"] is True


def test_received_fax_appears_in_inbox(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv-visible.tif"
    raw.write_bytes(b"raw-tiff")
    pdf = tmp_path / "recv-visible.pdf"
    fax_service = _service_with_converter(main_module, FakeConverter(pdf))

    ok, _status, fax_id = fax_service.receive_incoming_raw(source_file_path=str(raw), remote_number="031")

    assert ok is True
    inbox_ids = [item["id"] for item in fax_service.list_faxes()]
    assert fax_id in inbox_ids


def test_save_to_files_creates_file_links_fax_and_removes_temp_files(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv-save.tif"
    raw.write_bytes(b"raw-tiff")
    pdf = tmp_path / "recv-save.pdf"
    fax_service = _service_with_converter(main_module, FakeConverter(pdf))
    ok, _status, fax_id = fax_service.receive_incoming_raw(
        source_file_path=str(raw),
        original_filename="clinic-fax.tif",
    )
    assert ok is True
    assert raw.exists()
    assert pdf.exists()

    saved, error, file_id = fax_service.save_incoming_to_files(fax_id)

    assert saved is True
    assert error is None
    assert file_id
    fax = fax_service.get_fax(fax_id)
    assert fax["saved_file_id"] == file_id
    assert fax["saved_to_files"] is True
    assert fax["pdf_file_path"] is None
    assert fax["source_file_path"] is None
    assert not raw.exists()
    assert not pdf.exists()
    assert main_module.items_repo.list_item_links(fax_id) == [file_id]

    file_item = main_module.get_file(file_id)["item"]
    assert file_item["original_filename"] == "clinic-fax.pdf"
    assert file_item["mime_type"] == "application/pdf"
    assert Path(file_item["stored_path"]).read_bytes().startswith(b"%PDF-")


def test_delete_received_fax_removes_inbox_item_and_temp_files(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv-delete.tif"
    raw.write_bytes(b"raw-tiff")
    pdf = tmp_path / "recv-delete.pdf"
    fax_service = _service_with_converter(main_module, FakeConverter(pdf))
    ok, _status, fax_id = fax_service.receive_incoming_raw(source_file_path=str(raw))
    assert ok is True

    deleted = fax_service.delete_inbox_fax(fax_id)

    assert deleted is True
    assert fax_service.get_fax(fax_id) is None
    assert not raw.exists()
    assert not pdf.exists()


def _set_fax_received_at(main_module, fax_id: str, received_at: datetime) -> None:
    iso = received_at.isoformat(timespec="seconds")
    with main_module.engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE {items}
                SET created_at = :created_at,
                    updated_at = :created_at
                WHERE id = :id
                """.format(items=DbTables.ITEMS)
            ),
            {"id": fax_id, "created_at": iso},
        )
        conn.execute(
            text(
                """
                UPDATE {fax_items}
                SET received_at = :received_at
                WHERE item_id = :id
                """.format(fax_items=DbTables.FAX_ITEMS)
            ),
            {"id": fax_id, "received_at": iso},
        )


def test_unsaved_fax_survives_before_90_days(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv-young.tif"
    raw.write_bytes(b"raw-tiff")
    pdf = tmp_path / "recv-young.pdf"
    fax_service = _service_with_converter(main_module, FakeConverter(pdf))
    ok, _status, fax_id = fax_service.receive_incoming_raw(source_file_path=str(raw))
    assert ok is True
    now = datetime(2026, 6, 7, tzinfo=timezone.utc)
    _set_fax_received_at(main_module, fax_id, now - timedelta(days=89, hours=23))

    cleanup = fax_service.cleanup_stale_inbox_items(now=now)

    assert cleanup["fax_inbox_deleted"] == 0
    assert fax_service.get_fax(fax_id) is not None
    assert raw.exists()
    assert pdf.exists()


def test_unsaved_fax_is_removed_after_90_days_and_temp_is_cleaned(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv-stale.tif"
    raw.write_bytes(b"raw-tiff")
    pdf = tmp_path / "recv-stale.pdf"
    fax_service = _service_with_converter(main_module, FakeConverter(pdf))
    ok, _status, fax_id = fax_service.receive_incoming_raw(source_file_path=str(raw))
    assert ok is True
    now = datetime(2026, 6, 7, tzinfo=timezone.utc)
    _set_fax_received_at(main_module, fax_id, now - timedelta(days=91))

    cleanup = fax_service.cleanup_stale_inbox_items(now=now)

    assert cleanup["fax_inbox_deleted"] == 1
    assert cleanup["fax_temp_files_deleted"] == 2
    assert fax_service.get_fax(fax_id) is None
    assert not raw.exists()
    assert not pdf.exists()


def test_incoming_conversion_failure_creates_conversion_failed_record(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "broken.tif"
    raw.write_bytes(b"broken")
    reminder = FakeReminderService()
    fax_service = _service_with_converter(main_module, FakeConverter(error="bad tiff"), reminder)

    ok, status, fax_id = fax_service.receive_incoming_raw(source_file_path=str(raw))

    assert ok is False
    assert status == "bad tiff"
    assert reminder.received == []
    fax = fax_service.get_fax(fax_id)
    assert fax["fax_status"] == "conversion_failed"
    assert fax["error_message"] == "bad tiff"


def test_generated_fax_item_references_pdf_as_canonical_artifact(main_module, tmp_path: Path) -> None:
    file_id = _upload(main_module, "source.pdf", b"%PDF-1.7\n", "application/pdf")
    pdf = tmp_path / "canonical.pdf"
    fax_service = _service_with_converter(main_module, FakeConverter(pdf))

    ok, _status, fax_id = fax_service.send_file_as_fax(file_id=file_id, fax_number="02")

    assert ok is True
    fax = fax_service.get_fax(fax_id)
    assert fax["item_type"] == "fax"
    assert fax["pdf_file_path"] == str(pdf)
    assert fax["source_file_path"] is not None


def test_fax_number_requires_selected_file(main_module) -> None:
    result = main_module.send_fax_from_file({"fax_number": "02-1234-5678"})

    assert result["ok"] is False
    assert result["error"] == "file_id is required"

    capture = main_module.capture_item({"raw": "fax:02-1234-5678"})
    assert capture["ok"] is False
    assert capture["error"] == "file is required for fax"


def test_hwp_returns_exact_unavailable_error(main_module, tmp_path: Path) -> None:
    source = tmp_path / "document.hwp"
    source.write_bytes(b"hwp")
    converter = FaxPdfConversionService(storage_dir=str(tmp_path / "converted"))

    with pytest.raises(Exception) as exc:
        converter.convert_to_pdf(input_path=str(source), original_filename="document.hwp", mime_type="application/x-hwp")

    assert str(exc.value) == "HWP to PDF conversion is not available on this server."


def test_fax_number_creates_fax_record_but_no_permanent_file_item(main_module, tmp_path: Path) -> None:
    file_id = _upload(main_module, "send.pdf", b"%PDF-1.7\n", "application/pdf")
    main_module.fax_service = _service_with_converter(main_module, FakeConverter(tmp_path / "send.pdf"))

    result = main_module.send_fax_from_file({"file_id": file_id, "fax_number": "02-1234-5678"})

    assert result["ok"] is True
    assert main_module.get_file(file_id)["ok"] is False
    fax = main_module.get_fax(result["id"])["item"]
    assert fax["item_type"] == "fax"
    assert fax["remote_number"] == "02-1234-5678"


def test_uploaded_fax_source_creates_fax_without_file_item(main_module, tmp_path: Path) -> None:
    main_module.fax_service = _service_with_converter(main_module, FakeConverter(tmp_path / "upload-send.pdf"))
    source_path = main_module.fax_service.create_temp_fax_source(
        content=b"%PDF-1.7\nsource\n",
        original_filename="quick-send.pdf",
        mime_type="application/pdf",
    )

    ok, status, fax_id = main_module.fax_service.send_source_as_fax(
        source_file_path=source_path,
        fax_number="02-1234-5678",
        original_filename="quick-send.pdf",
        original_mime_type="application/pdf",
    )

    assert ok is True
    assert status == "queued"
    fax = main_module.get_fax(fax_id)["item"]
    assert fax["item_type"] == "fax"
    assert fax["remote_number"] == "02-1234-5678"
    assert fax["source_file_path"] == source_path
    with main_module.engine.begin() as conn:
        file_count = conn.execute(text(f"SELECT COUNT(*) FROM {DbTables.ITEMS} WHERE item_type = 'file'")).scalar_one()
    assert file_count == 0


def test_received_fax_alert_is_created_only_after_pdf_path_exists(main_module, tmp_path: Path) -> None:
    raw = tmp_path / "recv.tif"
    raw.write_bytes(b"raw")
    pdf = tmp_path / "recv.pdf"
    reminder = FakeReminderService()
    fax_service = _service_with_converter(main_module, FakeConverter(pdf), reminder)

    ok, _status, fax_id = fax_service.receive_incoming_raw(source_file_path=str(raw))

    assert ok is True
    fax = fax_service.get_fax(fax_id)
    assert Path(fax["pdf_file_path"]).exists()
    assert reminder.received
