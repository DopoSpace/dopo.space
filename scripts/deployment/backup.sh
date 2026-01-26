#!/bin/bash
#
# Dopo Space Backup Script
# Backs up PostgreSQL database to S3-compatible storage (Cloudflare R2, Hetzner Object Storage, etc.)
#
# Prerequisites:
# 1. Install rclone: curl https://rclone.org/install.sh | bash
# 2. Configure rclone: rclone config (create remote named 'r2' or 's3')
#
# Usage:
# ./backup.sh                    # Run backup
# ./backup.sh --restore latest   # Restore latest backup
# ./backup.sh --list             # List available backups
#
# Crontab (every 6 hours):
# 0 */6 * * * /root/backup.sh >> /var/log/dopo-backup.log 2>&1

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/dopo-backups}"
S3_REMOTE="${S3_REMOTE:-r2:dopo-space-backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-dopo_space}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

backup_database() {
    log_info "Starting database backup..."

    BACKUP_FILE="$BACKUP_DIR/db_${DATE}.sql.gz"

    # Dump database via Docker
    if docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"; then
        log_info "Database dumped successfully: $BACKUP_FILE"

        # Get file size
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Backup size: $SIZE"
    else
        log_error "Failed to dump database"
        exit 1
    fi

    # Upload to S3
    log_info "Uploading to remote storage..."
    if rclone copy "$BACKUP_FILE" "$S3_REMOTE/"; then
        log_info "Uploaded successfully to $S3_REMOTE"
    else
        log_error "Failed to upload to remote storage"
        exit 1
    fi

    # Cleanup local backups (keep last 2)
    log_info "Cleaning up local backups..."
    ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +3 | xargs -r rm -f

    # Cleanup remote backups (older than retention period)
    log_info "Cleaning up remote backups older than ${RETENTION_DAYS} days..."
    rclone delete "$S3_REMOTE" --min-age "${RETENTION_DAYS}d" || true

    log_info "Backup completed successfully!"
}

list_backups() {
    log_info "Available backups in remote storage:"
    rclone ls "$S3_REMOTE" | sort -k2 -r
}

restore_backup() {
    local BACKUP_NAME="$1"

    if [[ "$BACKUP_NAME" == "latest" ]]; then
        log_info "Finding latest backup..."
        BACKUP_NAME=$(rclone ls "$S3_REMOTE" | sort -k2 -r | head -1 | awk '{print $2}')
        if [[ -z "$BACKUP_NAME" ]]; then
            log_error "No backups found"
            exit 1
        fi
        log_info "Latest backup: $BACKUP_NAME"
    fi

    RESTORE_FILE="$BACKUP_DIR/restore_$BACKUP_NAME"

    log_warn "This will restore the database from: $BACKUP_NAME"
    log_warn "Current data will be OVERWRITTEN!"
    read -p "Are you sure? (yes/no): " CONFIRM

    if [[ "$CONFIRM" != "yes" ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    # Download backup
    log_info "Downloading backup..."
    rclone copy "$S3_REMOTE/$BACKUP_NAME" "$BACKUP_DIR/"

    # Restore database
    log_info "Restoring database..."
    gunzip -c "$BACKUP_DIR/$BACKUP_NAME" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

    # Cleanup
    rm -f "$BACKUP_DIR/$BACKUP_NAME"

    log_info "Restore completed successfully!"
}

show_help() {
    echo "Dopo Space Backup Script"
    echo ""
    echo "Usage:"
    echo "  ./backup.sh                    Run backup"
    echo "  ./backup.sh --restore latest   Restore latest backup"
    echo "  ./backup.sh --restore <name>   Restore specific backup"
    echo "  ./backup.sh --list             List available backups"
    echo "  ./backup.sh --help             Show this help"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_DIR          Local backup directory (default: /tmp/dopo-backups)"
    echo "  S3_REMOTE           rclone remote path (default: r2:dopo-space-backups)"
    echo "  POSTGRES_CONTAINER  Docker container name (default: postgres)"
    echo "  POSTGRES_USER       PostgreSQL user (default: postgres)"
    echo "  POSTGRES_DB         Database name (default: dopo_space)"
    echo "  RETENTION_DAYS      Days to keep backups (default: 7)"
}

# Main
case "${1:-}" in
    --list)
        list_backups
        ;;
    --restore)
        if [[ -z "${2:-}" ]]; then
            log_error "Please specify backup name or 'latest'"
            exit 1
        fi
        restore_backup "$2"
        ;;
    --help|-h)
        show_help
        ;;
    *)
        backup_database
        ;;
esac
