-- Issue #38: Push/SMS Notifications System
-- Tables for managing notification preferences and delivery tracking

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    
    -- Channel preferences
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    email_enabled BOOLEAN DEFAULT TRUE,
    
    -- Notification types
    queue_updates BOOLEAN DEFAULT TRUE,           -- Position changes, turn approaching
    appointment_reminders BOOLEAN DEFAULT TRUE,   -- 24h, 1h before appointment
    delay_alerts BOOLEAN DEFAULT TRUE,            -- Doctor running behind
    waitlist_offers BOOLEAN DEFAULT TRUE,         -- Slot availability from waitlist
    cancellation_confirm BOOLEAN DEFAULT TRUE,    -- Cancellation confirmations
    
    -- Timing preferences
    reminder_24h BOOLEAN DEFAULT TRUE,
    reminder_1h BOOLEAN DEFAULT TRUE,
    reminder_30m BOOLEAN DEFAULT TRUE,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_start TIME DEFAULT '22:00:00',
    quiet_end TIME DEFAULT '08:00:00',
    
    -- Push subscription data (for web push)
    push_subscription JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_prefs (user_id)
);

-- Notification delivery log
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    
    -- Notification details
    type ENUM('QUEUE_UPDATE', 'TURN_APPROACHING', 'YOUR_TURN', 'APPOINTMENT_REMINDER', 
              'DELAY_ALERT', 'WAITLIST_OFFER', 'CANCELLATION', 'GENERAL') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,  -- Additional context data
    
    -- Delivery status per channel
    push_sent BOOLEAN DEFAULT FALSE,
    push_delivered BOOLEAN DEFAULT FALSE,
    push_clicked BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    sms_delivered BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    
    -- Timing
    scheduled_for TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    
    -- Priority (affects delivery)
    priority ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') DEFAULT 'NORMAL',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id, created_at DESC),
    INDEX idx_notifications_type (type, created_at DESC)
);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) NOT NULL UNIQUE,
    title_template VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    push_title VARCHAR(100),
    push_body VARCHAR(255),
    sms_template VARCHAR(160),  -- SMS character limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default templates
INSERT INTO notification_templates (type, title_template, message_template, push_title, push_body, sms_template) VALUES
('TURN_APPROACHING', 
 'Your Turn is Approaching', 
 'You are {{position}} in the queue for Dr. {{doctor_name}}. Estimated wait: {{wait_time}} minutes.',
 'Almost Your Turn!',
 'Position #{{position}} - {{wait_time}} min wait',
 'HealthQ: Position #{{position}} for Dr. {{doctor_name}}. ~{{wait_time}} min wait. Please be ready.'),

('YOUR_TURN',
 'It''s Your Turn!',
 'Please proceed to Room {{room}} for your appointment with Dr. {{doctor_name}}.',
 'Your Turn Now!',
 'Please proceed to {{room}}',
 'HealthQ: Your turn now! Go to {{room}} for Dr. {{doctor_name}}.'),

('QUEUE_UPDATE',
 'Queue Position Update',
 'Your position has changed to #{{position}} in Dr. {{doctor_name}}''s queue.',
 'Queue Update',
 'Now at position #{{position}}',
 'HealthQ: Queue update - you''re now #{{position}} for Dr. {{doctor_name}}.'),

('APPOINTMENT_REMINDER',
 'Appointment Reminder',
 'Reminder: Your appointment with Dr. {{doctor_name}} is {{time_until}}. Please arrive 10 minutes early.',
 'Appointment Soon',
 'Dr. {{doctor_name}} in {{time_until}}',
 'HealthQ: Appt with Dr. {{doctor_name}} {{time_until}}. Please arrive 10 min early.'),

('DELAY_ALERT',
 'Doctor Running Behind',
 'Dr. {{doctor_name}} is running approximately {{delay_mins}} minutes behind schedule. Your new estimated time is {{new_time}}.',
 'Delay Alert',
 'Dr. {{doctor_name}} delayed ~{{delay_mins}} min',
 'HealthQ: Dr. {{doctor_name}} delayed ~{{delay_mins}} min. New ETA: {{new_time}}.'),

('WAITLIST_OFFER',
 'Slot Available!',
 'A slot has opened up with Dr. {{doctor_name}} on {{date}} at {{time}}. Accept within {{expires_in}} minutes.',
 'Slot Available!',
 'Dr. {{doctor_name}} - {{date}} {{time}}',
 'HealthQ: Slot open! Dr. {{doctor_name}} {{date}} {{time}}. Reply YES to book. Expires in {{expires_in}}m.'),

('CANCELLATION',
 'Appointment Cancelled',
 'Your appointment with Dr. {{doctor_name}} on {{date}} has been cancelled.',
 'Appointment Cancelled',
 'Appt with Dr. {{doctor_name}} cancelled',
 'HealthQ: Your appt with Dr. {{doctor_name}} on {{date}} was cancelled.');

-- Initialize preferences for existing users
INSERT IGNORE INTO notification_preferences (user_id)
SELECT id FROM users;
