-- Issue #39: Virtual Waiting Room Migration
-- Adds virtual check-in functionality for remote queue joining

-- Add virtual check-in columns to appointments table
ALTER TABLE appointments
ADD COLUMN virtual_checkin_time DATETIME NULL DEFAULT NULL,
ADD COLUMN virtual_checkin_status ENUM('NOT_CHECKED_IN', 'CHECKED_IN', 'EN_ROUTE', 'ARRIVED') DEFAULT 'NOT_CHECKED_IN',
ADD COLUMN patient_eta_minutes INT NULL DEFAULT NULL,
ADD COLUMN patient_location_lat DECIMAL(10, 8) NULL DEFAULT NULL,
ADD COLUMN patient_location_lng DECIMAL(11, 8) NULL DEFAULT NULL,
ADD COLUMN checkin_device VARCHAR(100) NULL DEFAULT NULL;

-- Create table for virtual waiting room sessions
CREATE TABLE IF NOT EXISTS virtual_waiting_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_end DATETIME NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',
    last_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
    estimated_call_time DATETIME NULL,
    actual_call_time DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_status (status),
    INDEX idx_session_appointment (appointment_id),
    INDEX idx_session_patient (patient_id)
);

-- Create table for check-in notifications to clinic
CREATE TABLE IF NOT EXISTS checkin_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    notification_type ENUM('VIRTUAL_CHECKIN', 'EN_ROUTE', 'ARRIVED', 'RUNNING_LATE', 'CANCELLED') NOT NULL,
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by INT NULL,
    acknowledged_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_notification_appointment (appointment_id),
    INDEX idx_notification_acknowledged (acknowledged)
);
