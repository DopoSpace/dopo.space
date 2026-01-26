#!/bin/bash
#
# Setup backup cron job (every 6 hours)
# Run this script once on the server to configure automated backups
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
LOG_FILE="/var/log/dopo-backup.log"

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Create log file
touch "$LOG_FILE"

# Add cron job (every 6 hours)
CRON_JOB="0 */6 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "dopo-backup\|backup.sh"; then
    echo "Backup cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -v "dopo-backup\|backup.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Backup cron job installed successfully!"
echo "Schedule: Every 6 hours (0:00, 6:00, 12:00, 18:00)"
echo "Log file: $LOG_FILE"
echo ""
echo "To test the backup manually, run:"
echo "  $BACKUP_SCRIPT"
echo ""
echo "To check cron jobs:"
echo "  crontab -l"
