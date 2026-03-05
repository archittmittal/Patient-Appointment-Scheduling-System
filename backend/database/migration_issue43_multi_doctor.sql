-- Issue #43: Multi-Doctor Routing Migration
-- Handles appointments requiring multiple specialists

-- Multi-doctor journeys table (parent record)
CREATE TABLE IF NOT EXISTS multi_doctor_journeys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    total_stops INT NOT NULL DEFAULT 2,
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    scheduled_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_patient_status (patient_id, status),
    INDEX idx_date (scheduled_date)
);

-- Journey stops table (individual doctor visits in a journey)
CREATE TABLE IF NOT EXISTS journey_stops (
    id INT PRIMARY KEY AUTO_INCREMENT,
    journey_id INT NOT NULL,
    doctor_id INT NOT NULL,
    stop_order INT NOT NULL,
    reason VARCHAR(255),
    status ENUM('pending', 'checked_in', 'in_progress', 'completed', 'skipped') DEFAULT 'pending',
    estimated_duration_mins INT DEFAULT 20,
    actual_duration_mins INT,
    notes TEXT,
    checked_in_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (journey_id) REFERENCES multi_doctor_journeys(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    UNIQUE KEY unique_journey_order (journey_id, stop_order),
    INDEX idx_journey (journey_id),
    INDEX idx_doctor_status (doctor_id, status)
);

-- Add location fields to doctor_profiles if not exists
ALTER TABLE doctor_profiles 
ADD COLUMN IF NOT EXISTS floor_number INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS building VARCHAR(50) DEFAULT 'A',
ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

-- Journey route templates (common multi-doctor paths)
CREATE TABLE IF NOT EXISTS journey_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    symptom_keywords TEXT COMMENT 'Comma-separated keywords for matching',
    specialties TEXT NOT NULL COMMENT 'Comma-separated specialties in order',
    estimated_total_mins INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some common journey templates
INSERT INTO journey_templates (name, description, symptom_keywords, specialties, estimated_total_mins) VALUES
('Cardiac Workup', 'Full cardiac evaluation path', 'chest pain,heart,palpitation', 'Cardiology,Pulmonology', 60),
('Headache Evaluation', 'Comprehensive headache assessment', 'headache,migraine,vision', 'Neurology,Ophthalmology', 50),
('Joint Pain Assessment', 'Musculoskeletal evaluation', 'joint,back,spine,arthritis', 'Orthopedics,Rheumatology', 45),
('Digestive Workup', 'GI system evaluation', 'stomach,digestive,nausea', 'Gastroenterology,Nutrition', 40),
('Allergy Workup', 'Comprehensive allergy testing', 'allergy,rash,hives,itching', 'Dermatology,Allergy', 45)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Journey notifications log
CREATE TABLE IF NOT EXISTS journey_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    journey_id INT NOT NULL,
    stop_id INT,
    notification_type ENUM('journey_start', 'next_stop', 'delay', 'completed') NOT NULL,
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journey_id) REFERENCES multi_doctor_journeys(id) ON DELETE CASCADE,
    INDEX idx_journey (journey_id)
);

-- View for journey progress
CREATE OR REPLACE VIEW journey_progress AS
SELECT 
    j.id as journey_id,
    j.patient_id,
    j.status as journey_status,
    j.total_stops,
    COUNT(CASE WHEN js.status = 'completed' THEN 1 END) as completed_stops,
    COUNT(CASE WHEN js.status = 'in_progress' THEN 1 END) as current_stops,
    MIN(CASE WHEN js.status IN ('pending', 'in_progress') THEN js.stop_order END) as next_stop_order,
    SUM(js.estimated_duration_mins) as total_estimated_mins,
    SUM(CASE WHEN js.status = 'completed' THEN js.actual_duration_mins ELSE 0 END) as completed_mins
FROM multi_doctor_journeys j
LEFT JOIN journey_stops js ON j.id = js.journey_id
GROUP BY j.id;
