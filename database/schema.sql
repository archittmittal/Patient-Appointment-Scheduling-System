-- ============================================================================
-- Patient Appointment Scheduling System - Database Schema
-- DSA-based healthcare scheduling with Greedy, DP, Priority Queue algorithms
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS hospital_db;
USE hospital_db;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Departments Table
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    floor_number INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Doctors Table
-- ----------------------------------------------------------------------------
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT NOT NULL,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    specialization VARCHAR(100),
    qualification VARCHAR(200),
    experience_years INT DEFAULT 0,
    avg_consultation_time INT DEFAULT 15,          -- Average consultation time in minutes
    max_patients_per_day INT DEFAULT 40,           -- Load balancing parameter
    preferred_buffer_time INT DEFAULT 5,           -- Buffer between appointments (Greedy)
    phone VARCHAR(15),
    email VARCHAR(100) UNIQUE,
    rating DECIMAL(2,1) DEFAULT 4.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    INDEX idx_doctor_department (department_id),
    INDEX idx_doctor_active (is_active)
);

-- ----------------------------------------------------------------------------
-- Doctor Schedules Table (Weekly availability)
-- ----------------------------------------------------------------------------
CREATE TABLE doctor_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    day_of_week ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    morning_start TIME,                            -- e.g., '09:00:00'
    morning_end TIME,                              -- e.g., '13:00:00'
    afternoon_start TIME,                          -- e.g., '14:00:00'
    afternoon_end TIME,                            -- e.g., '18:00:00'
    slot_duration INT DEFAULT 20,                  -- Default slot duration in minutes
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    UNIQUE KEY unique_doctor_day (doctor_id, day_of_week),
    INDEX idx_schedule_day (day_of_week)
);

-- ----------------------------------------------------------------------------
-- Patients Table
-- DSA: Hash Map for O(1) lookup using patient_uid
-- ----------------------------------------------------------------------------
CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_uid VARCHAR(20) UNIQUE NOT NULL,       -- Unique ID for verification (Hash key)
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE,
    gender ENUM('MALE', 'FEMALE', 'OTHER'),
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    emergency_contact VARCHAR(15),
    blood_group VARCHAR(5),
    medical_history TEXT,
    -- No-show prediction features
    total_appointments INT DEFAULT 0,
    noshow_count INT DEFAULT 0,
    noshow_rate DECIMAL(3,2) DEFAULT 0.00,         -- Pre-computed for O(1) prediction
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_patient_uid (patient_uid),           -- Hash index for O(1) lookup
    INDEX idx_patient_phone (phone),
    INDEX idx_patient_email (email)
);

-- ----------------------------------------------------------------------------
-- Time Slots Table (Pre-generated slots)
-- DSA: Binary Search for availability check
-- ----------------------------------------------------------------------------
CREATE TABLE time_slots (
    slot_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration INT NOT NULL,                    -- Duration in minutes
    slot_status ENUM('AVAILABLE', 'BOOKED', 'BLOCKED', 'COMPLETED', 'CANCELLED') DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    UNIQUE KEY unique_slot (doctor_id, slot_date, start_time),
    INDEX idx_slot_date (slot_date),
    INDEX idx_slot_status (slot_status),
    INDEX idx_slot_doctor_date (doctor_id, slot_date, slot_status)  -- Optimized for Greedy slot search
);

-- ----------------------------------------------------------------------------
-- Appointments Table (Core booking records)
-- DSA: Interval Scheduling
-- ----------------------------------------------------------------------------
CREATE TABLE appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    slot_id INT,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    appointment_type ENUM('NEW', 'FOLLOW_UP', 'CHECKUP', 'EMERGENCY', 'CONSULTATION') DEFAULT 'NEW',
    -- Priority & Complexity (for Priority Queue and Weighted Scheduling)
    priority_level INT DEFAULT 3,                  -- 1=Highest, 5=Lowest
    urgency_level INT DEFAULT 1,                   -- 1=Normal, 5=Emergency
    expected_duration INT DEFAULT 20,              -- Expected consultation time (Weighted Job)
    case_complexity ENUM('SIMPLE', 'MODERATE', 'COMPLEX') DEFAULT 'MODERATE',
    -- Status tracking
    status ENUM('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW') DEFAULT 'SCHEDULED',
    -- No-show prediction
    noshow_probability DECIMAL(3,2) DEFAULT 0.00, -- Pre-computed probability
    reminder_sent BOOLEAN DEFAULT FALSE,
    -- Timestamps
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    checkin_time TIMESTAMP NULL,
    consultation_start TIMESTAMP NULL,
    consultation_end TIMESTAMP NULL,
    -- Actual metrics (for model training)
    actual_wait_time INT NULL,                     -- Actual wait in minutes
    actual_consultation_time INT NULL,             -- Actual consultation in minutes
    -- Notes
    reason_for_visit TEXT,
    doctor_notes TEXT,
    cancellation_reason TEXT,
    
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (slot_id) REFERENCES time_slots(slot_id),
    
    INDEX idx_appointment_date (appointment_date),
    INDEX idx_appointment_doctor_date (doctor_id, appointment_date),
    INDEX idx_appointment_patient (patient_id),
    INDEX idx_appointment_status (status),
    INDEX idx_appointment_type (appointment_type)
);

-- ----------------------------------------------------------------------------
-- Live Queue Table (Real-time queue management)
-- DSA: Priority Queue (Min-Heap implementation)
-- ----------------------------------------------------------------------------
CREATE TABLE live_queue (
    queue_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL UNIQUE,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    -- Priority Queue fields
    queue_position INT NOT NULL,                   -- Current position in queue
    priority_score DECIMAL(10,2) NOT NULL,         -- Heap key (lower = higher priority)
    base_priority INT DEFAULT 100,                 -- Starting priority
    urgency_level INT DEFAULT 1,                   -- 1=Normal, 5=Emergency
    -- Wait time tracking
    checkin_time TIMESTAMP NOT NULL,
    estimated_wait_minutes INT DEFAULT 0,          -- Predicted wait time
    actual_wait_minutes INT NULL,
    -- Status
    queue_status ENUM('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'LEFT') DEFAULT 'WAITING',
    called_at TIMESTAMP NULL,
    -- Metadata
    token_number VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    
    INDEX idx_queue_doctor (doctor_id),
    INDEX idx_queue_status (queue_status),
    INDEX idx_queue_priority (doctor_id, priority_score),  -- For Extract-Min operation
    INDEX idx_queue_position (doctor_id, queue_position)
);

-- ----------------------------------------------------------------------------
-- Queue History Table (Historical data for Wait Time Prediction)
-- DSA: DP-based prediction model training data
-- ----------------------------------------------------------------------------
CREATE TABLE queue_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    appointment_id INT,
    patient_id INT,
    -- Time dimensions for pattern analysis
    queue_date DATE NOT NULL,
    day_of_week ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    hour_of_day INT NOT NULL,                      -- 0-23
    -- Metrics
    appointment_type ENUM('NEW', 'FOLLOW_UP', 'CHECKUP', 'EMERGENCY', 'CONSULTATION'),
    wait_time_minutes INT NOT NULL,               -- Actual wait time
    consultation_minutes INT NOT NULL,            -- Actual consultation time
    queue_size_at_checkin INT,                    -- Queue length when patient checked in
    -- Outcome
    was_noshow BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    INDEX idx_history_doctor (doctor_id),
    INDEX idx_history_date (queue_date),
    INDEX idx_history_day_hour (doctor_id, day_of_week, hour_of_day),  -- For prediction queries
    INDEX idx_history_type (appointment_type)
);

-- ----------------------------------------------------------------------------
-- Notifications Table
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    appointment_id INT,
    notification_type ENUM('BOOKING_CONFIRM', 'REMINDER', 'QUEUE_UPDATE', 'CANCELLATION', 'NOSHOW_WARNING', 'RESCHEDULE') NOT NULL,
    channel ENUM('SMS', 'EMAIL', 'BOTH') DEFAULT 'SMS',
    message TEXT NOT NULL,
    status ENUM('PENDING', 'SENT', 'FAILED', 'DELIVERED') DEFAULT 'PENDING',
    scheduled_time TIMESTAMP,
    sent_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    INDEX idx_notification_status (status),
    INDEX idx_notification_scheduled (scheduled_time)
);

-- ----------------------------------------------------------------------------
-- Waitlist Table (For no-show slot filling)
-- ----------------------------------------------------------------------------
CREATE TABLE waitlist (
    waitlist_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time_start TIME,
    preferred_time_end TIME,
    priority INT DEFAULT 1,                        -- Higher = more urgent need
    status ENUM('WAITING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED') DEFAULT 'WAITING',
    offered_slot_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    INDEX idx_waitlist_doctor_date (doctor_id, preferred_date),
    INDEX idx_waitlist_status (status)
);

-- ----------------------------------------------------------------------------
-- Doctor Load Table (For Load Balancing Algorithm)
-- ----------------------------------------------------------------------------
CREATE TABLE doctor_load (
    load_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    load_date DATE NOT NULL,
    total_slots INT DEFAULT 0,
    booked_slots INT DEFAULT 0,
    completed_appointments INT DEFAULT 0,
    total_patients_seen INT DEFAULT 0,
    total_consultation_minutes INT DEFAULT 0,
    utilization_percentage DECIMAL(5,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    UNIQUE KEY unique_doctor_date (doctor_id, load_date),
    INDEX idx_load_date (load_date),
    INDEX idx_load_utilization (utilization_percentage)
);

-- ----------------------------------------------------------------------------
-- System Configuration Table
-- ----------------------------------------------------------------------------
CREATE TABLE system_config (
    config_id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(50) UNIQUE NOT NULL,
    config_value VARCHAR(200) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('URGENCY_WEIGHT', '10', 'Weight for urgency in priority calculation'),
('WAIT_TIME_WEIGHT', '0.5', 'Weight for waiting time in priority calculation'),
('NOSHOW_THRESHOLD', '0.5', 'Probability threshold to trigger no-show warning'),
('EMERGENCY_PRIORITY', '-100', 'Priority score for emergency cases'),
('DEFAULT_SLOT_DURATION', '20', 'Default appointment slot duration in minutes'),
('PREDICTION_CURRENT_WEIGHT', '0.6', 'Weight for current queue in wait prediction'),
('PREDICTION_HISTORY_WEIGHT', '0.4', 'Weight for historical data in wait prediction'),
('LOAD_BALANCE_ENABLED', 'true', 'Enable automatic load balancing'),
('MAX_ADVANCE_BOOKING_DAYS', '30', 'Maximum days in advance for booking'),
('REMINDER_HOURS_BEFORE', '24', 'Hours before appointment to send reminder');

-- ----------------------------------------------------------------------------
-- Users Table (Authentication)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('PATIENT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN') NOT NULL,
    reference_id INT,                              -- Links to patient_id or doctor_id
    email VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_role (role),
    INDEX idx_user_active (is_active)
);

-- ----------------------------------------------------------------------------
-- Audit Log Table
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_date (created_at)
);

-- ============================================================================
-- INDEXES FOR DSA OPERATIONS
-- ============================================================================

-- For Greedy slot allocation (find first available slot)
CREATE INDEX idx_greedy_slot_search 
ON time_slots (doctor_id, slot_date, start_time, slot_status);

-- For Priority Queue operations (Extract-Min)
CREATE INDEX idx_priority_queue_extract 
ON live_queue (doctor_id, queue_status, priority_score);

-- For Wait Time Prediction (historical lookup)
CREATE INDEX idx_wait_prediction 
ON queue_history (doctor_id, day_of_week, hour_of_day, appointment_type);

-- For No-show Prediction (patient history)
CREATE INDEX idx_noshow_patient 
ON appointments (patient_id, status);

-- For Load Balancing (find least loaded doctor)
CREATE INDEX idx_load_balance 
ON doctor_load (load_date, utilization_percentage);

-- For Conflict Detection (interval overlap check)
CREATE INDEX idx_conflict_check 
ON appointments (doctor_id, appointment_date, start_time, end_time, status);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables Created: 15
-- 1.  departments          - Hospital departments
-- 2.  doctors              - Doctor profiles with scheduling params
-- 3.  doctor_schedules     - Weekly availability schedule
-- 4.  patients             - Patient records with no-show metrics
-- 5.  time_slots           - Pre-generated appointment slots
-- 6.  appointments         - Core appointment records
-- 7.  live_queue           - Real-time priority queue
-- 8.  queue_history        - Historical data for predictions
-- 9.  notifications        - SMS/Email notification queue
-- 10. waitlist             - Patients waiting for slots
-- 11. doctor_load          - Daily load metrics per doctor
-- 12. system_config        - Algorithm configuration
-- 13. users                - Authentication
-- 14. audit_log            - Activity tracking
--
-- DSA Connections:
-- - Priority Queue: live_queue table with priority_score index
-- - Greedy Search: time_slots with sorted indexes
-- - DP Prediction: queue_history with day/hour indexes
-- - Hash Map: patients.patient_uid for O(1) lookup
-- - Load Balancing: doctor_load for utilization tracking
-- - Weighted Scheduling: appointments.expected_duration, case_complexity
-- ============================================================================
