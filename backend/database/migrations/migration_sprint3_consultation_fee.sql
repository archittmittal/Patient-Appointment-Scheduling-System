-- Sprint 3 Migration: Add consultation_fee column to doctors table
-- This makes the fee variable per doctor instead of hardcoded in the payment service.
-- The column is NOT NULL with no default — all doctor records MUST have a fee set.

-- Step 1: Add the column with a temporary default for existing records
ALTER TABLE doctors ADD COLUMN consultation_fee DECIMAL(10, 2) NOT NULL DEFAULT 50.00 AFTER max_patients_per_slot;

-- Step 2: Set specific fees for existing mock doctors
UPDATE doctors SET consultation_fee = 150.00 WHERE id = 2;  -- Dr. Sarah Jenkins (Cardiologist)
UPDATE doctors SET consultation_fee = 75.00  WHERE id = 3;  -- Dr. Michael Chen (General Physician)

-- Step 3: Remove the default so all future inserts MUST supply a fee explicitly
ALTER TABLE doctors ALTER COLUMN consultation_fee DROP DEFAULT;
