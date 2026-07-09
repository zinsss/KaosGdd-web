import json

from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class FamilyRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def get_record(self, namespace: str, record_key: str):
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT payload_json
                    FROM {family_records}
                    WHERE namespace = :namespace
                      AND record_key = :record_key
                    LIMIT 1
                    """.format(family_records=DbTables.FAMILY_RECORDS)
                ),
                {"namespace": namespace, "record_key": record_key},
            ).mappings().first()
        if not row:
            return None
        try:
            return json.loads(row["payload_json"])
        except (TypeError, json.JSONDecodeError):
            return None

    def put_record(self, namespace: str, record_key: str, payload) -> dict:
        now = now_iso()
        record_id = f"{namespace}:{record_key}"
        payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {family_records}(id, namespace, record_key, payload_json, created_at, updated_at)
                    VALUES (:id, :namespace, :record_key, :payload_json, :created_at, :updated_at)
                    ON CONFLICT(namespace, record_key) DO UPDATE SET
                        payload_json = excluded.payload_json,
                        updated_at = excluded.updated_at
                    """.format(family_records=DbTables.FAMILY_RECORDS)
                ),
                {
                    "id": record_id,
                    "namespace": namespace,
                    "record_key": record_key,
                    "payload_json": payload_json,
                    "created_at": now,
                    "updated_at": now,
                },
            )
        return {"namespace": namespace, "record_key": record_key, "payload": payload}
