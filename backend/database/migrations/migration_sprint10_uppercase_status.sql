-- Migration: Sprint 10 Uppercase Status Standardization
USE hospital_system;

-- 1. Temporarily allow any string to avoid ENUM constraint errors during conversion
ALTER TABLE appointments MODIFY COLUMN status VARCHAR(50);

-- 2. Convert all existing status values to uppercase
UPDATE appointments SET status = UPPER(status) WHERE status IS NOT NULL;

-- 3. Restore status column as an UPPERCASE ENUM
ALTER TABLE appointments MODIFY COLUMN status ENUM(
    'PENDING',
    'SCHEDULED',
    'CONFIRMED',
    'CHECKED_IN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'LATE_ARRIVAL',
    'NEEDS_RESCHEDULE',
    'WAITING',
    'MISSED'
) DEFAULT 'SCHEDULED';
