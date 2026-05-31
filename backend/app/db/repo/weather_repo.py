from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class WeatherRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def list_snapshots(self, *, location_id: str, start_date: str, end_date: str):
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        id,
                        location_id,
                        location_label,
                        date,
                        condition_bucket,
                        weather_glyph,
                        weather_code,
                        min_c,
                        max_c,
                        source,
                        fetched_at,
                        updated_at
                    FROM {weather_daily_snapshots}
                    WHERE location_id = :location_id
                      AND date >= :start_date
                      AND date <= :end_date
                    ORDER BY date ASC
                    """.format(weather_daily_snapshots=DbTables.WEATHER_DAILY_SNAPSHOTS)
                ),
                {"location_id": location_id, "start_date": start_date, "end_date": end_date},
            ).mappings().all()
        return [dict(row) for row in rows]

    def latest_fetched_at(self, *, location_id: str) -> str | None:
        with self.engine.begin() as conn:
            return conn.execute(
                text(
                    """
                    SELECT MAX(fetched_at)
                    FROM {weather_daily_snapshots}
                    WHERE location_id = :location_id
                    """.format(weather_daily_snapshots=DbTables.WEATHER_DAILY_SNAPSHOTS)
                ),
                {"location_id": location_id},
            ).scalar_one_or_none()

    def upsert_snapshots(self, snapshots: list[dict]) -> None:
        if not snapshots:
            return

        now = now_iso()
        with self.engine.begin() as conn:
            for snapshot in snapshots:
                conn.execute(
                    text(
                        """
                        INSERT INTO {weather_daily_snapshots} (
                            id,
                            location_id,
                            location_label,
                            date,
                            condition_bucket,
                            weather_glyph,
                            weather_code,
                            min_c,
                            max_c,
                            source,
                            fetched_at,
                            updated_at
                        )
                        VALUES (
                            :id,
                            :location_id,
                            :location_label,
                            :date,
                            :condition_bucket,
                            :weather_glyph,
                            :weather_code,
                            :min_c,
                            :max_c,
                            :source,
                            :fetched_at,
                            :updated_at
                        )
                        ON CONFLICT(location_id, date) DO UPDATE SET
                            location_label = excluded.location_label,
                            condition_bucket = excluded.condition_bucket,
                            weather_glyph = excluded.weather_glyph,
                            weather_code = excluded.weather_code,
                            min_c = excluded.min_c,
                            max_c = excluded.max_c,
                            source = excluded.source,
                            fetched_at = excluded.fetched_at,
                            updated_at = excluded.updated_at
                        """.format(weather_daily_snapshots=DbTables.WEATHER_DAILY_SNAPSHOTS)
                    ),
                    {
                        **snapshot,
                        "id": snapshot.get("id") or f"{snapshot['location_id']}:{snapshot['date']}",
                        "updated_at": now,
                    },
                )
