-- Migration for Issue #48: AI-Powered Consultation Duration Prediction
-- Run this after the main schema.sql

USE hospital_system;

-- 1. Add consultation timing columns to appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS consultation_start TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS consultation_end TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS actual_duration_mins INT NULL,
ADD COLUMN IF NOT EXISTS predicted_duration_mins INT DEFAULT 15,
ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT FALSE;

-- 2. Consultation History Table - stores completed consultation data for ML training
CREATE TABLE IF NOT EXISTS consultation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    appointment_id INT NOT NULL,
    symptoms_keywords TEXT,
    is_follow_up BOOLEAN DEFAULT FALSE,
    day_of_week TINYINT, -- 0=Sunday, 6=Saturday
    hour_of_day TINYINT, -- 0-23
    actual_duration_mins INT NOT NULL,
    specialty VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    INDEX idx_doctor_specialty (doctor_id, specialty),
    INDEX idx_symptoms (symptoms_keywords(100))
);

-- 3. Doctor Average Times Table - cached averages for quick lookup
CREATE TABLE IF NOT EXISTS doctor_avg_times (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL UNIQUE,
    avg_duration_mins DECIMAL(5,2) DEFAULT 15.00,
    avg_new_patient_mins DECIMAL(5,2) DEFAULT 20.00,
    avg_follow_up_mins DECIMAL(5,2) DEFAULT 10.00,
    total_consultations INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- 4. Symptom Complexity Keywords Table - maps symptoms to complexity scores
CREATE TABLE IF NOT EXISTS symptom_complexity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    complexity_score DECIMAL(3,2) DEFAULT 1.00, -- 0.5 = simple, 1.0 = normal, 2.0 = complex
    avg_extra_mins INT DEFAULT 0
);

-- Insert common symptom keywords with complexity scores
INSERT IGNORE INTO symptom_complexity (keyword, complexity_score, avg_extra_mins) VALUES
-- Simple/Quick symptoms (0.5-0.8)
('headache', 0.7, 0),
('cold', 0.6, 0),
('cough', 0.7, 0),
('fever', 0.7, 0),
('flu', 0.6, 0),
('runny nose', 0.5, 0),
('sore throat', 0.6, 0),
('allergies', 0.7, 0),
('rash', 0.8, 0),
('follow-up', 0.5, -3),
('checkup', 0.6, 0),
('routine', 0.5, -2),
-- Normal complexity (0.9-1.2)
('stomach', 0.9, 2),
('back pain', 1.0, 3),
('joint pain', 1.0, 3),
('fatigue', 1.0, 2),
('dizziness', 1.1, 3),
('nausea', 0.9, 2),
('vomiting', 1.0, 3),
('diarrhea', 0.9, 2),
('insomnia', 1.0, 3),
('anxiety', 1.2, 5),
-- Complex symptoms (1.3-2.0)
('chest pain', 1.8, 10),
('heart', 1.7, 8),
('breathing', 1.6, 7),
('shortness of breath', 1.8, 10),
('palpitations', 1.7, 8),
('blood pressure', 1.4, 5),
('diabetes', 1.5, 6),
('chronic', 1.5, 5),
('surgery', 1.8, 10),
('cancer', 2.0, 15),
('tumor', 2.0, 15),
('emergency', 1.9, 12),
('accident', 1.8, 10),
('injury', 1.4, 5),
('fracture', 1.6, 8),
('depression', 1.5, 8),
('mental', 1.4, 6),
('neurological', 1.7, 10),
('seizure', 1.8, 10);

-- 5. Initialize doctor_avg_times for existing doctors
INSERT IGNORE INTO doctor_avg_times (doctor_id, avg_duration_mins, total_consultations)
SELECT id, 15.00, 0 FROM doctors;

-- 6. Add estimated_duration to live_queue for better tracking
ALTER TABLE live_queue
ADD COLUMN IF NOT EXISTS predicted_duration INT DEFAULT 15;
