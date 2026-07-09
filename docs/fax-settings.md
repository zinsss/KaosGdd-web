# Fax Settings

KaosGdd uses HylaFAX for incoming and outgoing fax handling.

The app owns:

- fax item records
- upload and file routing
- PDF conversion before send
- outgoing send status/error handling
- incoming receive hook ingestion

HylaFAX owns:

- modem access
- send queue
- receive queue
- actual fax transmission

## Capture Grammar

Quick outgoing fax with an attached file:

```text
fax:02-1234-5678
```

Rules:

- A file must be selected.
- `fax:` must be the first token.
- The fax number is required.
- No `++ title` File grammar is required.
- No durable File item is created.
- An outgoing Fax record is created.
- The uploaded file is converted to PDF for KaosGdd preview/storage.
- Before submission, the backend converts that PDF to a temporary fax-ready TIFF.
- The TIFF is submitted to HylaFAX, then removed after `sendfax` returns.

Durable File save with optional linked fax send still uses File grammar:

```text
++ 보험서류
x:02-1234-5678
```

## Backend Environment

Relevant variables:

```env
FAX_SEND_ENABLED=true
FAXSERVER=host.docker.internal
FAX_SEND_TIMEOUT_SECONDS=30
FAX_STORAGE_DIR=/data/uploads/fax
FAX_RECV_DIR=/var/spool/hylafax/recvq
FAX_INBOX_RETENTION_DAYS=90
```

In Docker, `FAXSERVER=host.docker.internal` points the backend `sendfax`
client at the host HylaFAX daemon. The compose service must also include:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

The backend image must include the HylaFAX client package:

```text
hylafax-client
```

It must also include Ghostscript and TIFF tools:

```text
ghostscript
libtiff-tools
```

KaosGdd intentionally submits a fax-ready TIFF to HylaFAX instead of asking
HylaFAX to convert PDFs in the host spool. This avoids host-side
`pdf2fax.gs` failures such as:

```text
Error: /undefinedfilename in (docq/docN.pdf.N)
Last OS error: Permission denied
```

The PDF remains the canonical artifact for app viewing; the TIFF is only a
temporary send artifact.

## Host HylaFAX Access

The host HylaFAX daemon listens on port `4559`.

Check host health:

```bash
faxstat -h localhost
```

Expected shape:

```text
HylaFAX scheduler on ...: Running
Modem ...: Running and idle
```

Allow the KaosGdd Docker bridge clients in HylaFAX.

The backend container runs `sendfax` as `root`. Depending on reverse DNS and
HylaFAX client matching, `hfaxd` may see the client as either `root@172.18.0.x`
or `root@<container-hostname>`. Use explicit empty password fields with `:::`
so HylaFAX does not request `PASS`.

```bash
sudo sh -c '
for f in /etc/hosts.hfaxd /var/spool/hylafax/etc/hosts.hfaxd /etc/hylafax/hosts.hfaxd; do
  d=$(dirname "$f")
  [ -d "$d" ] || continue
  cat > "$f" <<EOF
^root@172\\.18\\.0\\.[0-9]+$:::
^root@[0-9a-f]+$:::
^.*@127\\.0\\.0\\.1$:::
EOF
  chown uucp:uucp "$f"
  chmod 600 "$f"
  echo "updated $f"
done
'
```

Notes:

- This deployment has used `/etc/hosts.hfaxd`.
- Some HylaFAX docs reference `/var/spool/hylafax/etc/hosts.hfaxd` or `/etc/hylafax/hosts.hfaxd`; those paths can vary by package/service setup.
- Check actual paths with `find /etc /var/spool -name hosts.hfaxd -print`.
- A bare pattern such as `^.*@172\.18\.0\.[0-9]+$` may still trigger password login on some setups. Prefer `client:::` entries.
- If `faxstat` prints `Password:` or `331 Password required`, the matching `hosts.hfaxd` entry is missing or not in the file `hfaxd` is reading.

Restart HylaFAX with systemd if the units exist:

```bash
sudo systemctl restart kaos-hylafax-daemons.service
```

If unit names are not available in the current shell, restart the two daemons directly:

```bash
sudo pkill -x hfaxd || true
sudo pkill -x faxq || true
sudo /usr/sbin/faxq
sudo /usr/sbin/hfaxd -i hylafax
```

Allow the Docker bridge through the host firewall if needed:

```bash
sudo iptables -I INPUT -i br-2bb15f6c7043 -p tcp --dport 4559 -j ACCEPT
```

The bridge name can change if the Docker network is recreated. Re-check it with:

```bash
ip link show | grep br-
docker network inspect kaos-stack_default
```

## Container Verification

After deploy, verify the backend can see `sendfax` and the configured fax host:

```bash
docker exec kaosgdd-backend sh -lc 'command -v sendfax; echo "$FAXSERVER"; echo "$FAX_SEND_TIMEOUT_SECONDS"'
```

Verify the backend container can reach HylaFAX:

```bash
docker exec kaosgdd-backend faxstat -h "$FAXSERVER"
```

If this times out:

- the app code path is working,
- but the backend container cannot reach host HylaFAX,
- check `/etc/hylafax/hosts.hfaxd`,
- check host firewall rules for the Docker bridge,
- check that `hfaxd` is listening on `0.0.0.0:4559`.

Check listener:

```bash
ss -tulpn | grep 4559
```

Check queue/progress:

```bash
faxstat -s
faxstat -d
```

If a job appears in `doneq` with `/undefinedfilename` from `docq/*.pdf.*`,
HylaFAX attempted host-side PDF conversion. Current KaosGdd backend builds
should submit `.tif` documents instead.

## Failure Behavior

The backend returns fax-specific failures instead of crashing:

- missing `sendfax` binary: `sendfax command not found`
- unreachable/hung HylaFAX submission: `sendfax command timed out`
- provider/send failure: the outgoing Fax record is marked `failed`

The selected file should remain selected on quick fax send failure so the user can fix the number or retry.

## Incoming Fax Hooks

Incoming fax hook details live in:

```text
ops/hylafax/README.md
```

Restore hooks after HylaFAX package updates:

```bash
sudo /srv/kaos-stack/kaosgdd/repo/ops/hylafax/install-kaosgdd-hylafax-hooks.sh
```

## Tests

Focused frontend checks:

```bash
node --test frontend/tests/capture-file-attach.test.js frontend/tests/fax-inbox-actions.test.js
```

Focused backend checks require pytest and the fax conversion/client packages:

```bash
python -m pytest backend/tests/test_fax_v0.py
```
