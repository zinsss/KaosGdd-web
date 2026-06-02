#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/srv/KaosGdd-web"
BACKUP_ROOT="/backup/kaosgdd"
ARCHIVE_DIR="$BACKUP_ROOT/archives"
STAGING_DIR="$BACKUP_ROOT/staging"
LOG_DIR="$BACKUP_ROOT/logs"
RETENTION_DAYS="${KAOSGDD_BACKUP_RETENTION_DAYS:-30}"

TS="$(date +%Y%m%d-%H%M%S)"
WORK="$STAGING_DIR/kaosgdd-$TS"
ARCHIVE="$ARCHIVE_DIR/kaosgdd-$TS.tar.gz"
LOG_FILE="$LOG_DIR/kaosgdd-backup-$TS.log"

mkdir -p "$ARCHIVE_DIR" "$STAGING_DIR" "$LOG_DIR" "$WORK"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "== KaosGdd backup started: $(date -Is) =="
echo "Backup root: $BACKUP_ROOT"
echo "Work dir: $WORK"

if ! mountpoint -q /backup; then
  echo "ERROR: /backup is not mounted. Refusing to continue."
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 not installed. Install with: sudo apt install -y sqlite3"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "ERROR: rsync not installed. Install with: sudo apt install -y rsync"
  exit 1
fi

mkdir -p "$WORK/databases" "$WORK/config" "$WORK/uploads" "$WORK/hylafax" "$WORK/systemd" "$WORK/repo-state"

echo
echo "== System info =="
{
  echo "timestamp=$(date -Is)"
  echo "hostname=$(hostname)"
  echo
  echo "[lsblk]"
  lsblk -o NAME,SIZE,FSTYPE,LABEL,UUID,MOUNTPOINTS || true
  echo
  echo "[df]"
  df -hT / /srv /backup || true
  echo
  echo "[mdstat]"
  cat /proc/mdstat || true
} > "$WORK/system-info.txt"

echo
echo "== Backing up SQLite databases safely =="
DB_LIST="$WORK/databases/database-list.txt"
: > "$DB_LIST"

find "$APP_ROOT" /data \
  -type f \( -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" \) \
  -not -path "$BACKUP_ROOT/*" \
  2>/dev/null | sort -u > "$DB_LIST" || true

if [ ! -s "$DB_LIST" ]; then
  echo "WARNING: no SQLite database files found under $APP_ROOT or /data"
else
  while IFS= read -r db; do
    safe_name="$(echo "$db" | sed 's#^/##; s#[/:]#_#g')"
    out="$WORK/databases/${safe_name}.backup"
    echo "SQLite backup: $db -> $out"
    sqlite3 "$db" ".backup '$out'"
  done < "$DB_LIST"
fi

echo
echo "== Backing up uploads =="
if [ -d /data/uploads ]; then
  rsync -aH --delete /data/uploads/ "$WORK/uploads/data_uploads/"
else
  echo "No /data/uploads directory found."
fi

echo
echo "== Backing up KaosGdd env/config/ops =="
for p in \
  "$APP_ROOT/.env" \
  "$APP_ROOT/backend/.env" \
  "$APP_ROOT/frontend/.env" \
  "$APP_ROOT/frontend/.env.local" \
  "$APP_ROOT/ops"
do
  if [ -e "$p" ]; then
    echo "Copying $p"
    rsync -aR "$p" "$WORK/config/"
  fi
done

echo
echo "== Backing up HylaFAX hooks/config =="
for p in \
  /var/spool/hylafax/bin/faxrcvd \
  /var/spool/hylafax/bin/kaosgdd-faxrcvd \
  /srv/KaosGdd-web/backend/scripts/hylafax_recv_hook.py \
  /var/spool/hylafax/etc/config \
  /var/spool/hylafax/etc/config.ttyACM0 \
  /var/spool/hylafax/etc/FaxDispatch
do
  if [ -e "$p" ]; then
    echo "Copying $p"
    rsync -aR "$p" "$WORK/hylafax/"
  fi
done

echo
echo "== Backing up systemd units =="
for p in \
  /etc/systemd/system/kaosgdd-backend.service \
  /etc/systemd/system/kaosgdd-frontend.service \
  /etc/systemd/system/hylafax-core.service \
  /etc/systemd/system/faxgetty@ttyACM0.service \
  /etc/systemd/system/kaosgdd-backup.service \
  /etc/systemd/system/kaosgdd-backup.timer
do
  if [ -e "$p" ]; then
    echo "Copying $p"
    rsync -aR "$p" "$WORK/systemd/"
  fi
done

echo
echo "== Saving repo state =="
if [ -d "$APP_ROOT/.git" ]; then
  git -C "$APP_ROOT" status --short > "$WORK/repo-state/git-status.txt" || true
  git -C "$APP_ROOT" rev-parse HEAD > "$WORK/repo-state/git-head.txt" || true
  git -C "$APP_ROOT" branch --show-current > "$WORK/repo-state/git-branch.txt" || true
fi

echo
echo "== Creating archive =="
tar -C "$STAGING_DIR" -czf "$ARCHIVE" "kaosgdd-$TS"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"

echo
echo "== Cleaning staging =="
rm -rf "$WORK"

echo
echo "== Applying retention: ${RETENTION_DAYS} days =="
find "$ARCHIVE_DIR" -type f -name "kaosgdd-*.tar.gz" -mtime +"$RETENTION_DAYS" -delete
find "$ARCHIVE_DIR" -type f -name "kaosgdd-*.tar.gz.sha256" -mtime +"$RETENTION_DAYS" -delete
find "$LOG_DIR" -type f -name "kaosgdd-backup-*.log" -mtime +"$RETENTION_DAYS" -delete

echo
echo "== Backup complete =="
echo "Archive: $ARCHIVE"
echo "Checksum: $ARCHIVE.sha256"
ls -lh "$ARCHIVE" "$ARCHIVE.sha256"
echo "Finished: $(date -Is)"
