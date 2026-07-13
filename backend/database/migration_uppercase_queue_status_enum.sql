-- migration_cleanup_status_enum.sql
-- Expands the appointments.status ENUM to include CHECKED_IN and IN_PROGRESS
-- Required by: Multi-Doctor Journey (updateStopStatus), Live Queue (queue/:id/status endpoint)
-- Run once after deployment. Safe to re-run (MODIFY COLUMN is idempotent for ENUM expansion).

ALTER TABLE appointments 
MODIFY COLUMN status ENUM(
    'PENDING',
    'CONFIRMED',
    'SCHEDULED',
    'WAITING',
    'CHECKED_IN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'MISSED'
) DEFAULT 'PENDING';
