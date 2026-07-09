# KaosGdd HylaFAX Hooks

Working receive chain:

incoming fax
→ HylaFAX receives TIFF
→ /var/spool/hylafax/bin/faxrcvd
→ /var/spool/hylafax/bin/kaosgdd-faxrcvd
→ /srv/kaos-stack/kaosgdd/repo/backend/scripts/hylafax_recv_hook.py
→ KaosGdd converts TIFF to PDF
→ Fax item created

## Important files

- /var/spool/hylafax/bin/faxrcvd
- /var/spool/hylafax/bin/kaosgdd-faxrcvd
- /srv/kaos-stack/kaosgdd/repo/backend/scripts/hylafax_recv_hook.py

For host/container send settings, outgoing `sendfax`, doneq status sync, and
verification commands, see:

- `docs/fax-settings.md`

## Restore after package update

Run:

    sudo /srv/kaos-stack/kaosgdd/repo/ops/hylafax/install-kaosgdd-hylafax-hooks.sh

## Logs

    sudo cat /tmp/kaosgdd-faxrcvd-auto.log
    sudo cat /tmp/kaosgdd-faxrcvd.log
    sudo journalctl -u faxgetty@ttyACM0.service -n 100 --no-pager
    sudo journalctl -u kaosgdd-backend.service -n 100 --no-pager

## Health check

    faxstat -s
    faxstat -d
    curl -s http://127.0.0.1:18000/fax | jq
