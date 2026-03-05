-- Issue #49: Appointment Batching Migration
-- Groups similar appointments for efficiency

-- Batch slots table (doctor creates batch slots)
CREATE TABLE IF NOT EXISTS batch_slots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    batch_type VARCHAR(50) NOT NULL COMMENT 'VACCINATION, ROUTINE_CHECKUP, FOLLOWUP, LAB_REVIEW, PRESCRIPTION_REFILL',
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    max_capacity INT NOT NULL DEFAULT 6,
    duration_mins INT NOT NULL DEFAULT 60,
    notes TEXT,
    status ENUM('open', 'full', 'in_progress', 'completed', 'cancelled') DEFAULT 'open',
    cancelled_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_date (doctor_id, slot_date),
    INDEX idx_batch_type (batch_type),
    INDEX idx_status (status)
);

-- Batch appointments table (patients booking into batch slots)
CREATE TABLE IF NOT EXISTS batch_appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_slot_id INT NOT NULL,
    patient_id INT NOT NULL,
    queue_position INT NOT NULL,
    reason TEXT,
    status ENUM('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no-show') DEFAULT 'scheduled',
    check_in_time TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_slot_id) REFERENCES batch_slots(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_patient_slot (batch_slot_id, patient_id),
    INDEX idx_patient_status (patient_id, status)
);

-- Batch type settings (for customization by clinic)
CREATE TABLE IF NOT EXISTS batch_type_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_type VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    default_capacity INT NOT NULL DEFAULT 6,
    slot_duration_mins INT NOT NULL DEFAULT 15,
    color VARCHAR(20) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default batch types
INSERT INTO batch_type_settings (batch_type, display_name, description, default_capacity, slot_duration_mins, color) VALUES
('VACCINATION', 'Vaccination', 'Routine immunizations and vaccines', 10, 15, '#10B981'),
('ROUTINE_CHECKUP', 'Routine Check-up', 'Regular health screenings', 6, 20, '#3B82F6'),
('FOLLOWUP', 'Follow-up Visit', 'Post-treatment follow-ups', 8, 10, '#8B5CF6'),
('LAB_REVIEW', 'Lab Results Review', 'Discuss test results', 8, 10, '#F59E0B'),
('PRESCRIPTION_REFILL', 'Prescription Refill', 'Medication refill consultations', 12, 5, '#EC4899')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- View for batch slot availability
CREATE OR REPLACE VIEW batch_slot_availability AS
SELECT 
    bs.id,
    bs.doctor_id,
    bs.batch_type,
    bs.slot_date,
    bs.start_time,
    bs.max_capacity,
    COUNT(ba.id) as booked_count,
    (bs.max_capacity - COUNT(ba.id)) as available_count,
    bs.status,
    CONCAT(d.first_name, ' ', d.last_name) as doctor_name
FROM batch_slots bs
LEFT JOIN batch_appointments ba ON bs.id = ba.batch_slot_id AND ba.status NOT IN ('cancelled', 'no-show')
JOIN doctors d ON bs.doctor_id = d.id
GROUP BY bs.id;
