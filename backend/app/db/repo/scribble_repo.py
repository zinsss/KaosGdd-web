from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class ScribbleRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def get_scribble(self, key: str = "default") -> dict:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT key, body, updated_at
                    FROM {scribbles}
                    WHERE key = :key
                    LIMIT 1
                    """.format(scribbles=DbTables.SCRIBBLES)
                ),
                {"key": key},
            ).mappings().first()

        if row:
            return dict(row)
        return {"key": key, "body": "", "updated_at": None}

    def upsert_scribble(self, *, key: str = "default", body: str) -> dict:
        now = now_iso()
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE {scribbles}
                    SET body = :body,
                        updated_at = :updated_at
                    WHERE key = :key
                    """.format(scribbles=DbTables.SCRIBBLES)
                ),
                {"key": key, "body": body, "updated_at": now},
            )
            if result.rowcount == 0:
                conn.execute(
                    text(
                        """
                        INSERT INTO {scribbles}(key, body, updated_at)
                        VALUES (:key, :body, :updated_at)
                        """.format(scribbles=DbTables.SCRIBBLES)
                    ),
                    {"key": key, "body": body, "updated_at": now},
                )
        return {"key": key, "body": body, "updated_at": now}
