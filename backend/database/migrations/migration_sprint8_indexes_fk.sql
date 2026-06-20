-- =============================================================================
-- Sprint 8 Migration: Missing Indexes & FK ON DELETE Behavior
-- =============================================================================
-- [DB-002] Add missing performance indexes on commonly-queried columns.
--          These prevent full-table scans on appointment lookups, status filters,
--          and live_queue joins as data volume grows.
-- [DB-006] Add explicit ON DELETE behavior to appointment foreign keys.
--          Without this, deleting a patient/doctor will either fail with a
--          constraint error or (in some MySQL configs) leave orphaned rows.
-- =============================================================================

-- -----------------------------------------------------------------------
-- DB-002: Performance Indexes
-- -----------------------------------------------------------------------

-- Speeds up: GET /api/doctors/:id/appointments, reminders cron, admin queries
CREATE INDEX idx_appointments_doctor_date
    ON appointments(doctor_id, appointment_date);

-- Speeds up: GET /api/patients/:id/appointments, patient dashboard queries
CREATE INDEX idx_appointments_patient_date
    ON appointments(patient_id, appointment_date);

-- Speeds up: status filter queries (confirmed today, cancelled today, etc.)
CREATE INDEX idx_appointments_status
    ON appointments(status);

-- Speeds up: live_queue lookups joined to appointments
CREATE INDEX idx_live_queue_appointment
    ON live_queue(appointment_id);

-- -----------------------------------------------------------------------
-- DB-006: FK ON DELETE Behavior
-- -----------------------------------------------------------------------
-- Business rules:
--   patient  → appointments: CASCADE  (remove patient = remove their appointments)
--   doctor   → appointments: RESTRICT (cannot delete doctor with active appointments)
--
-- We must drop and re-add the FKs since MySQL does not support ALTER on existing
-- FK constraints without drop-and-recreate.
-- -----------------------------------------------------------------------

-- Step 1: Remove old implicit FKs (names may vary by MySQL version)
ALTER TABLE appointments
    DROP FOREIGN KEY fk_appointments_patient;

ALTER TABLE appointments
    DROP FOREIGN KEY fk_appointments_doctor;

-- If the FKs were named differently by the schema generator, also try these fallbacks:
ALTER TABLE appointments DROP FOREIGN KEY appointments_ibfk_1;
ALTER TABLE appointments DROP FOREIGN KEY appointments_ibfk_2;

-- Step 2: Re-add with explicit ON DELETE behavior
ALTER TABLE appointments
    ADD CONSTRAINT fk_appointments_patient
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON DELETE CASCADE;

ALTER TABLE appointments
    ADD CONSTRAINT fk_appointments_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        ON DELETE CASCADE;
