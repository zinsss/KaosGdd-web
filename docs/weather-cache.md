# Shared Weather Cache

KaosGdd uses one backend-owned weather cache for application weather. Frontend pages should request KaosGdd weather only; they should not call an external weather provider directly.

See also [Architecture](architecture.md) for the broader backend/frontend relationship.

## SQLite Tables

`weather_locations`

- `id`
- `label`
- `latitude`
- `longitude`
- `provider`
- `enabled`
- `display_order`
- `created_at`
- `updated_at`

`weather_cache`

- `location_id`
- `payload_json`
- `fetched_at`
- `expires_at`
- `updated_at`

`payload_json` stores the provider forecast payload normalized by the backend. The current payload contains daily summaries and per-date daypart rows.

The legacy `weather_daily_snapshots` table remains for compatibility with existing backend daily-weather code, but new frontend consumers should use the shared cache endpoint.

Seeded enabled locations are:

- 영덕 (`yeongdeok`)
- 포항 (`pohang`)
- 대구 (`daegu`)
- 영천 (`yeongcheon`)

## Endpoint

Use:

```text
GET /api/weather
```

The response contains all enabled weather locations:

```json
{
  "ok": true,
  "ttl_seconds": 3600,
  "locations": [
    {
      "id": "pohang",
      "label": "포항",
      "provider": "open-meteo",
      "stale": false,
      "fetched_at": "2026-06-27T09:00:00+09:00",
      "expires_at": "2026-06-27T10:00:00+09:00",
      "weather": {
        "daily": [],
        "dayparts": {}
      }
    }
  ]
}
```

## Cache Flow

Default TTL: 1 hour.

For each enabled location, currently 영덕, 포항, 대구, and 영천:

1. If cache is missing, fetch from the provider and store `payload_json`.
2. If cache is expired, fetch from the provider and update `payload_json`.
3. If cache is fresh, return cached weather.
4. If provider fetch fails and cache exists, return cached weather with `stale: true`.
5. If provider fetch fails and no cache exists, return that location with `stale: true`, `error: "weather unavailable"`, and an empty weather payload.

One failed location does not fail the whole endpoint.

## Frontend Consumption

Use `frontend/app/lib/weather-client.js`.

Main Events and Family Calendar call helper functions there. Those helpers fetch `/api/weather` and slice the shared cached payload into the page-specific daily/daypart shapes.

New pages should reuse the same helper or call `/api/weather` directly through the application frontend route. Do not create module-specific weather endpoints such as `/family/weather`, and do not call external weather providers from frontend code.

## Current Consumers

- Main Events: loads shared weather directly and should be able to prime the cache on a cold app start.
- Family Calendar: loads the same shared weather payload and renders compact weather in the expanded week.

Neither page should depend on the other page being opened first.

## Needs More Information

- Confirm production weather rows are reading from `weather_cache` after each deploy, not legacy snapshot-only paths.
- Decide whether a background refresh timer is needed or request-triggered refresh remains enough.
- Decide whether weather location editing belongs in Settings only or should eventually have a dedicated admin surface.
