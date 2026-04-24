# KaosGdd Web with systemd

This project can be run without Docker.

## Suggested server path
- repo: `/srv/KaosGdd-web`
- backend venv: `/srv/KaosGdd-web/backend/.venv`

## Backend setup

```bash
cd /srv/KaosGdd-web/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

## Frontend setup

```bash
cd /srv/KaosGdd-web/frontend
npm install
npm run build
```

## Configuration

- Copy the repo-root `.env.example` to `.env` and set values before starting services.
- Runtime knobs are centralized in `backend/app/config.py`.
- Centralized user-facing text lives in `backend/app/strings.py` and `frontend/lib/strings.js`.

## Data directory

```bash
mkdir -p /srv/KaosGdd-web/data
```

## Install units

```bash
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-backend.service /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-frontend.service /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-lifecycle.service /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-lifecycle.timer /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-reminders-fire-due.service /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-reminders-fire-due.timer /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-reminders-scan-missed.service /etc/systemd/system/
sudo cp /srv/KaosGdd-web/systemd/kaosgdd-reminders-scan-missed.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kaosgdd-backend
sudo systemctl enable kaosgdd-frontend
sudo systemctl enable kaosgdd-lifecycle.timer
sudo systemctl enable kaosgdd-reminders-fire-due.timer
sudo systemctl enable kaosgdd-reminders-scan-missed.timer
sudo systemctl restart kaosgdd-backend
sudo systemctl restart kaosgdd-frontend
sudo systemctl start kaosgdd-lifecycle.timer
sudo systemctl start kaosgdd-reminders-fire-due.timer
sudo systemctl start kaosgdd-reminders-scan-missed.timer
```

## Check status

```bash
sudo systemctl status kaosgdd-backend
sudo systemctl status kaosgdd-frontend
sudo systemctl status kaosgdd-lifecycle.timer
sudo systemctl status kaosgdd-reminders-fire-due.timer
sudo systemctl status kaosgdd-reminders-scan-missed.timer
```

## Logs

```bash
sudo journalctl -u kaosgdd-backend -f
sudo journalctl -u kaosgdd-frontend -f
sudo journalctl -u kaosgdd-lifecycle.service -f
sudo journalctl -u kaosgdd-reminders-fire-due.service -f
sudo journalctl -u kaosgdd-reminders-scan-missed.service -f
```

## Notes
- Both services bind to localhost.
- Reminder firing requires external scheduling. The included `kaosgdd-reminders-fire-due.timer` and `kaosgdd-reminders-scan-missed.timer` call `/internal/reminders/fire-due` (every minute) and `/internal/reminders/scan-missed` (every 5 minutes).
- Lifecycle cleanup is scheduled via `kaosgdd-lifecycle.timer`, which calls the backend internal maintenance endpoint daily.
- Access them through Tailscale or a local reverse proxy.
- If you change the unit files, run `sudo systemctl daemon-reload` before restarting.
