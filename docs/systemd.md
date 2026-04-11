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
sudo systemctl daemon-reload
sudo systemctl enable kaosgdd-backend
sudo systemctl enable kaosgdd-frontend
sudo systemctl enable kaosgdd-lifecycle.timer
sudo systemctl restart kaosgdd-backend
sudo systemctl restart kaosgdd-frontend
sudo systemctl start kaosgdd-lifecycle.timer
```

## Check status

```bash
sudo systemctl status kaosgdd-backend
sudo systemctl status kaosgdd-frontend
sudo systemctl status kaosgdd-lifecycle.timer
```

## Logs

```bash
sudo journalctl -u kaosgdd-backend -f
sudo journalctl -u kaosgdd-frontend -f
sudo journalctl -u kaosgdd-lifecycle.service -f
```

## Notes
- Both services bind to localhost.
- Lifecycle cleanup is now scheduled outside the app process via `kaosgdd-lifecycle.timer`, which calls the backend internal maintenance endpoint daily.
- Access them through Tailscale or a local reverse proxy.
- If you change the unit files, run `sudo systemctl daemon-reload` before restarting.
