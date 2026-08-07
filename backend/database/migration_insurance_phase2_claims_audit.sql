-- Migration for Issue #155: Insurance Verification System Phase 2
USE hospital_system;

-- 1. Claims Tracking Table
CREATE TABLE IF NOT EXISTS insurance_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_insurance_id INT NOT NULL,
    amount_billed DECIMAL(10, 2) NOT NULL,
    amount_covered DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'PENDING') DEFAULT 'PENDING',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (patient_insurance_id) REFERENCES patient_insurance(id) ON DELETE CASCADE
);

-- 2. PHI Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_accessed VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
