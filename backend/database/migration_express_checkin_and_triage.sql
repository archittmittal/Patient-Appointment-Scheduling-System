-- Issue #45: Express Check-in Migration
-- Adds support for QR-based and one-tap check-in

-- Add check-in tracking columns to appointments
ALTER TABLE appointments
ADD COLUMN checked_in_at DATETIME NULL,
ADD COLUMN checkin_method ENUM('STANDARD', 'EXPRESS', 'ONE_TAP', 'QR_CODE', 'KIOSK') DEFAULT 'STANDARD';

-- Create tokens table for QR code check-in
CREATE TABLE IF NOT EXISTS checkin_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL UNIQUE,
    patient_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
);

-- Create express check-in preferences
CREATE TABLE IF NOT EXISTS express_checkin_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL UNIQUE,
    enable_one_tap BOOLEAN DEFAULT TRUE,
    enable_qr_checkin BOOLEAN DEFAULT TRUE,
    auto_checkin_radius_meters INT DEFAULT 100,
    preferred_notification_before_mins INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
);
