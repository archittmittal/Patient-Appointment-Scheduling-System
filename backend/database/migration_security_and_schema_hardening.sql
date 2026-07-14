-- Migration: Sprint 2 Database Constraints & Indexes Hardening
-- Targets issues: DB-001 (Double Booking Constraint), DB-002 (Missing Indexes), DB-006 (FK ON DELETE CASCADE)

-- Temporarily disable foreign key checks to allow structure alterations and duplicates deletion
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop existing foreign keys to allow adding cascades and modifying tables
ALTER TABLE live_queue DROP FOREIGN KEY live_queue_ibfk_1;
ALTER TABLE appointments DROP FOREIGN KEY appointments_ibfk_1;
ALTER TABLE appointments DROP FOREIGN KEY appointments_ibfk_2;

-- 2. Add ON DELETE CASCADE to allow automatic cleanup of appointments and live queue
ALTER TABLE appointments ADD CONSTRAINT appointments_ibfk_1 FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD CONSTRAINT appointments_ibfk_2 FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
ALTER TABLE live_queue ADD CONSTRAINT live_queue_ibfk_1 FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- 3. Clean up existing duplicates in appointments table to avoid UNIQUE KEY constraint violation
-- Keeping only the booking with the lowest ID for each unique (doctor_id, appointment_date, time_slot)
DELETE a1 FROM appointments a1
INNER JOIN appointments a2 
ON a1.doctor_id = a2.doctor_id 
AND a1.appointment_date = a2.appointment_date 
AND a1.time_slot = a2.time_slot 
WHERE a1.id > a2.id;

-- 4. Add UNIQUE KEY to appointments to prevent future double bookings
ALTER TABLE appointments ADD UNIQUE KEY unique_booking (doctor_id, appointment_date, time_slot);

-- 5. Add high-efficiency indexes for frequently filtered queries
ALTER TABLE appointments ADD INDEX idx_appointments_doctor_date (doctor_id, appointment_date);
ALTER TABLE appointments ADD INDEX idx_appointments_patient_date (patient_id, appointment_date);
ALTER TABLE appointments ADD INDEX idx_appointments_status (status);
ALTER TABLE live_queue ADD INDEX idx_live_queue_appointment (appointment_id);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
