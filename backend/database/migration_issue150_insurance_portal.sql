-- Migration for Issue #150: Smart Insurance Verification System
USE hospital_system;

-- 1. Insurance Providers Table
CREATE TABLE IF NOT EXISTS insurance_providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    api_endpoint VARCHAR(255),
    api_key_env_var VARCHAR(100), -- Reference to .env variable for security
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patient Insurance Table
CREATE TABLE IF NOT EXISTS patient_insurance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    provider_id INT NOT NULL,
    member_id VARCHAR(100) NOT NULL,
    group_id VARCHAR(100),
    plan_type VARCHAR(100),
    policy_holder_name VARCHAR(255),
    status ENUM('ACTIVE', 'EXPIRED', 'PENDING', 'VERIFIED') DEFAULT 'PENDING',
    last_verified_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES insurance_providers(id) ON DELETE CASCADE
);

-- Insert some mock insurance providers
INSERT IGNORE INTO insurance_providers (name, contact_email, api_endpoint, api_key_env_var) VALUES
('BlueCross BlueShield', 'support@bcbs.com', 'https://api.bcbs.com/v1/verify', 'BCBS_API_KEY'),
('Aetna', 'provider@aetna.com', 'https://api.aetna.com/v1/eligibility', 'AETNA_API_KEY'),
('Cigna', 'claims@cigna.com', 'https://api.cigna.com/v2/check', 'CIGNA_API_KEY'),
('UnitedHealthcare', 'verify@uhc.com', 'https://api.uhc.com/v1/status', 'UHC_API_KEY');
