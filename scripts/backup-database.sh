#!/bin/bash
#
# MySQL Database Backup Script
# Backs up the GAds database with timestamp
# Keeps last 30 days of backups
#

# Load environment variables
cd /home/hub/public_html/gads
source .env

# Backup directory
BACKUP_DIR="/home/hub/public_html/gads/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/gads_backup_$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
echo "🔄 Starting database backup..."
echo "   Database: $DB_NAME"
echo "   Backup file: $BACKUP_FILE"

mysqldump \
  --host="$DB_HOST" \
  --port="${DB_PORT:-3306}" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup completed successfully"
  echo "   Size: $BACKUP_SIZE"
  echo "   Location: $BACKUP_FILE"
else
  echo "❌ Backup failed!"
  exit 1
fi

# Delete backups older than 30 days
echo ""
echo "🧹 Cleaning old backups (keeping last 30 days)..."
find "$BACKUP_DIR" -name "gads_backup_*.sql.gz" -type f -mtime +30 -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/gads_backup_*.sql.gz 2>/dev/null | wc -l)
echo "   Remaining backups: $REMAINING"

# Show disk usage
echo ""
echo "💾 Backup directory size:"
du -sh "$BACKUP_DIR"

echo ""
echo "✅ Backup process completed at $(date)"
