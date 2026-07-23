# Kaos Fax / HylaFAX Operations Playbook

This document captures the current KaosGdd fax runtime, the workarounds used in production, and the planned boundary split for KaosFax / kaoseghis-fax.

It is intended as an operations handoff document, not a product redesign.

## 1) Current architecture and ownership

### Why this exists
KaosGdd currently uses HylaFAX as the fax transport and keeps fax records in the KaosGdd database for feature parity with dashboard/reminders/files/fax inbox UI.

### Ownership model (current)

- **KaosGdd backend (active owner)**
  - owns fax item records (`items + fax_items`)
  - stores source/upload previews and PDF artifacts
  - creates / updates fax records
  - converts source document to PDF and then to send-ready TIFF
  - calls host `sendfax`
  - reconciles status from HylaFAX `doneq`
  - sends notifications on send/receive failures
  - exposes `/fax` APIs and frontend endpoints

- **HylaFAX (transport owner)**
  - owns modem, scheduler, send queue, receive queue
  - actual transmission and phone-level retries

- **Incoming path integration**
  - HylaFAX receives fax -> `faxrcvd` -> KaosGdd hook -> KaosGdd incoming API
  - KaosGdd converts raw fax image to PDF and creates a fax inbox item

## 2) Runtime pipeline (current)

### Outgoing

```text
Quick command in capture grammar (selected file)
  fax:{number}
        |
        v
/frontend /api/fax/send-upload
        |
        v
/backend fax_service.send_source_as_fax
  - validate number
  - create outgoing fax record
  - convert source -> PDF
  - convert PDF -> temporary TIFF (via FaxPdfConversionService)
  - call sendfax (subprocess)
  - remove temporary TIFF after sendfax returns
        |
        v
/outgoing queued/failed/sent state stored in DB
        |
        v
/frontend /fax list (or detail)
  -> sync_outgoing_statuses()
  -> read /var/spool/hylafax/doneq
  -> update status
```

### Incoming

```text
HylaFAX receive
  -> /var/spool/hylafax/bin/faxrcvd
      -> /var/spool/hylafax/bin/kaosgdd-faxrcvd (wrapper)
          -> /srv/KaosGdd-web/backend/scripts/hylafax_recv_hook.py
              -> POST /fax/incoming
                  -> KaosGdd converts raw TIFF to PDF
                  -> Fax item created, optional notification
```

## 3) Why the workarounds exist (and when they were introduced)

### 3.1 Host auth / PASS prompt workaround (`hosts.hfaxd`)

**Problem observed**: `faxstat` prompts `Password:` or `331 Password required` when backend client identity is not trusted by host `hfaxd`.

**Resolution**:
- add explicit client entries (e.g. `^root@172\.18\.0\.[0-9]+$:::`) and localhost variants in the active `hosts.hfaxd` file used by the host daemon.
- ensure file permissions are safe (`uucp:uucp`, `600`).

**Why only here**: containerized backend sends from root identity; reverse DNS and container hostnames vary by deployment.

### 3.2 Send as TIFF instead of relying on host PDF conversion

**Problem observed**: host-side `/undefinedfilename` / conversion failures and permission issues when HylaFAX tries to convert PDF payloads itself.

**Resolution**:
- KaosGdd converts PDFs into fax-ready TIFF in-app and submits TIFF to `sendfax`.
- original PDF remains app-side canonical preview artifact.

**Why this path**: reduced coupling to host conversion state, avoids common host conversion failures, deterministic send preparation.

### 3.3 Lazy doneq reconciliation

**Problem observed**: status lag/consistency without dedicated background polling; also avoided extra infra.

**Resolution**:
- `list_faxes()` and `get_fax()` call `sync_outgoing_statuses()`.
- sync scans `doneq` only when user opens list/detail.

**Why**: simpler operationally and still reliable enough for now.

### 3.4 Hook chain stability (wrapper + optional chaining)

**Problem observed**: HylaFAX update and package upgrades risk replacing hook scripts.

**Resolution**:
- install script keeps pre-kaosgdd copy, then installs wrapper + KaosGdd hook executable.
- wrapper runs KaosGdd hook first, then chains to previous hook when present.

### 3.5 Path/version variance in `hosts.hfaxd`

**Problem observed**: package paths vary (`/etc/hylafax/hosts.hfaxd`, `/var/spool/hylafax/etc/hosts.hfaxd`, `/etc/hosts.hfaxd` etc.).

**Resolution**:
- document all discovered candidate paths, check which exists via `find /etc /var/spool -name hosts.hfaxd -print`.
- test on target node and patch active file.

### 3.6 Bridge/firewall issues in Docker

**Problem observed**: backend container could not reach host daemon.

**Resolution**:
- `extra_hosts` in compose: `host.docker.internal:host-gateway`
- check bridge name (`ip link show | grep br-`) and if needed allow inbound to `4559`.

## 4) Files and scripts used today

### Operational scripts/configs

- `ops/hylafax/install-kaosgdd-hylafax-hooks.sh`
- `ops/hylafax/faxrcvd.kaosgdd-working`
- `ops/hylafax/kaosgdd-faxrcvd.working`
- `backend/scripts/hylafax_recv_hook.py`
- `ops/hylafax/README.md`
- `docs/fax-settings.md`
- `ops/backup/kaosgdd-backup.sh` (HylaFAX path/config backup entries)
- `.env` / `.env.example` fax variables
- `docker-compose.yml` fax-related env + `extra_hosts`

## 5) Copy of active scripts/config snippets

> These snippets are intentionally duplicated here for future troubleshooting and migration handoff.

### 5.1 `ops/hylafax/faxrcvd.kaosgdd-working`

```sh
#!/bin/sh

LOG=/tmp/kaosgdd-faxrcvd-auto.log

{
  echo "---- $(date -Is) faxrcvd wrapper called ----"
  echo "args=$*"
  echo "user=$(id)"
  echo "pwd=$(pwd)"
} >> "$LOG" 2>&1

# First send to KaosGdd.
/var/spool/hylafax/bin/kaosgdd-faxrcvd "$@" >> "$LOG" 2>&1
echo "kaosgdd exit=$?" >> "$LOG" 2>&1

# Then run original HylaFAX faxrcvd if present.
ORIG=$(ls -1 /var/spool/hylafax/bin/faxrcvd.orig.* 2>/dev/null | sort | tail -1)
if [ -n "$ORIG" ] && [ -x "$ORIG" ]; then
  "$ORIG" "$@" >> "$LOG" 2>&1
  echo "original faxrcvd exit=$?" >> "$LOG" 2>&1
fi

exit 0
```

### 5.2 `ops/hylafax/kaosgdd-faxrcvd.working`

```sh
#!/bin/sh

LOG=/tmp/kaosgdd-faxrcvd.log

FILE_ARG="$1"
DEVICE="${2:-ttyACM0}"
COMMID="${3:-}"
ERROR_MSG="${4:-}"
SENDER="${5:-unknown}"

case "$FILE_ARG" in
  /*) FILE="$FILE_ARG" ;;
  *) FILE="/var/spool/hylafax/$FILE_ARG" ;;
esac

{
  echo "---- $(date -Is) kaosgdd-faxrcvd called ----"
  echo "args=$*"
  echo "FILE_ARG=$FILE_ARG"
  echo "FILE=$FILE"
  echo "DEVICE=$DEVICE"
  echo "COMMID=$COMMID"
  echo "ERROR_MSG=$ERROR_MSG"
  echo "SENDER=$SENDER"
  ls -lah "$FILE" 2>&1

  KAOSGDD_API_BASE=http://127.0.0.1:8000 \
    /srv/KaosGdd-web/backend/.venv/bin/python \
    /srv/KaosGdd-web/backend/scripts/hylafax_recv_hook.py \
    "$FILE" \
    "$SENDER" \
    "$DEVICE"

  echo "hook exit=$?"
} >> "$LOG" 2>&1

exit 0
```

### 5.3 `ops/hylafax/install-kaosgdd-hylafax-hooks.sh`

```sh
#!/bin/sh
set -eu

SRC_DIR="/srv/KaosGdd-web/ops/hylafax"
FAX_BIN="/var/spool/hylafax/bin"

echo "Installing KaosGdd HylaFAX receive hooks..."

if [ ! -f "$SRC_DIR/faxrcvd.kaosgdd-working" ]; then
  echo "Missing $SRC_DIR/faxrcvd.kaosgdd-working" >&2
  exit 1
fi

if [ ! -f "$SRC_DIR/kaosgdd-faxrcvd.working" ]; then
  echo "Missing $SRC_DIR/kaosgdd-faxrcvd.working" >&2
  exit 1
fi

if [ -f "$FAX_BIN/faxrcvd" ]; then
  cp -a "$FAX_BIN/faxrcvd" "$FAX_BIN/faxrcvd.pre-kaosgdd.$(date +%Y%m%d-%H%M%S)"
fi

cp -a "$SRC_DIR/faxrcvd.kaosgdd-working" "$FAX_BIN/faxrcvd"
cp -a "$SRC_DIR/kaosgdd-faxrcvd.working" "$FAX_BIN/kaosgdd-faxrcvd"

chown uucp:uucp "$FAX_BIN/faxrcvd" "$FAX_BIN/kaosgdd-faxrcvd"
chmod 755 "$FAX_BIN/faxrcvd" "$FAX_BIN/kaosgdd-faxrcvd"

echo "Installed:"
ls -lah "$FAX_BIN/faxrcvd" "$FAX_BIN/kaosgdd-faxrcvd"

echo "Restarting services..."
systemctl restart hylafax-core.service
systemctl restart faxgetty@ttyACM0.service
systemctl restart kaosgdd-backend.service

echo "Done."
```

### 5.4 `backend/scripts/hylafax_recv_hook.py`

```python
#!/usr/bin/env python3
"""HylaFAX recvq hook for KaosGdd Fax v0.

Install this from HylaFAX's FaxDispatch/recvq workflow after a received raw
fax file exists.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: hylafax_recv_hook.py RAW_FAX_PATH [REMOTE_NUMBER] [LOCAL_DEVICE]", file=sys.stderr)
        return 2

    source_file_path = argv[1]
    payload = {
        "source_file_path": source_file_path,
        "remote_number": argv[2] if len(argv) > 2 else "",
        "local_device": argv[3] if len(argv) > 3 else "",
        "original_filename": os.path.basename(source_file_path),
        "original_mime_type": "image/tiff",
    }
    api_base = os.environ.get("KAOSGDD_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    request = urllib.request.Request(
        f"{api_base}/fax/incoming",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        print(f"KaosGdd incoming fax hook failed: {exc}", file=sys.stderr)
        return 1

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        print(f"KaosGdd incoming fax hook returned non-JSON: {body[:200]}", file=sys.stderr)
        return 1

    if not parsed.get("ok"):
        print(f"KaosGdd incoming fax hook failed: {parsed.get('status') or parsed.get('error')}", file=sys.stderr)
        return 1

    print(f"KaosGdd incoming fax created: {parsed.get('id')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

### 5.5 `docs/fax-settings.md` + `.env.example` + compose snippets

Key values used in deployment:

```env
FAXSERVER=host.docker.internal
FAX_SEND_TIMEOUT_SECONDS=30
FAX_DONEQ_DIR=/var/spool/hylafax/doneq
```

Compose sets `extra_hosts` for host reachability and forwards `FAX_DONEQ_DIR`/send settings into backend.

## 6) Planned boundary split (KaosFax + kaoseghis-fax)

You asked for:
- move fax modem/backend role out to a new clinic service (`kaos-clinic` / KaosFax)
- keep KaosGdd as frontend

### Proposed target state (planned)

- **KaosFax**
  - owns modem + transport + fax queue + fax DB/history
  - owns actual send/receive persistence
  - owns fax-specific policies and retention
  - owns direct HylaFAX operations and hook lifecycle

- **KaosGdd / kaoseghis-fax**
  - remain frontend-only (API consumer)
  - keep `/fax` UI, search/filter, save-to-files, notifications entry points
  - keep current capture grammar UX (`fax:{number}` quick send)
  - rely on KaosFax APIs for outgoing send and incoming ingestion

### Backward compatibility strategy

For minimal disruption:
- first expose KaosFax-compatible API contracts used by current KaosGdd clients
- keep `/api/fax/send-*` and `/fax` response shape stable
- keep quick send flow semantics (selected file, selected-file only, no File auto-creation)
- map `doneq` status synchronization to KaosFax-side event feed/webhook/poll model

## 7) Validation and operational checks

- Outgoing path
  - `docker exec kaosgdd-backend command -v sendfax`
  - `docker exec kaosgdd-backend faxstat -h "$FAXSERVER"`
  - `/fax` API returns not-stuck queued items after job done in queue
- Incoming path
  - logs: `/tmp/kaosgdd-faxrcvd.log`, `/tmp/kaosgdd-faxrcvd-auto.log`
  - `faxstat -s`, `faxstat -d`
- Hooks present
  - `/var/spool/hylafax/bin/faxrcvd`
  - `/var/spool/hylafax/bin/kaosgdd-faxrcvd`
- Host/client auth
  - `find /etc /var/spool -name hosts.hfaxd -print`
  - confirm active file contains matching no-password root client entry
- Network
  - Docker bridge is reachable to `4559`
  - `ss -tulpn | grep 4559`
  - `host.docker.internal` resolves in backend container

## 8) Recovery notes seen in operations

- If only `faxstat` fails and KaosGdd still sends but no completion: verify service-side `sendq` vs `doneq` mount and container permissions.
- If `fax:02-...` sends as queued forever: open `/fax` once to trigger sync and verify `FAX_DONEQ_DIR` visibility in container.
- If `Error: /undefinedfilename` still appears: confirm send path still submits TIFF, not PDF.
- If backend reports `sendfax command timed out`: check host HylaFAX daemon/listener and network reachability from container.
