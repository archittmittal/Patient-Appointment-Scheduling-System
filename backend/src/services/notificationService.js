/**
 * Issue #38: Notification Service
 * Handles sending notifications via Push, SMS, and Email channels
 * 
 * Note: For production, configure the following environment variables:
 * - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (SMS)
 * - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (Web Push)
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (Email)
 */

const pool = require('../config/db');

// Web Push (optional - requires npm install web-push)
let webpush;
try {
    webpush = require('web-push');
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
            'mailto:notifications@healthq.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
    }
} catch (e) {
    console.log('Web Push not configured - push notifications will be logged only');
}

// Twilio (optional - requires npm install twilio)
let twilioClient;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
} catch (e) {
    console.log('Twilio not configured - SMS notifications will be logged only');
}

/**
 * Get notification templates
 */
async function getTemplate(type) {
    const [[template]] = await pool.query(
        'SELECT * FROM notification_templates WHERE type = ?',
        [type]
    );
    return template;
}

/**
 * Replace template variables with actual values
 */
function processTemplate(template, data) {
    if (!template) return template;
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
}

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId) {
    const [[prefs]] = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = ?',
        [userId]
    );
    
    // Return defaults if no preferences set
    if (!prefs) {
        return {
            push_enabled: true,
            sms_enabled: false,
            email_enabled: true,
            queue_updates: true,
            appointment_reminders: true,
            delay_alerts: true,
            waitlist_offers: true,
            cancellation_confirm: true,
            quiet_hours_enabled: false
        };
    }
    
    return prefs;
}

/**
 * Check if user is in quiet hours
 */
function isInQuietHours(prefs) {
    if (!prefs.quiet_hours_enabled) return false;
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);
    const quietStart = prefs.quiet_start;
    const quietEnd = prefs.quiet_end;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (quietStart > quietEnd) {
        return currentTime >= quietStart || currentTime <= quietEnd;
    }
    return currentTime >= quietStart && currentTime <= quietEnd;
}

/**
 * Map notification type to preference field
 */
function getPreferenceField(type) {
    const mapping = {
        'QUEUE_UPDATE': 'queue_updates',
        'TURN_APPROACHING': 'queue_updates',
        'YOUR_TURN': 'queue_updates',
        'APPOINTMENT_REMINDER': 'appointment_reminders',
        'DELAY_ALERT': 'delay_alerts',
        'WAITLIST_OFFER': 'waitlist_offers',
        'CANCELLATION': 'cancellation_confirm'
    };
    return mapping[type] || null;
}

/**
 * Send push notification
 */
async function sendPushNotification(subscription, title, body, data = {}) {
    if (!webpush || !subscription) {
        console.log('[Push Notification]', { title, body, data });
        return false;
    }
    
    try {
        const payload = JSON.stringify({
            title,
            body,
            icon: '/icons/notification-icon.png',
            badge: '/icons/badge-icon.png',
            data,
            actions: data.actions || []
        });
        
        await webpush.sendNotification(
            typeof subscription === 'string' ? JSON.parse(subscription) : subscription,
            payload
        );
        return true;
    } catch (error) {
        console.error('Push notification error:', error);
        return false;
    }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(phoneNumber, message) {
    if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
        console.log('[SMS Notification]', { to: phoneNumber, message });
        return false;
    }
    
    try {
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });
        return true;
    } catch (error) {
        console.error('SMS notification error:', error);
        return false;
    }
}

/**
 * Send email notification (placeholder - integrate with your email service)
 */
async function sendEmailNotification(email, subject, htmlBody) {
    // For production, integrate with nodemailer, SendGrid, etc.
    console.log('[Email Notification]', { to: email, subject, body: htmlBody.substring(0, 100) + '...' });
    return false;
}

/**
 * Main notification sending function
 */
async function sendNotification(userId, type, templateData, options = {}) {
    const { priority = 'NORMAL', scheduledFor = null, forceChannels = null } = options;
    
    // Get user preferences
    const prefs = await getUserPreferences(userId);
    
    // Check if this notification type is enabled
    const prefField = getPreferenceField(type);
    if (prefField && !prefs[prefField]) {
        return { success: false, reason: 'Notification type disabled by user' };
    }
    
    // Check quiet hours (except for URGENT priority)
    if (priority !== 'URGENT' && isInQuietHours(prefs)) {
        return { success: false, reason: 'User in quiet hours' };
    }
    
    // Get template
    const template = await getTemplate(type);
    if (!template) {
        return { success: false, reason: 'Template not found' };
    }
    
    // Process templates
    const title = processTemplate(template.title_template, templateData);
    const message = processTemplate(template.message_template, templateData);
    const pushTitle = processTemplate(template.push_title, templateData);
    const pushBody = processTemplate(template.push_body, templateData);
    const smsText = processTemplate(template.sms_template, templateData);
    
    // Get user details for contact info
    const [[user]] = await pool.query(
        'SELECT email, phone FROM users WHERE id = ?',
        [userId]
    );
    
    // Create notification record
    const [notifResult] = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data, priority, scheduled_for)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, type, title, message, JSON.stringify(templateData), priority, scheduledFor]
    );
    const notificationId = notifResult.insertId;
    
    // Determine which channels to use
    const channels = forceChannels || {
        push: prefs.push_enabled,
        sms: prefs.sms_enabled,
        email: prefs.email_enabled
    };
    
    const results = {
        notificationId,
        push: false,
        sms: false,
        email: false
    };
    
    // Send via each enabled channel
    if (channels.push && prefs.push_subscription) {
        results.push = await sendPushNotification(
            prefs.push_subscription,
            pushTitle,
            pushBody,
            { notificationId, type, ...templateData }
        );
        await pool.query(
            'UPDATE notifications SET push_sent = ? WHERE id = ?',
            [results.push, notificationId]
        );
    }
    
    if (channels.sms && user?.phone && smsText) {
        results.sms = await sendSMSNotification(user.phone, smsText);
        await pool.query(
            'UPDATE notifications SET sms_sent = ? WHERE id = ?',
            [results.sms, notificationId]
        );
    }
    
    if (channels.email && user?.email) {
        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">${title}</h2>
                <p style="color: #374151; line-height: 1.6;">${message}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                    This notification was sent by HealthQ. 
                    <a href="${process.env.APP_URL || 'http://localhost:5173'}/settings/notifications">Manage preferences</a>
                </p>
            </div>
        `;
        results.email = await sendEmailNotification(user.email, title, htmlBody);
        await pool.query(
            'UPDATE notifications SET email_sent = ? WHERE id = ?',
            [results.email, notificationId]
        );
    }
    
    // Update sent_at timestamp
    await pool.query(
        'UPDATE notifications SET sent_at = NOW() WHERE id = ?',
        [notificationId]
    );
    
    return { success: true, ...results };
}

/**
 * Update notification preferences
 */
async function updatePreferences(userId, preferences) {
    const fields = [];
    const values = [];
    
    const allowedFields = [
        'push_enabled', 'sms_enabled', 'email_enabled',
        'queue_updates', 'appointment_reminders', 'delay_alerts',
        'waitlist_offers', 'cancellation_confirm',
        'reminder_24h', 'reminder_1h', 'reminder_30m',
        'quiet_hours_enabled', 'quiet_start', 'quiet_end'
    ];
    
    for (const [key, value] of Object.entries(preferences)) {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }
    
    if (fields.length === 0) return { success: false };
    
    values.push(userId);
    
    await pool.query(
        `INSERT INTO notification_preferences (user_id, ${allowedFields.slice(0, fields.length).join(', ')})
         VALUES (?, ${fields.map(() => '?').join(', ').replace(/\? = \?/g, '?')})
         ON DUPLICATE KEY UPDATE ${fields.join(', ')}`,
        [userId, ...values.slice(0, -1), ...values.slice(0, -1)]  // Simplified - needs proper handling
    );
    
    // Simplified update
    await pool.query(
        `UPDATE notification_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
        values
    );
    
    return { success: true };
}

/**
 * Save push subscription
 */
async function savePushSubscription(userId, subscription) {
    await pool.query(
        `INSERT INTO notification_preferences (user_id, push_subscription)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE push_subscription = VALUES(push_subscription)`,
        [userId, JSON.stringify(subscription)]
    );
    return { success: true };
}

/**
 * Get user's notification history
 */
async function getNotificationHistory(userId, limit = 50) {
    const [notifications] = await pool.query(
        `SELECT id, type, title, message, priority, sent_at, read_at, 
                push_sent, sms_sent, email_sent
         FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [userId, limit]
    );
    return notifications;
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
    await pool.query(
        'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?',
        [notificationId, userId]
    );
    return { success: true };
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
    const [[result]] = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL',
        [userId]
    );
    return result.count;
}

// ============ Convenience functions for common notifications ============

/**
 * Notify patient that their turn is approaching
 */
async function notifyTurnApproaching(userId, position, doctorName, waitTime) {
    return sendNotification(userId, 'TURN_APPROACHING', {
        position,
        doctor_name: doctorName,
        wait_time: waitTime
    }, { priority: 'HIGH' });
}

/**
 * Notify patient it's their turn
 */
async function notifyYourTurn(userId, doctorName, room) {
    return sendNotification(userId, 'YOUR_TURN', {
        doctor_name: doctorName,
        room: room || 'the consultation room'
    }, { priority: 'URGENT' });
}

/**
 * Notify about queue position change
 */
async function notifyQueueUpdate(userId, position, doctorName) {
    return sendNotification(userId, 'QUEUE_UPDATE', {
        position,
        doctor_name: doctorName
    });
}

/**
 * Send appointment reminder
 */
async function notifyAppointmentReminder(userId, doctorName, timeUntil) {
    return sendNotification(userId, 'APPOINTMENT_REMINDER', {
        doctor_name: doctorName,
        time_until: timeUntil
    });
}

/**
 * Notify about doctor delay
 */
async function notifyDelay(userId, doctorName, delayMins, newTime) {
    return sendNotification(userId, 'DELAY_ALERT', {
        doctor_name: doctorName,
        delay_mins: delayMins,
        new_time: newTime
    }, { priority: 'HIGH' });
}

/**
 * Notify about waitlist slot offer
 */
async function notifyWaitlistOffer(userId, doctorName, date, time, expiresIn) {
    return sendNotification(userId, 'WAITLIST_OFFER', {
        doctor_name: doctorName,
        date,
        time,
        expires_in: expiresIn
    }, { priority: 'HIGH' });
}

/**
 * Notify about cancellation
 */
async function notifyCancellation(userId, doctorName, date) {
    return sendNotification(userId, 'CANCELLATION', {
        doctor_name: doctorName,
        date
    });
}

module.exports = {
    getUserPreferences,
    updatePreferences,
    savePushSubscription,
    sendNotification,
    getNotificationHistory,
    markAsRead,
    getUnreadCount,
    notifyTurnApproaching,
    notifyYourTurn,
    notifyQueueUpdate,
    notifyAppointmentReminder,
    notifyDelay,
    notifyWaitlistOffer,
    notifyCancellation
};
