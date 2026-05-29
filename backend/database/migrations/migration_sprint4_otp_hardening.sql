-- =============================================================================
-- Sprint 4 Migration: OTP Hardening (SEC-006 + SEC-007)
-- Adds columns to support OTP failed-attempt tracking and account lockout.
-- =============================================================================

-- Step 1: Add OTP columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry DATETIME DEFAULT NULL;

-- Step 2: Add rate-limiting and lockout columns for [SEC-007]
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_otp_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_locked_until DATETIME DEFAULT NULL;
