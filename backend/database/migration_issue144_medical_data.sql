-- Issue #144: Complete Prescription & Vitals Services
-- Migration: Add new columns for enhanced medical data management

-- ═══════════════════════════════════════════════════
-- 1. patient_vitals: Add SpO2 (oxygen saturation) column
-- ═══════════════════════════════════════════════════
ALTER TABLE patient_vitals ADD COLUMN IF NOT EXISTS spo2 INT DEFAULT NULL COMMENT 'Oxygen saturation percentage (50-100)';

-- ═══════════════════════════════════════════════════
-- 2. prescriptions: Add structured prescription fields
-- ═══════════════════════════════════════════════════

-- Dosage field (e.g., "500mg", "10ml")
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dosage VARCHAR(500) DEFAULT NULL COMMENT 'Medication dosage';

-- Frequency field (e.g., "twice daily", "every 8 hours")
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS frequency VARCHAR(200) DEFAULT NULL COMMENT 'Medication frequency';

-- Duration in days
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT NULL COMMENT 'Treatment duration in days';

-- Refill tracking
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills_remaining INT DEFAULT 0 COMMENT 'Number of refills remaining (0-12)';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refill_date DATETIME DEFAULT NULL COMMENT 'Date of last refill';

-- Active/inactive status for prescription lifecycle
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether the prescription is currently active';

-- ═══════════════════════════════════════════════════
-- 3. Indexes for performance
-- ═══════════════════════════════════════════════════
-- Speeds up trend queries that filter by patient + date range
CREATE INDEX IF NOT EXISTS idx_vitals_patient_date ON patient_vitals(patient_id, recorded_at);

-- Speeds up active prescription lookups
CREATE INDEX IF NOT EXISTS idx_rx_patient_active ON prescriptions(patient_id, is_active);

-- ═══════════════════════════════════════════════════
-- 4. Update existing seed data (make prescriptions active)
-- ═══════════════════════════════════════════════════
UPDATE prescriptions SET is_active = TRUE WHERE is_active IS NULL;
