# KaosGdd Web

Internal web app for KaosGdd, intended for Tailscale-only access.

## Stack
- FastAPI backend
- Next.js frontend
- SQLite database
- Docker Compose

## Run

1. Copy env file

```bash
cp .env.example .env
```

2. Start app

```bash
docker compose up --build
```

3. Open on the server through Tailscale/private access:
- frontend: http://127.0.0.1:3000
- backend: http://127.0.0.1:8000/health

## Notes
- SQLite file is stored under `./data`
- Backend owns logic
- Frontend is UI only
