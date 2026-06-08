-- Migration for Sprint 11: Departments Management System

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert existing doctor specialties as departments
INSERT IGNORE INTO departments (name, description)
SELECT DISTINCT specialty, CONCAT(specialty, ' Department')
FROM doctors
WHERE specialty IS NOT NULL AND specialty != '';

-- Also insert some default departments to populate the system
INSERT IGNORE INTO departments (name, description) VALUES
('Cardiologist', 'Specialized care for heart and vascular conditions.'),
('General Physician', 'Primary care, general health wellness, and routine checkups.'),
('Dermatologist', 'Treatment for skin, hair, and nail disorders.'),
('Neurologist', 'Specialized diagnostics and care for neurological disorders.'),
('Pediatrician', 'Comprehensive medical care for infants, children, and adolescents.');

-- Database self-healing: Clean up any orphaned records before applying constraints
DELETE FROM doctors WHERE id NOT IN (SELECT id FROM users);
DELETE FROM patients WHERE id NOT IN (SELECT id FROM users);
DELETE FROM appointments WHERE doctor_id NOT IN (SELECT id FROM users) OR patient_id NOT IN (SELECT id FROM users);

-- Add foreign key constraint to doctors table
ALTER TABLE doctors
ADD CONSTRAINT fk_doctors_specialty
FOREIGN KEY (specialty) REFERENCES departments(name)
ON UPDATE CASCADE;
