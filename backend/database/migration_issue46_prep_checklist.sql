-- Issue #46: Patient Prep Checklist Migration
-- Stores prep items and patient completion tracking

-- Custom prep items for appointments (doctor-defined)
CREATE TABLE IF NOT EXISTS appointment_prep_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    label VARCHAR(255) NOT NULL,
    priority ENUM('required', 'recommended', 'optional') DEFAULT 'recommended',
    icon VARCHAR(10) DEFAULT '📋',
    notes TEXT,
    display_order INT DEFAULT 99,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    INDEX idx_appointment (appointment_id)
);

-- Patient completion tracking
CREATE TABLE IF NOT EXISTS patient_prep_completion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    item_id VARCHAR(100) NOT NULL COMMENT 'Can be custom item ID or default item ID string',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_completion (appointment_id, patient_id, item_id),
    INDEX idx_patient_appointment (patient_id, appointment_id)
);

-- Specialty prep templates (for customization)
CREATE TABLE IF NOT EXISTS specialty_prep_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    specialty VARCHAR(100) NOT NULL,
    item_label VARCHAR(255) NOT NULL,
    priority ENUM('required', 'recommended', 'optional') DEFAULT 'recommended',
    icon VARCHAR(10) DEFAULT '📋',
    display_order INT DEFAULT 99,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_specialty (specialty)
);

-- Insert some default specialty templates
INSERT INTO specialty_prep_templates (specialty, item_label, priority, icon, display_order) VALUES
-- General
('General', 'Bring valid ID/Insurance card', 'required', '🪪', 1),
('General', 'Bring relevant medical records', 'recommended', '📋', 2),
('General', 'List of current medications', 'required', '💊', 3),
('General', 'Write down questions/concerns', 'recommended', '❓', 4),
-- Cardiology
('Cardiology', 'Fast for 12 hours before blood work', 'required', '🍽️', 1),
('Cardiology', 'Take blood pressure reading at home', 'recommended', '❤️', 2),
('Cardiology', 'Wear comfortable, loose clothing', 'recommended', '👕', 3),
-- Lab Work
('Lab Work', 'Fast for 8-12 hours (water allowed)', 'required', '🍽️', 1),
('Lab Work', 'Stay hydrated before blood draw', 'required', '💧', 2),
('Lab Work', 'Wear short sleeves or loose top', 'recommended', '👕', 3)
ON DUPLICATE KEY UPDATE item_label = VALUES(item_label);

-- Prep reminder log
CREATE TABLE IF NOT EXISTS prep_reminder_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    channel ENUM('app', 'email', 'sms') DEFAULT 'app',
    items_pending INT DEFAULT 0,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    INDEX idx_appointment_patient (appointment_id, patient_id)
);
