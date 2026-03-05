-- Issue #47: Late Arrival Handling Migration
-- Run this to set up the Late Arrival tables

-- Doctor late arrival policies table
CREATE TABLE IF NOT EXISTS doctor_late_policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    grace_period_mins INT DEFAULT 10 COMMENT 'Minutes before considered late',
    max_late_mins INT DEFAULT 30 COMMENT 'Max minutes to accommodate',
    auto_reschedule_after_mins INT DEFAULT 45 COMMENT 'Auto reschedule after these mins',
    allow_fit_in BOOLEAN DEFAULT TRUE COMMENT 'Allow fitting in between appointments',
    require_notification BOOLEAN DEFAULT TRUE COMMENT 'Require advance late notification',
    late_arrivals_per_day INT DEFAULT 2 COMMENT 'Max late arrivals to accept per day',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_doctor_policy (doctor_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Late arrival log for analytics
CREATE TABLE IF NOT EXISTS late_arrival_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    minutes_late INT NOT NULL,
    handling_choice ENUM('proceed', 'fit_in', 'end_of_session', 'reschedule') NOT NULL,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_appointment (appointment_id),
    INDEX idx_patient (patient_id),
    INDEX idx_logged_at (logged_at),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Add columns to appointments table for late arrival tracking
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS late_arrival_mins INT DEFAULT 0 COMMENT 'Minutes patient was late',
ADD COLUMN IF NOT EXISTS late_handling ENUM('none', 'fit_in', 'end_of_session', 'reschedule') DEFAULT 'none' COMMENT 'How late arrival was handled',
ADD COLUMN IF NOT EXISTS rescheduled_time TIME NULL COMMENT 'New time if moved to end of session',
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL COMMENT 'When patient checked in',
ADD INDEX IF NOT EXISTS idx_late_arrival (late_arrival_mins);

-- Update appointments status enum to include late arrival states
-- Note: If this fails, you may need to modify the column manually
ALTER TABLE appointments 
MODIFY COLUMN status ENUM(
    'scheduled', 
    'confirmed', 
    'checked_in', 
    'in_progress', 
    'completed', 
    'cancelled', 
    'no_show',
    'late_arrival',
    'needs_reschedule'
) DEFAULT 'scheduled';

-- Insert default policies for existing doctors
INSERT IGNORE INTO doctor_late_policies (doctor_id, grace_period_mins, max_late_mins, auto_reschedule_after_mins)
SELECT id, 10, 30, 45 FROM doctors;
