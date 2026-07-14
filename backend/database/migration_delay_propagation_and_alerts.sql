-- Migration for Issue #40: Doctor Delay Propagation
-- Run this after the main schema.sql

USE hospital_system;

-- 1. Delay History Table - tracks all delays for analytics
CREATE TABLE IF NOT EXISTS delay_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    delay_date DATE NOT NULL,
    delay_mins INT NOT NULL DEFAULT 0,
    reason VARCHAR(255),
    is_manual BOOLEAN DEFAULT FALSE,
    affected_patients INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_date (doctor_id, delay_date),
    INDEX idx_delay_date (delay_date)
);

-- 2. Add delay notification tracking to live_queue
ALTER TABLE live_queue
ADD COLUMN IF NOT EXISTS delay_notified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_eta_update TIMESTAMP NULL;

-- 3. Notification Log Table - track all notifications sent
CREATE TABLE IF NOT EXISTS notification_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    appointment_id INT,
    notification_type ENUM('DELAY', 'REMINDER', 'QUEUE_UPDATE', 'TURN_APPROACHING', 'CANCELLED') NOT NULL,
    channel ENUM('SMS', 'EMAIL', 'PUSH', 'IN_APP') NOT NULL,
    message TEXT,
    status ENUM('PENDING', 'SENT', 'FAILED', 'DELIVERED') DEFAULT 'PENDING',
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    INDEX idx_patient (patient_id),
    INDEX idx_type_status (notification_type, status)
);
