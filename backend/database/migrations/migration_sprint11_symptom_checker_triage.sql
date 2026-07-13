-- Migration for Issue #69: AI-Powered Symptom Checker & Specialty Guidance

CREATE TABLE IF NOT EXISTS symptom_checker_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NULL,
    symptoms_text TEXT NOT NULL,
    mapped_specialty VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE INDEX idx_symptom_checker_mapped_specialty ON symptom_checker_logs (mapped_specialty);
CREATE INDEX idx_symptom_checker_created_at ON symptom_checker_logs (created_at);
CREATE INDEX idx_symptom_checker_specialty_created_at ON symptom_checker_logs (mapped_specialty, created_at);
