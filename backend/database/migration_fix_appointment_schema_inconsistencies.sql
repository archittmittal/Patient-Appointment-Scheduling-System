-- Fix for missing columns and status inconsistencies
USE hospital_system;

-- 1. Add missing column to doctors table
ALTER TABLE doctors ADD COLUMN avg_consultation_time INT DEFAULT 15 AFTER experience_years;

-- 2. Standardize all appointment statuses to lowercase
UPDATE appointments SET status = 'confirmed' WHERE status = 'CONFIRMED';
UPDATE appointments SET status = 'pending' WHERE status = 'PENDING';
UPDATE appointments SET status = 'scheduled' WHERE status = 'SCHEDULED';
UPDATE appointments SET status = 'completed' WHERE status = 'COMPLETED';
UPDATE appointments SET status = 'cancelled' WHERE status = 'CANCELLED';
UPDATE appointments SET status = 'no_show' WHERE status = 'NO_SHOW';
UPDATE appointments SET status = 'in_progress' WHERE status = 'IN_PROGRESS';

-- 3. Ensure ENUM is correct with lowercase values
ALTER TABLE appointments MODIFY COLUMN status ENUM('pending','scheduled','confirmed','checked_in','in_progress', 'completed', 'cancelled', 'no_show', 'late_arrival', 'needs_reschedule', 'waiting', 'missed') DEFAULT 'scheduled';

-- Note: Keeping some uppercase values in ENUM temporarily if they are used by live_queue 
-- but transitioning the main appointment statuses to lowercase.
