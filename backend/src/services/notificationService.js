/**
 * Notification Service (Orchestrator)
 * Central hub for sending notifications by coordinating templates, transports, and preferences.
 */

const pool = require('../config/db');
const templateService = require('./templateService');
const transportService = require('./transportService');
const preferenceService = require('./preferenceService');
const historyService = require('./notificationHistoryService');

const FRONTEND_URL = process.env.FRONTEND_URL
    || process.env.APP_URL
    || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : null);

if (!FRONTEND_URL && process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL must be set in production');
}

class NotificationService {
    constructor() {
        // Expose preferences and history through this service for convenience
        this.getUserPreferences = preferenceService.getUserPreferences.bind(preferenceService);
        this.updatePreferences = preferenceService.updatePreferences.bind(preferenceService);
        this.savePushSubscription = preferenceService.savePushSubscription.bind(preferenceService);
        
        // Proxy history methods
        this.getNotificationHistory = historyService.getHistory.bind(historyService);
        this.markAsRead = historyService.markAsRead.bind(historyService);
        this.getUnreadCount = historyService.getUnreadCount.bind(historyService);

        // Ensure methods are bound to this instance
        this.sendNotification = this.sendNotification.bind(this);
        this.notifyTurnApproaching = this.notifyTurnApproaching.bind(this);
        this.notifyYourTurn = this.notifyYourTurn.bind(this);
        this.notifyQueueUpdate = this.notifyQueueUpdate.bind(this);
        this.notifyAppointmentReminder = this.notifyAppointmentReminder.bind(this);
        this.notifyDelay = this.notifyDelay.bind(this);
        this.notifyWaitlistOffer = this.notifyWaitlistOffer.bind(this);
        this.notifyCancellation = this.notifyCancellation.bind(this);
        this.notifyMissed = this.notifyMissed.bind(this);
        this.notifyEmergency = this.notifyEmergency.bind(this);
    }

    /**
     * Main notification sending function
     */
    async sendNotification(userId, type, templateData, options = {}) {
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
        
        // 5. Get user details for contact info (joining patients for phone number)
        const [userRows] = await pool.query(
            `SELECT u.email, p.phone 
             FROM users u 
             LEFT JOIN patients p ON u.id = p.id 
             WHERE u.id = ?`,
            [userId]
        );
        const user = userRows[0];
        
        // 6. Create notification record using history service
        const notificationId = await historyService.createRecord({
            userId, type, title, message, templateData, priority, scheduledFor
        });
        
        // 7. Determine channels
        const channels = forceChannels || {
            push: prefs.push_enabled,
            sms: prefs.sms_enabled,
            email: prefs.email_enabled
        };
        
        const results = { notificationId, push: false, sms: false, email: false };
        const updates = {};
        
        // 8. Send via each enabled channel
        if (channels.push && prefs.push_subscription) {
            results.push = await transportService.sendPush(
                prefs.push_subscription,
                pushTitle,
                pushBody,
                { notificationId, type, ...templateData }
            );
            updates.push_sent = results.push;
        }
        
        if (channels.sms && user?.phone && smsText) {
            results.sms = await transportService.sendSMS(user.phone, smsText);
            updates.sms_sent = results.sms;
        }
        
        if (channels.email && user?.email) {
            const htmlBody = this._generateEmailHtml(title, message);
            results.email = await transportService.sendEmail(user.email, title, htmlBody);
            updates.email_sent = results.email;
        }

        // 9. Batch update transport status and finalize
        await historyService.updateStatus(notificationId, updates);
        await historyService.finalizeSentAt(notificationId);
        
        return { success: true, ...results };
    }

    /**
     * Private helper for email HTML generation
     */
    _generateEmailHtml(title, message) {
        return `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f3f4f6; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">HealthSync</h1>
                </div>
                <div style="padding: 30px; background-color: white;">
                    <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
                    <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">${message}</p>
                    <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 6px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">
                            You are receiving this because of your appointment settings.
                        </p>
                    </div>
                </div>
                <div style="padding: 20px; background-color: #f3f4f6; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        © 2026 HealthSync Patient Portal. All rights reserved.
                        <br>
                        <a href="${FRONTEND_URL}/settings/notifications" style="color: #2563eb; text-decoration: none;">Notification Settings</a>
                    </p>
                </div>
            </div>
        `;
    }

    // ============ Convenience functions ============

    async notifyTurnApproaching(userId, position, doctorName, waitTime) {
        return this.sendNotification(userId, 'TURN_APPROACHING', { position, doctor_name: doctorName, wait_time: waitTime }, { priority: 'HIGH' });
    }

    async notifyYourTurn(userId, doctorName, room) {
        return this.sendNotification(userId, 'YOUR_TURN', { doctor_name: doctorName, room: room || 'the consultation room' }, { priority: 'URGENT' });
    }

    async notifyQueueUpdate(userId, position, doctorName) {
        return this.sendNotification(userId, 'QUEUE_UPDATE', { position, doctor_name: doctorName });
    }

    async notifyAppointmentReminder(userId, doctorName, timeUntil) {
        return this.sendNotification(userId, 'APPOINTMENT_REMINDER', { doctor_name: doctorName, time_until: timeUntil });
    }

    async notifyDelay(userId, doctorName, delayMins, newTime) {
        return this.sendNotification(userId, 'DELAY_ALERT', { doctor_name: doctorName, delay_mins: delayMins, new_time: newTime }, { priority: 'HIGH' });
    }

    async notifyWaitlistOffer(userId, doctorName, date, time, expiresIn) {
        return this.sendNotification(userId, 'WAITLIST_OFFER', { doctor_name: doctorName, date, time, expires_in: expiresIn }, { priority: 'HIGH' });
    }

    async notifyCancellation(userId, doctorName, date) {
        return this.sendNotification(userId, 'CANCELLATION', { doctor_name: doctorName, date });
    }

    async notifyMissed(userId, doctorName, position, shift) {
        return this.sendNotification(userId, 'MISSED', { doctor_name: doctorName, position, shift }, { priority: 'HIGH' });
    }

    async notifyEmergency(doctorId, patientName, reason) {
        return this.sendNotification(doctorId, 'EMERGENCY_ALERT', { patient_name: patientName, reason: reason || 'Urgent attention required' }, { priority: 'URGENT' });
    }
}

module.exports = new NotificationService();
