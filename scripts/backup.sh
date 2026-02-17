#!/bin/bash

# Configuration
CONTAINER_NAME="restaurante-db"
DB_USER="postgres"
DB_NAME="restaurante_db"
BACKUP_DIR="/var/backups/restaurante"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="backup_$DATE.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
echo "Starting backup for $DB_NAME..."
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/$FILENAME"

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "✅ Backup successful: $BACKUP_DIR/$FILENAME"
  
  # Optional: Compress
  gzip "$BACKUP_DIR/$FILENAME"
  echo "📦 Compressed: $BACKUP_DIR/$FILENAME.gz"
  
  # Optional: Delete backups older than 7 days
  find $BACKUP_DIR -type f -name "*.gz" -mtime +7 -delete
  echo "🧹 Cleaned up old backups."
else
  echo "❌ Backup failed!"
  exit 1
fi
