-- ============================================================================
-- Patient Appointment Scheduling System - Sample Data
-- Test data for development and demonstration
-- ============================================================================

USE hospital_db;

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

INSERT INTO departments (department_name, description, floor_number) VALUES
('General Medicine', 'Primary care and general health consultations', 1),
('Cardiology', 'Heart and cardiovascular system specialists', 2),
('Orthopedics', 'Bone, joint, and muscle specialists', 2),
('Dermatology', 'Skin, hair, and nail specialists', 1),
('Pediatrics', 'Child and adolescent healthcare', 3),
('Neurology', 'Brain and nervous system specialists', 3),
('ENT', 'Ear, Nose, and Throat specialists', 1),
('Ophthalmology', 'Eye care specialists', 1);

-- ============================================================================
-- DOCTORS
-- ============================================================================

INSERT INTO doctors (department_id, employee_id, first_name, last_name, specialization, 
                     qualification, experience_years, avg_consultation_time, 
                     max_patients_per_day, preferred_buffer_time, phone, email, rating) VALUES
-- General Medicine
(1, 'DOC001', 'Rajesh', 'Sharma', 'General Physician', 'MBBS, MD', 15, 15, 40, 5, '9876543210', 'rajesh.sharma@hospital.com', 4.8),
(1, 'DOC002', 'Priya', 'Gupta', 'Family Medicine', 'MBBS, DNB', 10, 20, 35, 5, '9876543211', 'priya.gupta@hospital.com', 4.6),
-- Cardiology
(2, 'DOC003', 'Amit', 'Verma', 'Cardiologist', 'MBBS, DM Cardiology', 18, 25, 25, 10, '9876543212', 'amit.verma@hospital.com', 4.9),
(2, 'DOC004', 'Kavita', 'Joshi', 'Interventional Cardiology', 'MBBS, MD, DM', 12, 30, 20, 10, '9876543213', 'kavita.joshi@hospital.com', 4.7),
-- Orthopedics
(3, 'DOC005', 'Suresh', 'Patel', 'Orthopedic Surgeon', 'MBBS, MS Ortho', 20, 20, 30, 5, '9876543214', 'suresh.patel@hospital.com', 4.8),
(3, 'DOC006', 'Meena', 'Reddy', 'Sports Medicine', 'MBBS, MS, Fellowship', 8, 25, 28, 5, '9876543215', 'meena.reddy@hospital.com', 4.5),
-- Dermatology
(4, 'DOC007', 'Ananya', 'Singh', 'Dermatologist', 'MBBS, MD Dermatology', 9, 15, 35, 5, '9876543216', 'ananya.singh@hospital.com', 4.7),
-- Pediatrics
(5, 'DOC008', 'Vikram', 'Kumar', 'Pediatrician', 'MBBS, MD Pediatrics', 14, 20, 35, 5, '9876543217', 'vikram.kumar@hospital.com', 4.9),
-- Neurology
(6, 'DOC009', 'Deepa', 'Nair', 'Neurologist', 'MBBS, DM Neurology', 16, 30, 20, 10, '9876543218', 'deepa.nair@hospital.com', 4.8),
-- ENT
(7, 'DOC010', 'Rahul', 'Mehta', 'ENT Specialist', 'MBBS, MS ENT', 11, 15, 40, 5, '9876543219', 'rahul.mehta@hospital.com', 4.6);

-- ============================================================================
-- DOCTOR SCHEDULES
-- ============================================================================

-- Dr. Rajesh Sharma (General Medicine)
INSERT INTO doctor_schedules (doctor_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, slot_duration) VALUES
(1, 'MONDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(1, 'TUESDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(1, 'WEDNESDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(1, 'THURSDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(1, 'FRIDAY', '09:00:00', '13:00:00', '14:00:00', '17:00:00', 15),
(1, 'SATURDAY', '09:00:00', '13:00:00', NULL, NULL, 15);

-- Dr. Amit Verma (Cardiology)
INSERT INTO doctor_schedules (doctor_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, slot_duration) VALUES
(3, 'MONDAY', '10:00:00', '13:00:00', '15:00:00', '18:00:00', 25),
(3, 'WEDNESDAY', '10:00:00', '13:00:00', '15:00:00', '18:00:00', 25),
(3, 'FRIDAY', '10:00:00', '13:00:00', '15:00:00', '18:00:00', 25);

-- Dr. Suresh Patel (Orthopedics)
INSERT INTO doctor_schedules (doctor_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, slot_duration) VALUES
(5, 'MONDAY', '09:00:00', '13:00:00', '14:00:00', '17:00:00', 20),
(5, 'TUESDAY', '09:00:00', '13:00:00', '14:00:00', '17:00:00', 20),
(5, 'THURSDAY', '09:00:00', '13:00:00', '14:00:00', '17:00:00', 20),
(5, 'SATURDAY', '09:00:00', '14:00:00', NULL, NULL, 20);

-- Dr. Ananya Singh (Dermatology)
INSERT INTO doctor_schedules (doctor_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, slot_duration) VALUES
(7, 'MONDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(7, 'TUESDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(7, 'WEDNESDAY', '09:00:00', '13:00:00', NULL, NULL, 15),
(7, 'THURSDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15),
(7, 'FRIDAY', '09:00:00', '13:00:00', '14:00:00', '18:00:00', 15);

-- Dr. Vikram Kumar (Pediatrics)
INSERT INTO doctor_schedules (doctor_id, day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, slot_duration) VALUES
(8, 'MONDAY', '09:00:00', '13:00:00', '16:00:00', '19:00:00', 20),
(8, 'TUESDAY', '09:00:00', '13:00:00', '16:00:00', '19:00:00', 20),
(8, 'WEDNESDAY', '09:00:00', '13:00:00', '16:00:00', '19:00:00', 20),
(8, 'THURSDAY', '09:00:00', '13:00:00', '16:00:00', '19:00:00', 20),
(8, 'FRIDAY', '09:00:00', '13:00:00', NULL, NULL, 20);

-- ============================================================================
-- PATIENTS
-- ============================================================================

INSERT INTO patients (patient_uid, first_name, last_name, date_of_birth, gender, 
                     phone, email, address, blood_group, total_appointments, 
                     noshow_count, noshow_rate) VALUES
('PAT-2026-0001', 'Arun', 'Kumar', '1985-03-15', 'MALE', '8876543210', 'arun.kumar@email.com', '123, MG Road, Mumbai', 'O+', 12, 1, 0.08),
('PAT-2026-0002', 'Sunita', 'Devi', '1990-07-22', 'FEMALE', '8876543211', 'sunita.devi@email.com', '45, Park Street, Delhi', 'A+', 8, 2, 0.25),
('PAT-2026-0003', 'Ramesh', 'Yadav', '1978-11-08', 'MALE', '8876543212', 'ramesh.yadav@email.com', '78, Lake View, Bangalore', 'B+', 15, 0, 0.00),
('PAT-2026-0004', 'Lakshmi', 'Iyer', '1995-02-28', 'FEMALE', '8876543213', 'lakshmi.iyer@email.com', '22, Beach Road, Chennai', 'AB+', 5, 1, 0.20),
('PAT-2026-0005', 'Mohan', 'Das', '1970-09-10', 'MALE', '8876543214', 'mohan.das@email.com', '56, Station Road, Kolkata', 'O-', 20, 0, 0.00),
('PAT-2026-0006', 'Anjali', 'Desai', '1988-04-17', 'FEMALE', '8876543215', 'anjali.desai@email.com', '89, Hill View, Pune', 'A-', 3, 0, 0.00),
('PAT-2026-0007', 'Sanjay', 'Nair', '1982-12-03', 'MALE', '8876543216', 'sanjay.nair@email.com', '34, Garden Lane, Kochi', 'B-', 7, 1, 0.14),
('PAT-2026-0008', 'Meera', 'Sharma', '1992-06-25', 'FEMALE', '8876543217', 'meera.sharma@email.com', '67, River Side, Ahmedabad', 'O+', 4, 0, 0.00),
('PAT-2026-0009', 'Vijay', 'Reddy', '1975-08-19', 'MALE', '8876543218', 'vijay.reddy@email.com', '90, Main Street, Hyderabad', 'A+', 18, 3, 0.17),
('PAT-2026-0010', 'Pooja', 'Agarwal', '1998-01-12', 'FEMALE', '8876543219', 'pooja.agarwal@email.com', '12, College Road, Jaipur', 'B+', 2, 0, 0.00),
('PAT-2026-0011', 'Kiran', 'Patil', '1987-05-30', 'MALE', '8876543220', 'kiran.patil@email.com', '45, Market Lane, Nagpur', 'AB-', 10, 4, 0.40),
('PAT-2026-0012', 'Neha', 'Kapoor', '1993-10-07', 'FEMALE', '8876543221', 'neha.kapoor@email.com', '78, Temple Road, Lucknow', 'O+', 6, 0, 0.00),
('PAT-2026-0013', 'Arjun', 'Malhotra', '1980-03-21', 'MALE', '8876543222', 'arjun.malhotra@email.com', '23, Civil Lines, Chandigarh', 'A+', 9, 1, 0.11),
('PAT-2026-0014', 'Divya', 'Menon', '1996-07-14', 'FEMALE', '8876543223', 'divya.menon@email.com', '56, Green Park, Trivandrum', 'B+', 4, 0, 0.00),
('PAT-2026-0015', 'Ravi', 'Tiwari', '1968-11-29', 'MALE', '8876543224', 'ravi.tiwari@email.com', '89, Old Town, Bhopal', 'O-', 25, 2, 0.08);

-- ============================================================================
-- USERS (Authentication)
-- ============================================================================

-- Password hash for 'password123' (in real app, use proper bcrypt)
INSERT INTO users (username, password_hash, role, reference_id, email) VALUES
-- Admin
('admin', '$2a$10$placeholder_hash_admin', 'ADMIN', NULL, 'admin@hospital.com'),
-- Receptionists
('reception1', '$2a$10$placeholder_hash_rec1', 'RECEPTIONIST', NULL, 'reception1@hospital.com'),
('reception2', '$2a$10$placeholder_hash_rec2', 'RECEPTIONIST', NULL, 'reception2@hospital.com'),
-- Doctors (linked to doctor_id)
('dr.rajesh', '$2a$10$placeholder_hash_dr1', 'DOCTOR', 1, 'rajesh.sharma@hospital.com'),
('dr.amit', '$2a$10$placeholder_hash_dr3', 'DOCTOR', 3, 'amit.verma@hospital.com'),
('dr.suresh', '$2a$10$placeholder_hash_dr5', 'DOCTOR', 5, 'suresh.patel@hospital.com'),
-- Patients (linked to patient_id)
('pat.arun', '$2a$10$placeholder_hash_pat1', 'PATIENT', 1, 'arun.kumar@email.com'),
('pat.sunita', '$2a$10$placeholder_hash_pat2', 'PATIENT', 2, 'sunita.devi@email.com'),
('pat.ramesh', '$2a$10$placeholder_hash_pat3', 'PATIENT', 3, 'ramesh.yadav@email.com');

-- ============================================================================
-- GENERATE TIME SLOTS (For next 7 days)
-- ============================================================================

-- This would normally be done via stored procedure
-- For demo, manually inserting slots for Dr. Rajesh Sharma for today

-- Get today's date dynamically in a real scenario
-- For sample data, using fixed dates relative to Feb 19, 2026

INSERT INTO time_slots (doctor_id, slot_date, start_time, end_time, slot_duration, slot_status) VALUES
-- Dr. Rajesh Sharma - Feb 19, 2026 (Thursday)
(1, '2026-02-19', '09:00:00', '09:15:00', 15, 'BOOKED'),
(1, '2026-02-19', '09:20:00', '09:35:00', 15, 'BOOKED'),
(1, '2026-02-19', '09:40:00', '09:55:00', 15, 'BOOKED'),
(1, '2026-02-19', '10:00:00', '10:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '10:20:00', '10:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '10:40:00', '10:55:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '11:00:00', '11:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '11:20:00', '11:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '11:40:00', '11:55:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '12:00:00', '12:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '12:20:00', '12:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '12:40:00', '12:55:00', 15, 'AVAILABLE'),
-- Afternoon
(1, '2026-02-19', '14:00:00', '14:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '14:20:00', '14:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '14:40:00', '14:55:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '15:00:00', '15:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '15:20:00', '15:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '15:40:00', '15:55:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '16:00:00', '16:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '16:20:00', '16:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '16:40:00', '16:55:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '17:00:00', '17:15:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '17:20:00', '17:35:00', 15, 'AVAILABLE'),
(1, '2026-02-19', '17:40:00', '17:55:00', 15, 'AVAILABLE');

-- Dr. Amit Verma (Cardiology) - Feb 19, 2026
INSERT INTO time_slots (doctor_id, slot_date, start_time, end_time, slot_duration, slot_status) VALUES
(3, '2026-02-19', '10:00:00', '10:25:00', 25, 'BOOKED'),
(3, '2026-02-19', '10:35:00', '11:00:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '11:10:00', '11:35:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '11:45:00', '12:10:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '12:20:00', '12:45:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '15:00:00', '15:25:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '15:35:00', '16:00:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '16:10:00', '16:35:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '16:45:00', '17:10:00', 25, 'AVAILABLE'),
(3, '2026-02-19', '17:20:00', '17:45:00', 25, 'AVAILABLE');

-- ============================================================================
-- APPOINTMENTS (Some booked appointments)
-- ============================================================================

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time,
                         appointment_type, priority_level, urgency_level, expected_duration,
                         case_complexity, status, noshow_probability, reason_for_visit) VALUES
-- Today's appointments
(1, 1, 1, '2026-02-19', '09:00:00', '09:15:00', 'FOLLOW_UP', 3, 1, 15, 'SIMPLE', 'CHECKED_IN', 0.08, 'Follow-up for fever'),
(3, 1, 2, '2026-02-19', '09:20:00', '09:35:00', 'CHECKUP', 4, 1, 15, 'SIMPLE', 'CHECKED_IN', 0.00, 'Regular health checkup'),
(6, 1, 3, '2026-02-19', '09:40:00', '09:55:00', 'NEW', 2, 2, 15, 'MODERATE', 'CONFIRMED', 0.00, 'Chronic headache'),
(5, 3, 25, '2026-02-19', '10:00:00', '10:25:00', 'CONSULTATION', 2, 3, 25, 'COMPLEX', 'CONFIRMED', 0.00, 'Chest pain evaluation'),

-- Future appointments
(2, 1, NULL, '2026-02-20', '10:00:00', '10:15:00', 'FOLLOW_UP', 3, 1, 15, 'SIMPLE', 'SCHEDULED', 0.25, 'Blood pressure monitoring'),
(4, 1, NULL, '2026-02-20', '11:00:00', '11:15:00', 'NEW', 2, 1, 15, 'MODERATE', 'SCHEDULED', 0.20, 'Skin rash consultation'),
(7, 3, NULL, '2026-02-21', '10:00:00', '10:25:00', 'CHECKUP', 3, 1, 25, 'SIMPLE', 'SCHEDULED', 0.14, 'Annual cardiac checkup'),
(8, 5, NULL, '2026-02-20', '09:00:00', '09:20:00', 'NEW', 2, 2, 20, 'MODERATE', 'SCHEDULED', 0.00, 'Knee pain'),
(9, 5, NULL, '2026-02-20', '09:25:00', '09:45:00', 'FOLLOW_UP', 3, 1, 20, 'SIMPLE', 'SCHEDULED', 0.17, 'Post-surgery follow-up'),
(10, 7, NULL, '2026-02-21', '09:00:00', '09:15:00', 'NEW', 2, 1, 15, 'SIMPLE', 'SCHEDULED', 0.00, 'Acne treatment'),

-- High no-show risk appointments (for testing prediction)
(11, 1, NULL, '2026-02-22', '10:00:00', '10:15:00', 'CHECKUP', 4, 1, 15, 'SIMPLE', 'SCHEDULED', 0.40, 'General checkup'),
(2, 3, NULL, '2026-02-23', '10:00:00', '10:25:00', 'CONSULTATION', 3, 2, 25, 'MODERATE', 'SCHEDULED', 0.30, 'ECG review');

-- ============================================================================
-- LIVE QUEUE (Current queue for Dr. Rajesh)
-- ============================================================================

INSERT INTO live_queue (appointment_id, doctor_id, patient_id, queue_position, 
                       priority_score, base_priority, urgency_level,
                       checkin_time, estimated_wait_minutes, token_number, queue_status) VALUES
(1, 1, 1, 1, 90.00, 100, 1, '2026-02-19 08:45:00', 0, 'T001', 'IN_CONSULTATION'),
(2, 1, 3, 2, 95.00, 100, 1, '2026-02-19 08:50:00', 12, 'T002', 'WAITING'),
(3, 1, 6, 3, 75.00, 100, 2, '2026-02-19 09:10:00', 25, 'T003', 'WAITING');

-- ============================================================================
-- QUEUE HISTORY (For wait time prediction training)
-- ============================================================================

INSERT INTO queue_history (doctor_id, queue_date, day_of_week, hour_of_day,
                          appointment_type, wait_time_minutes, consultation_minutes,
                          queue_size_at_checkin, was_noshow) VALUES
-- Dr. Rajesh - Monday patterns
(1, '2026-02-17', 'MONDAY', 9, 'NEW', 15, 18, 3, FALSE),
(1, '2026-02-17', 'MONDAY', 9, 'FOLLOW_UP', 12, 10, 2, FALSE),
(1, '2026-02-17', 'MONDAY', 10, 'CHECKUP', 20, 12, 4, FALSE),
(1, '2026-02-17', 'MONDAY', 10, 'NEW', 25, 20, 5, FALSE),
(1, '2026-02-17', 'MONDAY', 11, 'FOLLOW_UP', 18, 8, 3, FALSE),
(1, '2026-02-17', 'MONDAY', 14, 'NEW', 10, 15, 2, FALSE),
(1, '2026-02-17', 'MONDAY', 15, 'CHECKUP', 8, 10, 1, FALSE),
(1, '2026-02-17', 'MONDAY', 16, 'FOLLOW_UP', 5, 8, 1, FALSE),

-- Dr. Rajesh - Tuesday patterns
(1, '2026-02-18', 'TUESDAY', 9, 'NEW', 20, 22, 4, FALSE),
(1, '2026-02-18', 'TUESDAY', 9, 'EMERGENCY', 2, 25, 5, FALSE),
(1, '2026-02-18', 'TUESDAY', 10, 'FOLLOW_UP', 15, 10, 3, FALSE),
(1, '2026-02-18', 'TUESDAY', 11, 'CHECKUP', 12, 12, 2, FALSE),
(1, '2026-02-18', 'TUESDAY', 14, 'NEW', 8, 18, 1, FALSE),
(1, '2026-02-18', 'TUESDAY', 15, 'FOLLOW_UP', 22, 10, 4, FALSE),
(1, '2026-02-18', 'TUESDAY', 10, 'CHECKUP', 0, 0, 3, TRUE), -- No-show

-- Dr. Amit (Cardiology) patterns
(3, '2026-02-17', 'MONDAY', 10, 'CONSULTATION', 25, 35, 3, FALSE),
(3, '2026-02-17', 'MONDAY', 11, 'NEW', 30, 40, 4, FALSE),
(3, '2026-02-17', 'MONDAY', 15, 'FOLLOW_UP', 15, 20, 2, FALSE),
(3, '2026-02-17', 'MONDAY', 16, 'CHECKUP', 20, 25, 3, FALSE),

-- More historical data for better predictions
(1, '2026-02-10', 'MONDAY', 9, 'NEW', 18, 20, 3, FALSE),
(1, '2026-02-10', 'MONDAY', 10, 'FOLLOW_UP', 22, 12, 4, FALSE),
(1, '2026-02-10', 'MONDAY', 11, 'CHECKUP', 15, 10, 3, FALSE),
(1, '2026-02-11', 'TUESDAY', 9, 'NEW', 25, 22, 5, FALSE),
(1, '2026-02-11', 'TUESDAY', 10, 'EMERGENCY', 3, 30, 6, FALSE),
(1, '2026-02-12', 'WEDNESDAY', 9, 'FOLLOW_UP', 12, 8, 2, FALSE),
(1, '2026-02-12', 'WEDNESDAY', 14, 'NEW', 10, 15, 2, FALSE),
(1, '2026-02-13', 'THURSDAY', 9, 'CHECKUP', 20, 12, 4, FALSE),
(1, '2026-02-13', 'THURSDAY', 15, 'FOLLOW_UP', 8, 10, 1, FALSE);

-- ============================================================================
-- DOCTOR LOAD (Today's statistics)
-- ============================================================================

INSERT INTO doctor_load (doctor_id, load_date, total_slots, booked_slots, 
                        completed_appointments, total_consultation_minutes, utilization_percentage) VALUES
(1, '2026-02-19', 24, 3, 0, 0, 12.50),
(3, '2026-02-19', 10, 1, 0, 0, 10.00),
(5, '2026-02-19', 18, 0, 0, 0, 0.00),
(7, '2026-02-19', 20, 0, 0, 0, 0.00);

-- ============================================================================
-- WAITLIST (Patients waiting for slots)
-- ============================================================================

INSERT INTO waitlist (patient_id, doctor_id, preferred_date, preferred_time_start, 
                     preferred_time_end, priority, status) VALUES
(12, 3, '2026-02-19', '10:00:00', '12:00:00', 2, 'WAITING'),
(13, 1, '2026-02-19', '09:00:00', '11:00:00', 1, 'WAITING'),
(14, 5, '2026-02-20', '14:00:00', '17:00:00', 1, 'WAITING');

-- ============================================================================
-- NOTIFICATIONS (Pending notifications)
-- ============================================================================

INSERT INTO notifications (patient_id, appointment_id, notification_type, channel, 
                          message, status, scheduled_time) VALUES
-- Reminders for tomorrow
(2, 5, 'REMINDER', 'SMS', 'Reminder: Your appointment with Dr. Rajesh Sharma is tomorrow at 10:00 AM', 'PENDING', '2026-02-19 18:00:00'),
(4, 6, 'REMINDER', 'SMS', 'Reminder: Your appointment with Dr. Rajesh Sharma is tomorrow at 11:00 AM', 'PENDING', '2026-02-19 18:00:00'),
(8, 8, 'REMINDER', 'SMS', 'Reminder: Your appointment with Dr. Suresh Patel is tomorrow at 09:00 AM', 'PENDING', '2026-02-19 18:00:00'),
(9, 9, 'REMINDER', 'SMS', 'Reminder: Your appointment with Dr. Suresh Patel is tomorrow at 09:25 AM', 'PENDING', '2026-02-19 18:00:00'),
-- High no-show risk patient reminder
(11, 11, 'NOSHOW_WARNING', 'BOTH', 'Important: Please confirm your appointment on Feb 22. Reply YES to confirm.', 'PENDING', '2026-02-20 10:00:00');

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Sample Data Loaded:
-- - 8 Departments
-- - 10 Doctors with schedules
-- - 15 Patients with varying no-show histories
-- - 9 Users (admin, receptionists, doctors, patients)
-- - 34 Time slots for today
-- - 12 Appointments (mix of statuses)
-- - 3 Live queue entries
-- - 28 Queue history records (for prediction training)
-- - 4 Doctor load records
-- - 3 Waitlist entries
-- - 5 Pending notifications
--
-- Test Scenarios Available:
-- 1. Priority Queue: Patients in queue with different priorities
-- 2. Wait Time Prediction: Historical data for different days/hours
-- 3. No-show Prediction: Patients with varying no-show rates
-- 4. Load Balancing: Doctors with different utilization levels
-- 5. Greedy Slot Search: Available slots for booking
-- ============================================================================
