-- Database Setup
CREATE DATABASE IF NOT EXISTS hospital_system;
USE hospital_system;

-- 1. Users Table (Base authentication and role)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    role ENUM('ADMIN', 'PATIENT', 'DOCTOR') NOT NULL,
    auth_provider VARCHAR(50) DEFAULT 'LOCAL',
    google_id VARCHAR(255) UNIQUE,
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
    abha_id VARCHAR(100) NULL UNIQUE,
    abha_number VARCHAR(20) NULL UNIQUE,
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
    availability JSON,
    max_patients_per_slot INT DEFAULT 15,
    consultation_fee DECIMAL(10, 2) NOT NULL,
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
    diagnosis VARCHAR(255),
    notes TEXT,
    prescription TEXT,
    follow_up_date DATE,
    consultation_start DATETIME NULL,
    consultation_end DATETIME NULL,
    actual_duration_mins INT NULL,
    predicted_duration_mins INT DEFAULT 15,
    is_follow_up BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_appointments_doctor_date_slot (doctor_id, appointment_date, time_slot),
    INDEX idx_appointments_doctor_date (doctor_id, appointment_date),
    INDEX idx_appointments_patient_date (patient_id, appointment_date),
    INDEX idx_appointments_status (status),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- 5. Live Queue Table
CREATE TABLE IF NOT EXISTS live_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    queue_number INT NOT NULL,
    status ENUM('WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED') DEFAULT 'WAITING',
    estimated_time INT DEFAULT 0, -- represented in minutes
    predicted_duration INT DEFAULT 15,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_live_queue_appointment (appointment_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
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

-- 7. Consent Logs Table (DPDP Act 2023 Compliance)
CREATE TABLE IF NOT EXISTS consent_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    status ENUM('GRANTED', 'REVOKED') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_consent_patient_doctor (patient_id, doctor_id),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

