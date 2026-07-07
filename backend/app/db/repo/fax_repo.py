from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class FaxRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def create_fax(
        self,
        item_id: str,
        *,
        direction: str,
        fax_status: str,
        remote_number: str | None = None,
        local_device: str | None = None,
        original_filename: str | None = None,
        original_mime_type: str | None = None,
        pdf_file_path: str | None = None,
        source_file_path: str | None = None,
        received_at: str | None = None,
        sent_at: str | None = None,
        failed_at: str | None = None,
        error_message: str | None = None,
    ) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {fax_items}(
                        item_id, direction, fax_status, remote_number, local_device,
                        original_filename, original_mime_type, pdf_file_path, source_file_path,
                        saved_file_id, received_at, sent_at, failed_at, error_message
                    )
                    VALUES (
                        :item_id, :direction, :fax_status, :remote_number, :local_device,
                        :original_filename, :original_mime_type, :pdf_file_path, :source_file_path,
                        NULL, :received_at, :sent_at, :failed_at, :error_message
                    )
                    """.format(fax_items=DbTables.FAX_ITEMS)
                ),
                {
                    "item_id": item_id,
                    "direction": direction,
                    "fax_status": fax_status,
                    "remote_number": remote_number,
                    "local_device": local_device,
                    "original_filename": original_filename,
                    "original_mime_type": original_mime_type,
                    "pdf_file_path": pdf_file_path,
                    "source_file_path": source_file_path,
                    "received_at": received_at,
                    "sent_at": sent_at,
                    "failed_at": failed_at,
                    "error_message": error_message,
                },
            )

    def list_faxes(self, mode: str = "active") -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id, i.item_type, i.title, i.status, i.created_at, i.updated_at, i.deleted_at,
                           f.direction, f.fax_status, f.remote_number, f.local_device,
                           f.original_filename, f.original_mime_type, f.pdf_file_path, f.source_file_path,
                           f.saved_file_id,
                           f.received_at, f.sent_at, f.failed_at, f.error_message
                    FROM {items} i
                    INNER JOIN {fax_items} f ON f.item_id = i.id
                    WHERE i.item_type = 'fax' AND i.status = :status
                    ORDER BY i.created_at DESC, i.id DESC
                    """.format(items=DbTables.ITEMS, fax_items=DbTables.FAX_ITEMS)
                ),
                {"status": mode},
            ).mappings().all()
        return [dict(row) for row in rows]

    def get_fax_detail(self, item_id: str) -> dict | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT i.id, i.item_type, i.title, i.status, i.created_at, i.updated_at, i.deleted_at,
                           f.direction, f.fax_status, f.remote_number, f.local_device,
                           f.original_filename, f.original_mime_type, f.pdf_file_path, f.source_file_path,
                           f.saved_file_id,
                           f.received_at, f.sent_at, f.failed_at, f.error_message
                    FROM {items} i
                    INNER JOIN {fax_items} f ON f.item_id = i.id
                    WHERE i.id = :item_id AND i.item_type = 'fax'
                    LIMIT 1
                    """.format(items=DbTables.ITEMS, fax_items=DbTables.FAX_ITEMS)
                ),
                {"item_id": item_id},
            ).mappings().first()
        return dict(row) if row else None

    def update_status(
        self,
        item_id: str,
        *,
        fax_status: str,
        sent_at: str | None = None,
        failed_at: str | None = None,
        error_message: str | None = None,
    ) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {fax_items}
                    SET fax_status = :fax_status,
                        sent_at = COALESCE(:sent_at, sent_at),
                        failed_at = COALESCE(:failed_at, failed_at),
                        error_message = :error_message
                    WHERE item_id = :item_id
                    """.format(fax_items=DbTables.FAX_ITEMS)
                ),
                {
                    "item_id": item_id,
                    "fax_status": fax_status,
                    "sent_at": sent_at,
                    "failed_at": failed_at,
                    "error_message": error_message,
                },
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :id".format(items=DbTables.ITEMS)),
                {"id": item_id, "updated_at": now_iso()},
            )

    def mark_saved_to_file(self, item_id: str, *, saved_file_id: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE {fax_items}
                    SET saved_file_id = :saved_file_id,
                        pdf_file_path = NULL,
                        source_file_path = NULL
                    WHERE item_id = :item_id
                    """.format(fax_items=DbTables.FAX_ITEMS)
                ),
                {"item_id": item_id, "saved_file_id": saved_file_id},
            )
            conn.execute(
                text("UPDATE {items} SET updated_at = :updated_at WHERE id = :id".format(items=DbTables.ITEMS)),
                {"id": item_id, "updated_at": now_iso()},
            )

    def list_stale_incoming_unsaved(self, *, cutoff_iso: str) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT i.id, i.item_type, i.title, i.status, i.created_at, i.updated_at, i.deleted_at,
                           f.direction, f.fax_status, f.remote_number, f.local_device,
                           f.original_filename, f.original_mime_type, f.pdf_file_path, f.source_file_path,
                           f.saved_file_id,
                           f.received_at, f.sent_at, f.failed_at, f.error_message
                    FROM {items} i
                    INNER JOIN {fax_items} f ON f.item_id = i.id
                    WHERE i.item_type = 'fax'
                      AND i.status = 'active'
                      AND f.direction = 'incoming'
                      AND f.fax_status = 'received'
                      AND f.saved_file_id IS NULL
                      AND COALESCE(f.received_at, i.created_at) < :cutoff_iso
                    ORDER BY i.created_at ASC, i.id ASC
                    """.format(items=DbTables.ITEMS, fax_items=DbTables.FAX_ITEMS)
                ),
                {"cutoff_iso": cutoff_iso},
            ).mappings().all()
        return [dict(row) for row in rows]
