-- Issue #41: No-Show Auto-Fill Waitlist System
-- This migration creates tables for managing dynamic waitlist when cancellations/no-shows occur

-- Waitlist table for patients wanting earlier slots
CREATE TABLE IF NOT EXISTS waitlist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    preferred_date DATE NOT NULL,
    time_preference ENUM('MORNING', 'AFTERNOON', 'EVENING', 'ANY') DEFAULT 'ANY',
    max_notice_hours INT DEFAULT 24, -- minimum hours notice patient needs
    status ENUM('ACTIVE', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED') DEFAULT 'ACTIVE',
    reason TEXT, -- optional: why patient wants earlier slot
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- auto-expire after preferred_date passes
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_waitlist_doctor_date (doctor_id, preferred_date, status),
    INDEX idx_waitlist_patient (patient_id, status)
);

-- Slot offers tracking - when a slot becomes available
CREATE TABLE IF NOT EXISTS slot_offers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    waitlist_id INT NOT NULL,
    original_appointment_id INT, -- the cancelled/no-show appointment
    offered_date DATE NOT NULL,
    offered_time TIME NOT NULL,
    offer_status ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED') DEFAULT 'PENDING',
    offered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    expires_at TIMESTAMP NOT NULL, -- offer expires if not accepted in time
    new_appointment_id INT NULL, -- if accepted, the new appointment created
    FOREIGN KEY (waitlist_id) REFERENCES waitlist(id) ON DELETE CASCADE,
    INDEX idx_slot_offers_status (offer_status, expires_at)
);

-- Auto-fill settings per doctor
CREATE TABLE IF NOT EXISTS autofill_settings (
    doctor_id INT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    offer_window_mins INT DEFAULT 30, -- how long offer is valid
    min_notice_hours INT DEFAULT 2, -- minimum hours before appointment to auto-fill
    max_offers_per_slot INT DEFAULT 3, -- max patients to offer single slot to
    priority_mode ENUM('FIFO', 'URGENCY', 'LONGEST_WAIT') DEFAULT 'FIFO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Cancellation/No-show log for analytics
CREATE TABLE IF NOT EXISTS slot_release_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    doctor_id INT NOT NULL,
    release_type ENUM('CANCELLATION', 'NO_SHOW', 'RESCHEDULED') NOT NULL,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    auto_fill_attempted BOOLEAN DEFAULT FALSE,
    auto_fill_successful BOOLEAN DEFAULT FALSE,
    filled_by_patient_id INT NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_release_log_doctor (doctor_id, slot_date)
);

-- Initial settings for existing doctors
INSERT IGNORE INTO autofill_settings (doctor_id, enabled)
SELECT id, TRUE FROM doctors;
