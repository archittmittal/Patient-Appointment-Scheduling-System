-- Database Setup
CREATE DATABASE IF NOT EXISTS hospital_system;
USE hospital_system;

-- 1. Users Table (Base authentication and role)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'PATIENT', 'DOCTOR') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patients Table
CREATE TABLE IF NOT EXISTS patients (
    id INT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dob DATE,
    phone VARCHAR(20),
    blood_group VARCHAR(5),
    address TEXT,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    id INT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    degree VARCHAR(150),
    experience_years INT,
    rating DECIMAL(2,1) DEFAULT 0.0,
    review_count INT DEFAULT 0,
    about TEXT,
    location_room VARCHAR(100),
    image_url VARCHAR(255),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    symptoms TEXT,
    status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

-- 5. Live Queue Table
CREATE TABLE IF NOT EXISTS live_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    queue_number INT NOT NULL,
    status ENUM('WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED') DEFAULT 'WAITING',
    estimated_time INT DEFAULT 0, -- represented in minutes
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- 6. Doctor Blocked Dates Table
CREATE TABLE IF NOT EXISTS doctor_blocked_dates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    blocked_date DATE NOT NULL,
    reason VARCHAR(255),
    UNIQUE KEY unique_doctor_date (doctor_id, blocked_date),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Insert Mock Users (passwords are bcrypt hashes — plain-text values: patient123, doctor123, admin123)
INSERT IGNORE INTO users (id, email, password_hash, role) VALUES
(1,  'patient@example.com',        '$2b$10$pr3yTOhaCSWoCCKx6dh5zuHdBjIb5OiArA8HmGrZY9pS23x3rw17W', 'PATIENT'),
(2,  'dr.sarah@hospital.com',      '$2b$10$jlF3vybJbXMc7y5DESbqXOLOtL2i86bPyWA6AefbPhq1lGRwh/DPG', 'DOCTOR'),
(3,  'dr.michael@hospital.com',    '$2b$10$jlF3vybJbXMc7y5DESbqXOLOtL2i86bPyWA6AefbPhq1lGRwh/DPG', 'DOCTOR'),
(10, 'admin@hospital.com',         '$2b$10$6b1GuRKjy.ASXaKM.t/XVOYEJDrTxNSbe8AuM414NtK.YbgbaGfQe', 'ADMIN');

-- Insert Mock Patients
INSERT IGNORE INTO patients (id, first_name, last_name, dob, phone, blood_group, address) VALUES
(1, 'John', 'Doe', '1990-05-15', '+15551234567', 'O+', '123 Healing St, Apartment 4B, Healthville');

-- Insert Mock Doctors
INSERT IGNORE INTO doctors (id, first_name, last_name, specialty, degree, experience_years, rating, review_count, about, location_room, image_url) VALUES
(2, 'Sarah', 'Jenkins', 'Cardiologist', 'MBBS, MD - Cardiology', 15, 4.9, 128, 'Top Cardiologist with over 15 years experience.', 'Heart Care Pavilion, Block C', 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random'),
(3, 'Michael', 'Chen', 'General Physician', 'MBBS', 8, 4.8, 256, 'Expert in general medicine.', 'Central Clinic, Room 102', 'https://ui-avatars.com/api/?name=Michael+Chen&background=random');

-- Insert Mock Appointments (with symptoms)
INSERT IGNORE INTO appointments (id, patient_id, doctor_id, appointment_date, time_slot, symptoms, status) VALUES
(1, 1, 2, CURDATE(), '10:00 AM', 'Chest pain and shortness of breath for the past 3 days.', 'CONFIRMED'),
(2, 1, 3, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '02:30 PM', 'Fever and persistent cough.', 'PENDING');

-- Insert Mock Live Queue (For appointment 1 today)
INSERT IGNORE INTO live_queue (appointment_id, queue_number, status, estimated_time) VALUES
(1, 18, 'WAITING', 45);

-- -------------------------------------------------------
-- Run the following ALTERs if DB already exists (one-time migration):
-- ALTER TABLE appointments ADD COLUMN IF NOT EXISTS symptoms TEXT AFTER time_slot;
-- CREATE TABLE IF NOT EXISTS doctor_blocked_dates (id INT AUTO_INCREMENT PRIMARY KEY, doctor_id INT NOT NULL, blocked_date DATE NOT NULL, reason VARCHAR(255), UNIQUE KEY unique_doctor_date (doctor_id, blocked_date), FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE);
-- INSERT IGNORE INTO users (id, email, password_hash, role) VALUES (10, 'admin@hospital.com', '$2b$10$6b1GuRKjy.ASXaKM.t/XVOYEJDrTxNSbe8AuM414NtK.YbgbaGfQe', 'ADMIN');
-- UPDATE users SET password_hash = '$2b$10$pr3yTOhaCSWoCCKx6dh5zuHdBjIb5OiArA8HmGrZY9pS23x3rw17W' WHERE id = 1;
-- UPDATE users SET password_hash = '$2b$10$jlF3vybJbXMc7y5DESbqXOLOtL2i86bPyWA6AefbPhq1lGRwh/DPG' WHERE id IN (2, 3);
-- -------------------------------------------------------
