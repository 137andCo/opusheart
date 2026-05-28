#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/opusheart_$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

echo "Starting OpusHeart backup..."

# MongoDB dump
mongodump --uri="${MONGO_URI:-mongodb://localhost:27017/opusheart}" --out="$BACKUP_PATH/mongo"
echo "MongoDB dump complete."

# Compress
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "opusheart_$TIMESTAMP"
rm -rf "$BACKUP_PATH"
echo "Compressed to $BACKUP_PATH.tar.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "opusheart_*.tar.gz" -mtime "+$RETENTION_DAYS" -delete
echo "Cleaned up backups older than $RETENTION_DAYS days."

echo "Backup complete: $BACKUP_PATH.tar.gz"
