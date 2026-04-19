-- Migration: Add Emergency Notification Support
-- Update notifications table type enum
ALTER TABLE notifications MODIFY COLUMN type ENUM('QUEUE_UPDATE', 'TURN_APPROACHING', 'YOUR_TURN', 'APPOINTMENT_REMINDER', 
              'DELAY_ALERT', 'WAITLIST_OFFER', 'CANCELLATION', 'GENERAL', 'EMERGENCY_ALERT') NOT NULL;

-- Insert Emergency Alert Template
INSERT INTO notification_templates (type, title_template, message_template, push_title, push_body, sms_template) VALUES
('EMERGENCY_ALERT',
 'EMERGENCY: New Patient Assigned',
 'URGENT: {{patient_name}} has been registered as an emergency override. Reason: {{reason}}. Immediate attention may be required.',
 'EMERGENCY ALERT',
 '{{patient_name}} - Urgent Attention Required',
 'HealthQ EMERGENCY: {{patient_name}} registered (Override). Reason: {{reason}}. Please check your dashboard immediately.');
