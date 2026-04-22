/**
 * Notification Service (Orchestrator)
 * Central hub for sending notifications by coordinating templates, transports, and preferences.
 */

const pool = require('../config/db');
const templateService = require('./templateService');
const transportService = require('./transportService');
const preferenceService = require('./preferenceService');

/**
 * Main notification sending function
 */
async function sendNotification(userId, type, templateData, options = {}) {
    const { priority = 'NORMAL', scheduledFor = null, forceChannels = null } = options;
    
    // 1. Get user preferences
    const prefs = await preferenceService.getUserPreferences(userId);
    
    // 2. Check if this notification type is enabled
    const prefField = preferenceService.getPreferenceField(type);
    if (prefField && !prefs[prefField]) {
        return { success: false, reason: 'Notification type disabled by user' };
    }
    
    // 3. Check quiet hours (except for URGENT priority)
    if (priority !== 'URGENT' && preferenceService.isInQuietHours(prefs)) {
        return { success: false, reason: 'User in quiet hours' };
    }
    
    // 4. Get and process template
    const template = await templateService.getTemplate(type);
    if (!template) {
        return { success: false, reason: 'Template not found' };
    }
    
    const title = templateService.processTemplate(template.title_template, templateData);
    const message = templateService.processTemplate(template.message_template, templateData);
    const pushTitle = templateService.processTemplate(template.push_title, templateData);
    const pushBody = templateService.processTemplate(template.push_body, templateData);
    const smsText = templateService.processTemplate(template.sms_template, templateData);
    
    // 5. Get user details for contact info
    const [[user]] = await pool.query(
        'SELECT email, phone FROM users WHERE id = ?',
        [userId]
    );
    
    // 6. Create notification record
    const [notifResult] = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data, priority, scheduled_for)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, type, title, message, JSON.stringify(templateData), priority, scheduledFor]
    );
    const notificationId = notifResult.insertId;
    
    // 7. Determine channels
    const channels = forceChannels || {
        push: prefs.push_enabled,
        sms: prefs.sms_enabled,
        email: prefs.email_enabled
    };
    
    const results = { notificationId, push: false, sms: false, email: false };
    
    // 8. Send via each enabled channel
    if (channels.push && prefs.push_subscription) {
        results.push = await transportService.sendPush(
            prefs.push_subscription,
            pushTitle,
            pushBody,
            { notificationId, type, ...templateData }
        );
        await pool.query('UPDATE notifications SET push_sent = ? WHERE id = ?', [results.push, notificationId]);
    }
    
    if (channels.sms && user?.phone && smsText) {
        results.sms = await transportService.sendSMS(user.phone, smsText);
        await pool.query('UPDATE notifications SET sms_sent = ? WHERE id = ?', [results.sms, notificationId]);
    }
    
    if (channels.email && user?.email) {
        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">${title}</h2>
                <p style="color: #374151; line-height: 1.6;">${message}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                    This notification was sent by HealthSync. 
                    <a href="${process.env.APP_URL || 'http://localhost:5173'}/settings/notifications">Manage preferences</a>
                </p>
            </div>
        `;
        results.email = await transportService.sendEmail(user.email, title, htmlBody);
        await pool.query('UPDATE notifications SET email_sent = ? WHERE id = ?', [results.email, notificationId]);
    }
    
    // 9. Final update
    await pool.query('UPDATE notifications SET sent_at = NOW() WHERE id = ?', [notificationId]);
    
    return { success: true, ...results };
}

// ============ Convenience functions ============

async function notifyTurnApproaching(userId, position, doctorName, waitTime) {
    return sendNotification(userId, 'TURN_APPROACHING', { position, doctor_name: doctorName, wait_time: waitTime }, { priority: 'HIGH' });
}

async function notifyYourTurn(userId, doctorName, room) {
    return sendNotification(userId, 'YOUR_TURN', { doctor_name: doctorName, room: room || 'the consultation room' }, { priority: 'URGENT' });
}

async function notifyQueueUpdate(userId, position, doctorName) {
    return sendNotification(userId, 'QUEUE_UPDATE', { position, doctor_name: doctorName });
}

async function notifyAppointmentReminder(userId, doctorName, timeUntil) {
    return sendNotification(userId, 'APPOINTMENT_REMINDER', { doctor_name: doctorName, time_until: timeUntil });
}

async function notifyDelay(userId, doctorName, delayMins, newTime) {
    return sendNotification(userId, 'DELAY_ALERT', { doctor_name: doctorName, delay_mins: delayMins, new_time: newTime }, { priority: 'HIGH' });
}

async function notifyWaitlistOffer(userId, doctorName, date, time, expiresIn) {
    return sendNotification(userId, 'WAITLIST_OFFER', { doctor_name: doctorName, date, time, expires_in: expiresIn }, { priority: 'HIGH' });
}

async function notifyCancellation(userId, doctorName, date) {
    return sendNotification(userId, 'CANCELLATION', { doctor_name: doctorName, date });
}

async function notifyMissed(userId, doctorName, position, shift) {
    return sendNotification(userId, 'MISSED', { doctor_name: doctorName, position, shift }, { priority: 'HIGH' });
}

async function notifyEmergency(doctorId, patientName, reason) {
    return sendNotification(doctorId, 'EMERGENCY_ALERT', { patient_name: patientName, reason: reason || 'Urgent attention required' }, { priority: 'URGENT' });
}

module.exports = {
    // Services
    getUserPreferences: preferenceService.getUserPreferences,
    updatePreferences: preferenceService.updatePreferences,
    savePushSubscription: preferenceService.savePushSubscription,
    
    // Core
    sendNotification,
    
    // Convenience
    notifyTurnApproaching,
    notifyYourTurn,
    notifyQueueUpdate,
    notifyAppointmentReminder,
    notifyDelay,
    notifyWaitlistOffer,
    notifyCancellation,
    notifyMissed,
    notifyEmergency,

    // Expose helpers if needed for testing
    getNotificationHistory: async (userId, limit = 50) => {
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [userId, limit]
        );
        return notifications;
    },
    markAsRead: async (notificationId, userId) => {
        await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [notificationId, userId]);
        return { success: true };
    },
    getUnreadCount: async (userId) => {
        const [[result]] = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
        return result.count;
    }
};
