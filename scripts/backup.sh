#!/usr/bin/env bash
# Šifrovaná záloha SQLite (PLAN.md 7.5). GPG AES-256 symetricky.
#
# Použití (cron na serveru, např. denně):
#   BACKUP_ENCRYPTION_KEY=... DB_PATH=/var/lib/docker/volumes/notion-todo-app_sqlite-data/_data/app.sqlite \
#   ./scripts/backup.sh
#
# Vyžaduje: sqlite3, gpg, tar. DB_PATH = cesta k app.sqlite (mountpoint named
# volume zjistíš `docker volume inspect <projekt>_sqlite-data`).
set -euo pipefail

: "${BACKUP_ENCRYPTION_KEY:?Nastav BACKUP_ENCRYPTION_KEY}"
DB_PATH="${DB_PATH:?Nastav DB_PATH (cesta k app.sqlite)}"
DEST="${BACKUP_DEST:-/opt/backups}"
KEEP="${BACKUP_KEEP:-14}"

STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$DEST"

# Konzistentní online snapshot (zahrne i WAL), nezamyká DB nadlouho.
sqlite3 "$DB_PATH" ".backup '$WORK/app.sqlite'"
tar -czf "$WORK/backup.tar.gz" -C "$WORK" app.sqlite

gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase "$BACKUP_ENCRYPTION_KEY" \
  -o "$DEST/nta-backup-$STAMP.tar.gz.gpg" "$WORK/backup.tar.gz"

# Rotace – ponech posledních $KEEP.
ls -1t "$DEST"/nta-backup-*.tar.gz.gpg 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "✅ Záloha: $DEST/nta-backup-$STAMP.tar.gz.gpg"
# Obnova:
#   gpg --batch --passphrase "$KEY" -d nta-backup-XXXX.tar.gz.gpg | tar -xzO > app.sqlite
