-- Issue #42: Walk-in Priority System Migration
-- Adds walk-in patient support with urgency-based prioritization

-- Add walk-in specific columns to appointments
ALTER TABLE appointments
ADD COLUMN is_walkin BOOLEAN DEFAULT FALSE,
ADD COLUMN walkin_urgency ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY') DEFAULT 'NORMAL',
ADD COLUMN walkin_reason TEXT,
ADD COLUMN walkin_symptoms TEXT,
ADD COLUMN vital_signs JSON,
ADD COLUMN triage_score INT DEFAULT 50,
ADD COLUMN walkin_registered_at DATETIME NULL,
ADD COLUMN estimated_slot_time TIME NULL;

-- Create walk-in queue table for better tracking
CREATE TABLE IF NOT EXISTS walkin_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NULL,
    specialty_id INT NULL,
    urgency_level ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY') DEFAULT 'NORMAL',
    reason TEXT,
    symptoms TEXT,
    vital_signs JSON,
    triage_score INT DEFAULT 50,
    queue_position INT,
    status ENUM('WAITING', 'ASSIGNED', 'IN_CONSULTATION', 'COMPLETED', 'LEFT') DEFAULT 'WAITING',
    assigned_appointment_id INT NULL,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME NULL,
    completed_at DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    INDEX idx_walkin_status (status),
    INDEX idx_walkin_urgency (urgency_level),
    INDEX idx_walkin_triage (triage_score DESC)
);

-- Create urgency factor config table
CREATE TABLE IF NOT EXISTS urgency_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    urgency_level VARCHAR(20) NOT NULL UNIQUE,
    priority_weight INT NOT NULL DEFAULT 1,
    max_wait_minutes INT NOT NULL DEFAULT 60,
    auto_escalate_minutes INT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default urgency configurations
INSERT INTO urgency_config (urgency_level, priority_weight, max_wait_minutes, auto_escalate_minutes, description) VALUES
('LOW', 1, 120, NULL, 'Minor issues, can wait longer'),
('NORMAL', 2, 60, 90, 'Standard walk-in, typical wait time'),
('HIGH', 3, 30, 45, 'Priority case, shorter wait expected'),
('URGENT', 5, 15, 20, 'Urgent case, immediate attention needed'),
('EMERGENCY', 10, 5, 10, 'Emergency - immediate care required');
