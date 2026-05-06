#!/bin/bash
export MYSQL_PWD=${DB_PASSWORD:-"Archit@123"}
DB_USER=${DB_USER:-"root"}
DB_NAME="hospital_system"

echo "Running migrations for $DB_NAME..."

MIGRATIONS=(
    "schema.sql"
    "migration_issue38_notifications.sql"
    "migration_issue39_virtual_checkin.sql"
    "migration_issue40_delay_propagation.sql"
    "migration_issue41_noshow_autofill.sql"
    "migration_issue42_walkin_priority.sql"
    "migration_fix_profiles.sql"
    "migration_issue43_multi_doctor.sql"
    "migration_issue45_express_checkin.sql"
    "migration_issue46_prep_checklist.sql"
    "migration_issue47_late_arrival.sql"
    "migration_issue48_duration_prediction.sql"
    "migration_issue49_batching.sql"
    "migration_issue50_feedback_analytics.sql"
    "fix_appointment_issues.sql"
)

# Create database if not exists
mysql -u "$DB_USER" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
for m in "${MIGRATIONS[@]}"; do
    echo "Applying $m..."
    mysql -u "$DB_USER" "$DB_NAME" < "$SCRIPT_DIR/database/$m" || echo "Error applying $m"
done

echo "Migrations complete."
