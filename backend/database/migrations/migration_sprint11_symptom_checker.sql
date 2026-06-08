-- Migration for Issue #69: AI-Powered Symptom Checker & Specialty Guidance
USE hospital_system;

CREATE TABLE IF NOT EXISTS symptom_checker_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NULL,
    symptoms_text TEXT NOT NULL,
    mapped_specialty VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);
