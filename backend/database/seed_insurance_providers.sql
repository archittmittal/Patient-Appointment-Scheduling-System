-- Seed data for Insurance Providers
USE hospital_system;

INSERT IGNORE INTO insurance_providers (name, contact_email, api_endpoint, api_key_env_var) VALUES
('BlueCross BlueShield', 'support@bcbs.com', 'https://api.bcbs.com/v1/verify', 'BCBS_API_KEY'),
('Aetna', 'provider@aetna.com', 'https://api.aetna.com/v1/eligibility', 'AETNA_API_KEY'),
('Cigna', 'claims@cigna.com', 'https://api.cigna.com/v2/check', 'CIGNA_API_KEY'),
('UnitedHealthcare', 'verify@uhc.com', 'https://api.uhc.com/v1/status', 'UHC_API_KEY');
