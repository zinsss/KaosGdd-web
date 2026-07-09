from __future__ import annotations

import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

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
        self.sync_outgoing_statuses()
        return [self._decorate_fax(row) for row in self.fax_repo.list_faxes(mode=mode)]

    def get_fax(self, item_id: str) -> dict | None:
        self.sync_outgoing_statuses()
        row = self.fax_repo.get_fax_detail(item_id)
        return self._decorate_fax(row) if row else None

    def sync_outgoing_statuses(self) -> None:
        queued = [
            row
            for row in self.fax_repo.list_faxes(mode="active")
            if str(row.get("direction") or "").lower() == "outgoing"
            and str(row.get("fax_status") or "").lower() in {"queued", "sending"}
        ]
        if not queued:
            return
        done_jobs = self._read_hylafax_done_jobs()
        if not done_jobs:
            return

        used_jobs: set[str] = set()
        for fax in sorted(queued, key=lambda row: str(row.get("created_at") or "")):
            match = self._match_done_job(fax, done_jobs, used_jobs)
            if match is None:
                continue
            used_jobs.add(str(match["jobid"]))
            completed_at = match["completed_at"].isoformat(timespec="seconds")
            if match["sent"]:
                self.fax_repo.update_status(fax["id"], fax_status="sent", sent_at=completed_at, error_message=None)
            else:
                self.fax_repo.update_status(
                    fax["id"],
                    fax_status="failed",
                    failed_at=completed_at,
                    error_message=match["status"] or "Fax send failed",
                )

    def get_fax_pdf(self, item_id: str) -> tuple[dict, str] | None:
        detail = self.fax_repo.get_fax_detail(item_id)
        if detail is None:
            return None
        path = str(detail.get("pdf_file_path") or "").strip()
        if not path or not os.path.isfile(path):
            saved_file_id = str(detail.get("saved_file_id") or "").strip()
            if not saved_file_id:
                return None
            file_detail = self.file_repo.get_file_detail(saved_file_id)
            if file_detail is None:
                return None
            path = str(file_detail.get("stored_path") or "").strip()
            if not path or not os.path.isfile(path):
                return None
        return detail, path

    def save_incoming_to_files(self, item_id: str) -> tuple[bool, str | None, str | None]:
        detail = self.fax_repo.get_fax_detail(item_id)
        if detail is None:
            return False, "not found", None
        if str(detail.get("direction") or "").lower() != "incoming":
            return False, "only incoming faxes can be saved to files", None
        if str(detail.get("status") or "").lower() != "active":
            return False, "fax is not active", None

        existing_file_id = str(detail.get("saved_file_id") or "").strip()
        if existing_file_id:
            return True, None, existing_file_id

        pdf_path = str(detail.get("pdf_file_path") or "").strip()
        if not pdf_path or not os.path.isfile(pdf_path):
            return False, "fax PDF not found", None

        original_filename = str(detail.get("original_filename") or "").strip() or f"{item_id}.pdf"
        file_name = self._fax_file_name(original_filename)
        stored_path = self._safe_file_storage_path(file_name)
        shutil.copyfile(pdf_path, stored_path)
        size_bytes = os.path.getsize(stored_path)

        file_id = self.items_repo.create_item("file", file_name)
        self.file_repo.create_file(
            file_id,
            original_filename=file_name,
            stored_path=stored_path,
            mime_type="application/pdf",
            size_bytes=size_bytes,
        )
        self.items_repo.replace_item_links(item_id, [file_id])
        self.fax_repo.mark_saved_to_file(item_id, saved_file_id=file_id)
        self._remove_temp_paths(detail)
        return True, None, file_id

    def delete_inbox_fax(self, item_id: str) -> bool:
        detail = self.fax_repo.get_fax_detail(item_id)
        if detail is None:
            return False
        self._remove_temp_paths(detail)
        return self.items_repo.hard_delete_item(item_id)

    def cleanup_stale_inbox_items(self, *, now: datetime | None = None) -> dict:
        current = now or datetime.now(timezone.utc)
        cutoff = (current - timedelta(days=SETTINGS.FAX_INBOX_RETENTION_DAYS)).isoformat(timespec="seconds")
        rows = self.fax_repo.list_stale_incoming_unsaved(cutoff_iso=cutoff)
        deleted = 0
        temp_files_deleted = 0
        for row in rows:
            temp_files_deleted += self._remove_temp_paths(row)
            if self.items_repo.hard_delete_item(str(row.get("id") or "")):
                deleted += 1
        return {
            "fax_inbox_deleted": deleted,
            "fax_temp_files_deleted": temp_files_deleted,
            "fax_inbox_retention_days": SETTINGS.FAX_INBOX_RETENTION_DAYS,
        }

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
        ok, status, fax_id = self.send_source_as_fax(
            source_file_path=source_path,
            fax_number=clean_number,
            original_filename=original_filename,
            original_mime_type=original_mime_type,
        )
        self._remove_source_file_item(file_id)
        return ok, status, fax_id

    def create_temp_fax_source(self, *, content: bytes, original_filename: str, mime_type: str) -> str:
        if not content:
            raise ValueError("fax source is empty")
        source_path = self._safe_fax_storage_path(original_filename or "fax-source")
        with open(source_path, "wb") as handle:
            handle.write(content)
        return source_path

    def send_source_as_fax(
        self,
        *,
        source_file_path: str,
        fax_number: str,
        original_filename: str,
        original_mime_type: str,
    ) -> tuple[bool, str, str | None]:
        clean_number = str(fax_number or "").strip()
        if not clean_number:
            return False, "fax number is required", None

        source_path = str(source_file_path or "").strip()
        if not source_path or not os.path.isfile(source_path):
            return False, "not found", None

        original_filename = str(original_filename or "fax-source")
        original_mime_type = str(original_mime_type or "application/octet-stream")
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
            return False, str(exc), fax_id

        try:
            submit_path = self.conversion_service.convert_pdf_to_fax_tiff(pdf_path=pdf_path)
        except FaxConversionError as exc:
            fax_id = self._create_outgoing_record(
                title=title,
                status="conversion_failed",
                remote_number=clean_number,
                original_filename=original_filename,
                original_mime_type=original_mime_type,
                source_file_path=source_path,
                pdf_file_path=pdf_path,
                error_message=str(exc),
            )
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

        if self.send_enabled:
            try:
                sent_ok, error = self._submit_sendfax(fax_number=clean_number, document_path=submit_path)
            finally:
                self._remove_temp_file(submit_path)
            if not sent_ok:
                now = now_iso()
                self.fax_repo.update_status(fax_id, fax_status="failed", failed_at=now, error_message=error)
                if self.reminder_service is not None:
                    self.reminder_service.notify_fax_send_failed(fax_id=fax_id, title=title, error_message=error)
                return False, error or "Fax send failed", fax_id
        else:
            self._remove_temp_file(submit_path)

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
            self.reminder_service.notify_fax_received(
                fax_id=fax_id,
                title=title,
                remote_number=remote_number,
                local_device=local_device,
            )
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

    def _submit_sendfax(self, *, fax_number: str, document_path: str) -> tuple[bool, str | None]:
        command = ["sendfax", "-n"]
        if SETTINGS.FAXSERVER:
            command.extend(["-h", SETTINGS.FAXSERVER])
        command.extend(["-d", fax_number, document_path])
        try:
            result = self.send_command(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=SETTINGS.FAX_SEND_TIMEOUT_SECONDS,
            )
        except FileNotFoundError:
            return False, "sendfax command not found"
        except subprocess.TimeoutExpired:
            return False, "sendfax command timed out"
        if result.returncode == 0:
            return True, None
        return False, (result.stderr or result.stdout or "Fax send failed").strip()

    def _remove_temp_file(self, path: str) -> None:
        value = str(path or "").strip()
        if not value:
            return
        try:
            os.remove(value)
        except OSError:
            pass

    def _read_hylafax_done_jobs(self) -> list[dict]:
        doneq = Path(SETTINGS.FAX_DONEQ_DIR)
        if not doneq.is_dir():
            return []
        jobs: list[dict] = []
        for path in doneq.glob("q*"):
            if not path.is_file():
                continue
            values = self._parse_hylafax_job_file(path)
            jobid = str(values.get("jobid") or path.name.removeprefix("q")).strip()
            number = str(values.get("number") or values.get("external") or "").strip()
            if not jobid or not number:
                continue
            status = str(values.get("status") or "").strip()
            statuscode = str(values.get("statuscode") or "").strip()
            state = str(values.get("state") or "").strip()
            returned = str(values.get("returned") or "").strip()
            completed_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
            jobs.append(
                {
                    "jobid": jobid,
                    "number": number,
                    "status": status,
                    "statuscode": statuscode,
                    "state": state,
                    "returned": returned,
                    "sent": statuscode == "0" or (state == "7" and returned == "2" and not status),
                    "completed_at": completed_at,
                }
            )
        return sorted(jobs, key=lambda job: job["completed_at"])

    def _parse_hylafax_job_file(self, path: Path) -> dict[str, str]:
        values: dict[str, str] = {}
        current_key: str | None = None
        for raw_line in path.read_text(errors="replace").splitlines():
            if current_key and raw_line.endswith("\\"):
                values[current_key] = f"{values[current_key]}\n{raw_line[:-1]}"
                continue
            current_key = None
            if ":" not in raw_line:
                continue
            key, value = raw_line.split(":", 1)
            values[key] = value[:-1] if value.endswith("\\") else value
            if value.endswith("\\"):
                current_key = key
        return values

    def _match_done_job(self, fax: dict, jobs: list[dict], used_jobs: set[str]) -> dict | None:
        created_at = self._parse_iso_datetime(str(fax.get("created_at") or ""))
        remote_number = self._digits(str(fax.get("remote_number") or ""))
        candidates = [
            job
            for job in jobs
            if str(job["jobid"]) not in used_jobs
            and self._digits(str(job["number"])) == remote_number
            and job["completed_at"] >= created_at - timedelta(minutes=10)
        ]
        if not candidates:
            return None
        after_created = [job for job in candidates if job["completed_at"] >= created_at]
        return min(after_created or candidates, key=lambda job: abs((job["completed_at"] - created_at).total_seconds()))

    def _parse_iso_datetime(self, value: str) -> datetime:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now(timezone.utc)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def _digits(self, value: str) -> str:
        return re.sub(r"\D+", "", value)

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

    def _safe_file_storage_path(self, original_filename: str) -> str:
        root = os.path.abspath(SETTINGS.FILE_STORAGE_DIR)
        os.makedirs(root, exist_ok=True)

        suffix = Path(str(original_filename or "")).suffix.lower()
        safe_suffix = suffix if suffix and len(suffix) <= 10 and suffix.replace(".", "").isalnum() else ".pdf"
        generated_name = f"{uuid4().hex}{safe_suffix}"
        path = os.path.abspath(os.path.join(root, generated_name))
        if not path.startswith(root + os.sep):
            raise ValueError("unsafe storage path")
        return path

    def _safe_fax_storage_path(self, original_filename: str) -> str:
        root = os.path.abspath(SETTINGS.FAX_STORAGE_DIR)
        os.makedirs(root, exist_ok=True)

        suffix = Path(str(original_filename or "")).suffix.lower()
        safe_suffix = suffix if suffix and len(suffix) <= 10 and suffix.replace(".", "").isalnum() else ".bin"
        generated_name = f"{uuid4().hex}{safe_suffix}"
        path = os.path.abspath(os.path.join(root, generated_name))
        if not path.startswith(root + os.sep):
            raise ValueError("unsafe fax storage path")
        return path

    def _fax_file_name(self, original_filename: str) -> str:
        stem = Path(str(original_filename or "received-fax")).stem.strip() or "received-fax"
        return f"{stem}.pdf"

    def _remove_temp_paths(self, detail: dict) -> int:
        removed = 0
        seen: set[str] = set()
        for key in ("pdf_file_path", "source_file_path"):
            path = str(detail.get(key) or "").strip()
            if not path or path in seen:
                continue
            seen.add(path)
            if not os.path.isfile(path):
                continue
            try:
                os.remove(path)
                removed += 1
            except OSError:
                pass
        return removed

    def _decorate_fax(self, row: dict) -> dict:
        item = dict(row)
        item["created_at_display"] = format_dt_for_ui(item.get("created_at"))
        item["updated_at_display"] = format_dt_for_ui(item.get("updated_at"))
        item["received_at_display"] = format_dt_for_ui(item.get("received_at"))
        item["sent_at_display"] = format_dt_for_ui(item.get("sent_at"))
        item["failed_at_display"] = format_dt_for_ui(item.get("failed_at"))
        item["pdf_available"] = bool(item.get("pdf_file_path") and os.path.isfile(str(item.get("pdf_file_path"))))
        if not item["pdf_available"] and item.get("saved_file_id"):
            file_detail = self.file_repo.get_file_detail(str(item.get("saved_file_id")))
            item["pdf_available"] = bool(file_detail and os.path.isfile(str(file_detail.get("stored_path") or "")))
        item["saved_to_files"] = bool(item.get("saved_file_id"))
        return item
