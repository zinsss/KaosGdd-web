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
