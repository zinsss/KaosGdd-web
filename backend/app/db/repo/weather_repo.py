from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso


class WeatherRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def ensure_locations(self, locations: list[dict]) -> None:
        if not locations:
            return

        now = now_iso()
        with self.engine.begin() as conn:
            for index, location in enumerate(locations):
                conn.execute(
                    text(
                        """
                        INSERT INTO {weather_locations} (
                            id,
                            label,
                            latitude,
                            longitude,
                            provider,
                            enabled,
                            display_order,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :id,
                            :label,
                            :latitude,
                            :longitude,
                            :provider,
                            :enabled,
                            :display_order,
                            :created_at,
                            :updated_at
                        )
                        ON CONFLICT(id) DO UPDATE SET
                            label = excluded.label,
                            latitude = excluded.latitude,
                            longitude = excluded.longitude,
                            provider = excluded.provider,
                            display_order = excluded.display_order,
                            updated_at = excluded.updated_at
                        """.format(weather_locations=DbTables.WEATHER_LOCATIONS)
                    ),
                    {
                        "id": location["id"],
                        "label": location["label"],
                        "latitude": float(location["latitude"]),
                        "longitude": float(location["longitude"]),
                        "provider": location.get("provider") or "open-meteo",
                        "enabled": 1 if location.get("enabled", True) else 0,
                        "display_order": int(location.get("display_order", index)),
                        "created_at": now,
                        "updated_at": now,
                    },
                )

    def list_locations(self, *, enabled_only: bool = False) -> list[dict]:
        where = "WHERE enabled = 1" if enabled_only else ""
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        id,
                        label,
                        latitude,
                        longitude,
                        provider,
                        enabled,
                        display_order,
                        created_at,
                        updated_at
                    FROM {weather_locations}
                    {where}
                    ORDER BY display_order ASC, label ASC
                    """.format(weather_locations=DbTables.WEATHER_LOCATIONS, where=where)
                )
            ).mappings().all()
        return [dict(row) for row in rows]

    def get_location(self, *, location_id: str) -> dict | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT
                        id,
                        label,
                        latitude,
                        longitude,
                        provider,
                        enabled,
                        display_order,
                        created_at,
                        updated_at
                    FROM {weather_locations}
                    WHERE id = :location_id
                    """.format(weather_locations=DbTables.WEATHER_LOCATIONS)
                ),
                {"location_id": location_id},
            ).mappings().first()
        return dict(row) if row else None

    def get_cache(self, *, location_id: str) -> dict | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT
                        location_id,
                        payload_json,
                        fetched_at,
                        expires_at,
                        updated_at
                    FROM {weather_cache}
                    WHERE location_id = :location_id
                    """.format(weather_cache=DbTables.WEATHER_CACHE)
                ),
                {"location_id": location_id},
            ).mappings().first()
        return dict(row) if row else None

    def upsert_cache(self, *, location_id: str, payload_json: str, fetched_at: str, expires_at: str) -> None:
        now = now_iso()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO {weather_cache} (
                        location_id,
                        payload_json,
                        fetched_at,
                        expires_at,
                        updated_at
                    )
                    VALUES (
                        :location_id,
                        :payload_json,
                        :fetched_at,
                        :expires_at,
                        :updated_at
                    )
                    ON CONFLICT(location_id) DO UPDATE SET
                        payload_json = excluded.payload_json,
                        fetched_at = excluded.fetched_at,
                        expires_at = excluded.expires_at,
                        updated_at = excluded.updated_at
                    """.format(weather_cache=DbTables.WEATHER_CACHE)
                ),
                {
                    "location_id": location_id,
                    "payload_json": payload_json,
                    "fetched_at": fetched_at,
                    "expires_at": expires_at,
                    "updated_at": now,
                },
            )

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
