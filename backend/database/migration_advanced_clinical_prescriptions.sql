-- Issue #94: Digital Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    appointment_id INT DEFAULT NULL,
    medications TEXT NOT NULL,
    instructions TEXT,
    date_prescribed DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Issue #95: Health Vitals Tracking
CREATE TABLE IF NOT EXISTS patient_vitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    blood_pressure_sys INT,
    blood_pressure_dia INT,
    heart_rate INT,
    temperature_c DECIMAL(4,1),
    recorded_by INT DEFAULT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Issue #144: Add columns to existing tables (idempotent for upgrades)
-- ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS appointment_id INT DEFAULT NULL;
-- ALTER TABLE patient_vitals ADD COLUMN IF NOT EXISTS recorded_by INT DEFAULT NULL;

-- Add some seed data for testing
INSERT INTO prescriptions (doctor_id, patient_id, medications, instructions, date_prescribed)
SELECT d.id, p.id, 'Amoxicillin 500mg (3x daily)', 'Take after meals for 7 days', NOW()
FROM doctors d, patients p
WHERE NOT EXISTS (SELECT 1 FROM prescriptions WHERE medications = 'Amoxicillin 500mg (3x daily)')
LIMIT 1;

INSERT INTO patient_vitals (patient_id, weight_kg, blood_pressure_sys, blood_pressure_dia, heart_rate, recorded_at)
SELECT id, 75.5, 120, 80, 72, DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM patients
WHERE NOT EXISTS (SELECT 1 FROM patient_vitals WHERE weight_kg = 75.5)
LIMIT 1;

INSERT INTO patient_vitals (patient_id, weight_kg, blood_pressure_sys, blood_pressure_dia, heart_rate, recorded_at)
SELECT id, 75.2, 118, 79, 70, DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM patients
WHERE NOT EXISTS (SELECT 1 FROM patient_vitals WHERE weight_kg = 75.2)
LIMIT 1;

INSERT INTO patient_vitals (patient_id, weight_kg, blood_pressure_sys, blood_pressure_dia, heart_rate, recorded_at)
SELECT id, 75.8, 122, 82, 75, NOW()
FROM patients
WHERE NOT EXISTS (SELECT 1 FROM patient_vitals WHERE weight_kg = 75.8)
LIMIT 1;
