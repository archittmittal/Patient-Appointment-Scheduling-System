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

CREATE INDEX idx_patient_insurance_patient_id ON patient_insurance(patient_id);
