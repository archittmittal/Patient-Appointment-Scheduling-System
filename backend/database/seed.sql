USE hospital_system;

-- Insert Mock Users (passwords are bcrypt hashes — plain-text values: patient123, doctor123, admin123)
INSERT IGNORE INTO users (email, password_hash, role) VALUES
('patient@example.com',        '$2b$10$pr3yTOhaCSWoCCKx6dh5zuHdBjIb5OiArA8HmGrZY9pS23x3rw17W', 'PATIENT'),
('dr.sarah@hospital.com',      '$2b$10$jlF3vybJbXMc7y5DESbqXOLOtL2i86bPyWA6AefbPhq1lGRwh/DPG', 'DOCTOR'),
('dr.michael@hospital.com',    '$2b$10$jlF3vybJbXMc7y5DESbqXOLOtL2i86bPyWA6AefbPhq1lGRwh/DPG', 'DOCTOR'),
('admin@hospital.com',         '$2b$10$6b1GuRKjy.ASXaKM.t/XVOYEJDrTxNSbe8AuM414NtK.YbgbaGfQe', 'ADMIN');

-- Insert Mock Patients
INSERT IGNORE INTO patients (id, first_name, last_name, dob, phone, blood_group, address)
SELECT id, 'John', 'Doe', '1990-05-15', '+15551234567', 'O+', '123 Healing St, Apartment 4B, Healthville'
FROM users WHERE email = 'patient@example.com';

-- Insert Mock Doctors
INSERT IGNORE INTO doctors (id, first_name, last_name, specialty, degree, experience_years, rating, review_count, about, location_room, image_url, consultation_fee)
SELECT id, 'Sarah', 'Jenkins', 'Cardiologist', 'MBBS, MD - Cardiology', 15, 4.9, 128, 'Top Cardiologist with over 15 years experience.', 'Heart Care Pavilion, Block C', 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random', 1500.00
FROM users WHERE email = 'dr.sarah@hospital.com';

INSERT IGNORE INTO doctors (id, first_name, last_name, specialty, degree, experience_years, rating, review_count, about, location_room, image_url, consultation_fee)
SELECT id, 'Michael', 'Chen', 'General Physician', 'MBBS', 8, 4.8, 256, 'Expert in general medicine.', 'Central Clinic, Room 102', 'https://ui-avatars.com/api/?name=Michael+Chen&background=random', 500.00
FROM users WHERE email = 'dr.michael@hospital.com';

-- Insert Mock Appointments (with symptoms)
INSERT IGNORE INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status)
SELECT p.id, d.id, CURDATE(), '10:00 AM', 'Chest pain and shortness of breath for the past 3 days.', 'CONFIRMED'
FROM users p, users d
WHERE p.email = 'patient@example.com' AND d.email = 'dr.sarah@hospital.com'
  AND NOT EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = p.id AND doctor_id = d.id AND appointment_date = CURDATE() AND time_slot = '10:00 AM'
  );

INSERT IGNORE INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status)
SELECT p.id, d.id, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '02:30 PM', 'Fever and persistent cough.', 'PENDING'
FROM users p, users d
WHERE p.email = 'patient@example.com' AND d.email = 'dr.michael@hospital.com'
  AND NOT EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = p.id AND doctor_id = d.id AND appointment_date = DATE_ADD(CURDATE(), INTERVAL 2 DAY) AND time_slot = '02:30 PM'
  );

-- Insert Mock Live Queue (For appointment 1 today)
INSERT IGNORE INTO live_queue (appointment_id, queue_number, status, estimated_time)
SELECT a.id, 18, 'WAITING', 45
FROM appointments a
JOIN users p ON a.patient_id = p.id
JOIN users d ON a.doctor_id = d.id
WHERE p.email = 'patient@example.com' AND d.email = 'dr.sarah@hospital.com' AND a.appointment_date = CURDATE()
  AND NOT EXISTS (
      SELECT 1 FROM live_queue lq WHERE lq.appointment_id = a.id
  );
