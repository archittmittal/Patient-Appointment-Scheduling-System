-- Day 13: WhatsApp Notification Integration
-- Adds WhatsApp channel to notification preferences, history, and templates

-- 1. Add whatsapp_enabled preference column (defaults TRUE — opt-in for all existing users)
ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE
    AFTER email_enabled;

-- 2. Add whatsapp_sent tracking column to notification history
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE
    AFTER email_sent;

-- 3. Add whatsapp_template column to notification_templates
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS whatsapp_template TEXT NULL
    AFTER sms_template;

-- 4. Insert APPOINTMENT_BOOKED template (new type used by booking confirmation)
INSERT INTO notification_templates
    (type, title_template, message_template, push_title, push_body, sms_template, whatsapp_template)
VALUES
    ('APPOINTMENT_BOOKED',
     'Appointment Confirmed ✅',
     'Your appointment with Dr. {{doctor_name}} is confirmed for {{date}} at {{time_slot}}. Please arrive 10 minutes early.',
     'Appointment Confirmed',
     'Dr. {{doctor_name}} on {{date}} at {{time_slot}}',
     'HealthSync: Appt confirmed with Dr. {{doctor_name}} on {{date}} at {{time_slot}}. Arrive 10 min early.',
     '✅ *HealthSync Appointment Confirmed*\n\nDr. *{{doctor_name}}*\n📅 {{date}}\n🕐 {{time_slot}}\n\nPlease arrive 10 minutes early. Reply CANCEL to cancel your appointment.')
ON DUPLICATE KEY UPDATE
    whatsapp_template = VALUES(whatsapp_template);

-- 5. Update existing templates with WhatsApp-optimised rich text
UPDATE notification_templates SET whatsapp_template =
    '⏰ *Almost Your Turn!*\n\nYou are *#{{position}}* in the queue for *Dr. {{doctor_name}}*.\nEstimated wait: *{{wait_time}} minutes*.\n\nPlease be ready near the clinic.'
WHERE type = 'TURN_APPROACHING';

UPDATE notification_templates SET whatsapp_template =
    '🔔 *It'\''s Your Turn!*\n\nPlease proceed to *Room {{room}}* for your appointment with *Dr. {{doctor_name}}*.\n\nThe doctor is ready for you now.'
WHERE type = 'YOUR_TURN';

UPDATE notification_templates SET whatsapp_template =
    '📋 *Queue Update*\n\nYou are now *#{{position}}* in *Dr. {{doctor_name}}*'\''s queue.'
WHERE type = 'QUEUE_UPDATE';

UPDATE notification_templates SET whatsapp_template =
    '⏰ *Appointment Reminder*\n\nYour appointment with *Dr. {{doctor_name}}* is *{{time_until}}*.\n\nPlease arrive 10 minutes early.'
WHERE type = 'APPOINTMENT_REMINDER';

UPDATE notification_templates SET whatsapp_template =
    '⚠️ *Delay Alert*\n\n*Dr. {{doctor_name}}* is running approximately *{{delay_mins}} minutes* behind schedule.\nNew estimated time: *{{new_time}}*.\n\nWe apologise for the inconvenience.'
WHERE type = 'DELAY_ALERT';

UPDATE notification_templates SET whatsapp_template =
    '🎉 *Slot Available!*\n\nA slot has opened with *Dr. {{doctor_name}}* on *{{date}}* at *{{time}}*.\n\nAccept within *{{expires_in}} minutes* — first come, first served!'
WHERE type = 'WAITLIST_OFFER';

UPDATE notification_templates SET whatsapp_template =
    '❌ *Appointment Cancelled*\n\nYour appointment with *Dr. {{doctor_name}}* on *{{date}}* has been cancelled.\n\nVisit the HealthSync portal to rebook.'
WHERE type = 'CANCELLATION';

-- 6. Ensure existing users have whatsapp_enabled = TRUE (already handled by DEFAULT, but explicit for clarity)
UPDATE notification_preferences SET whatsapp_enabled = TRUE WHERE whatsapp_enabled IS NULL;
