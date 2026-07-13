-- Migration: Drop unique_booking constraint to allow multi-patient slots
-- Phase 2 — PR #4
ALTER TABLE appointments DROP INDEX unique_booking;
CREATE INDEX idx_appointments_doctor_date_slot ON appointments(doctor_id, appointment_date, time_slot);
