from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class PushTestDiagnosticRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def upsert_last_test(
        self,
        *,
        client_id: str,
        test_at: str,
        ok: bool,
        sent: int,
        removed: int,
        first_error_summary: str | None,
    ) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {table}(
                        client_id, last_test_at, ok, sent, removed, first_error_summary, updated_at
                    ) VALUES (
                        :client_id, :last_test_at, :ok, :sent, :removed, :first_error_summary, :updated_at
                    )
                    ON CONFLICT(client_id) DO UPDATE SET
                        last_test_at = excluded.last_test_at,
                        ok = excluded.ok,
                        sent = excluded.sent,
                        removed = excluded.removed,
                        first_error_summary = excluded.first_error_summary,
                        updated_at = excluded.updated_at
                    """.format(table=DbTables.PUSH_TEST_DIAGNOSTICS)
                ),
                {
                    "client_id": client_id,
                    "last_test_at": test_at,
                    "ok": 1 if ok else 0,
                    "sent": int(sent),
                    "removed": int(removed),
                    "first_error_summary": first_error_summary,
                    "updated_at": now,
                },
            )

    def get_for_client(self, client_id: str) -> dict | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT client_id, last_test_at, ok, sent, removed, first_error_summary
                    FROM {table}
                    WHERE client_id = :client_id
                    LIMIT 1
                    """.format(table=DbTables.PUSH_TEST_DIAGNOSTICS)
                ),
                {"client_id": client_id},
            ).mappings().first()

        if row is None:
            return None
        return {
            "client_id": row["client_id"],
            "last_test_at": row["last_test_at"],
            "ok": bool(row["ok"]),
            "sent": int(row["sent"] or 0),
            "removed": int(row["removed"] or 0),
            "first_error_summary": row.get("first_error_summary"),
        }
