from __future__ import annotations

import os
import subprocess

from app.config import SETTINGS
from app.db.repo.fax_repo import FaxRepo
from app.db.repo.file_repo import FileRepo
from app.db.repo.items_repo import ItemsRepo
from app.engine.fax_pdf_conversion_service import FaxConversionError, FaxPdfConversionService
from app.utils.clock import now_iso
from app.utils.timefmt import format_dt_for_ui


class FaxService:
    def __init__(
        self,
        *,
        items_repo: ItemsRepo,
        fax_repo: FaxRepo,
        file_repo: FileRepo,
        conversion_service: FaxPdfConversionService,
        reminder_service=None,
        send_command=None,
        send_enabled: bool | None = None,
    ) -> None:
        self.items_repo = items_repo
        self.fax_repo = fax_repo
        self.file_repo = file_repo
        self.conversion_service = conversion_service
        self.reminder_service = reminder_service
        self.send_command = send_command or subprocess.run
        self.send_enabled = SETTINGS.FAX_SEND_ENABLED if send_enabled is None else bool(send_enabled)

    def list_faxes(self, mode: str = "active") -> list[dict]:
        return [self._decorate_fax(row) for row in self.fax_repo.list_faxes(mode=mode)]

    def get_fax(self, item_id: str) -> dict | None:
        row = self.fax_repo.get_fax_detail(item_id)
        return self._decorate_fax(row) if row else None

    def get_fax_pdf(self, item_id: str) -> tuple[dict, str] | None:
        detail = self.fax_repo.get_fax_detail(item_id)
        if detail is None:
            return None
        path = str(detail.get("pdf_file_path") or "").strip()
        if not path or not os.path.isfile(path):
            return None
        return detail, path

    def send_file_as_fax(self, *, file_id: str, fax_number: str) -> tuple[bool, str, str | None]:
        clean_number = str(fax_number or "").strip()
        if not clean_number:
            return False, "fax number is required", None

        file_detail = self.file_repo.get_file_detail(file_id)
        if file_detail is None:
            return False, "not found", None

        source_path = str(file_detail.get("stored_path") or "")
        original_filename = str(file_detail.get("original_filename") or "fax-source")
        original_mime_type = str(file_detail.get("mime_type") or "application/octet-stream")
        title = f"Fax to {clean_number}"

        try:
            pdf_path = self.conversion_service.convert_to_pdf(
                input_path=source_path,
                original_filename=original_filename,
                mime_type=original_mime_type,
            )
        except FaxConversionError as exc:
            fax_id = self._create_outgoing_record(
                title=title,
                status="conversion_failed",
                remote_number=clean_number,
                original_filename=original_filename,
                original_mime_type=original_mime_type,
                source_file_path=source_path,
                error_message=str(exc),
            )
            self._remove_source_file_item(file_id)
            return False, str(exc), fax_id

        fax_id = self._create_outgoing_record(
            title=title,
            status="queued",
            remote_number=clean_number,
            original_filename=original_filename,
            original_mime_type=original_mime_type,
            pdf_file_path=pdf_path,
            source_file_path=source_path,
        )
        self._remove_source_file_item(file_id)

        if self.send_enabled:
            sent_ok, error = self._submit_sendfax(fax_number=clean_number, pdf_path=pdf_path)
            if not sent_ok:
                now = now_iso()
                self.fax_repo.update_status(fax_id, fax_status="failed", failed_at=now, error_message=error)
                if self.reminder_service is not None:
                    self.reminder_service.notify_fax_send_failed(fax_id=fax_id, title=title, error_message=error)
                return False, error or "Fax send failed", fax_id

        return True, "queued", fax_id

    def receive_incoming_raw(
        self,
        *,
        source_file_path: str,
        remote_number: str | None = None,
        local_device: str | None = None,
        original_filename: str | None = None,
        original_mime_type: str | None = None,
    ) -> tuple[bool, str, str | None]:
        title = "Received fax"
        filename = original_filename or os.path.basename(source_file_path) or "received-fax"
        mime_type = original_mime_type or "image/tiff"
        try:
            pdf_path = self.conversion_service.convert_to_pdf(
                input_path=source_file_path,
                original_filename=filename,
                mime_type=mime_type,
            )
        except FaxConversionError as exc:
            fax_id = self.items_repo.create_item("fax", title)
            self.fax_repo.create_fax(
                fax_id,
                direction="incoming",
                fax_status="conversion_failed",
                remote_number=remote_number,
                local_device=local_device,
                original_filename=filename,
                original_mime_type=mime_type,
                source_file_path=source_file_path,
                failed_at=now_iso(),
                error_message=str(exc),
            )
            return False, str(exc), fax_id

        fax_id = self.items_repo.create_item("fax", title)
        self.fax_repo.create_fax(
            fax_id,
            direction="incoming",
            fax_status="received",
            remote_number=remote_number,
            local_device=local_device,
            original_filename=filename,
            original_mime_type=mime_type,
            pdf_file_path=pdf_path,
            source_file_path=source_file_path,
            received_at=now_iso(),
        )
        if self.reminder_service is not None:
            self.reminder_service.notify_fax_received(fax_id=fax_id, title=title)
        return True, "received", fax_id

    def _create_outgoing_record(
        self,
        *,
        title: str,
        status: str,
        remote_number: str,
        original_filename: str,
        original_mime_type: str,
        pdf_file_path: str | None = None,
        source_file_path: str | None = None,
        error_message: str | None = None,
    ) -> str:
        fax_id = self.items_repo.create_item("fax", title)
        self.fax_repo.create_fax(
            fax_id,
            direction="outgoing",
            fax_status=status,
            remote_number=remote_number,
            original_filename=original_filename,
            original_mime_type=original_mime_type,
            pdf_file_path=pdf_file_path,
            source_file_path=source_file_path,
            failed_at=now_iso() if status in {"failed", "conversion_failed"} else None,
            error_message=error_message,
        )
        return fax_id

    def _submit_sendfax(self, *, fax_number: str, pdf_path: str) -> tuple[bool, str | None]:
        result = self.send_command(
            ["sendfax", "-n", "-d", fax_number, pdf_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return True, None
        return False, (result.stderr or result.stdout or "Fax send failed").strip()

    def _remove_source_file_item(self, file_id: str) -> None:
        detail = self.file_repo.get_file_detail(file_id)
        if detail is None:
            return
        path = str(detail.get("stored_path") or "").strip()
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass
        self.items_repo.hard_delete_item(file_id)

    def _decorate_fax(self, row: dict) -> dict:
        item = dict(row)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["received_at_display"] = format_dt_for_ui(item.get("received_at"))
        item["sent_at_display"] = format_dt_for_ui(item.get("sent_at"))
        item["failed_at_display"] = format_dt_for_ui(item.get("failed_at"))
        item["pdf_available"] = bool(item.get("pdf_file_path") and os.path.isfile(str(item.get("pdf_file_path"))))
        return item
