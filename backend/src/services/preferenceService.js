const pool = require('../config/db');

/**
 * Handles user notification preferences
 */
class PreferenceService {
    constructor() {
        // Ensure methods are bound to this instance
        this.getUserPreferences = this.getUserPreferences.bind(this);
        this.isInQuietHours = this.isInQuietHours.bind(this);
        this.getPreferenceField = this.getPreferenceField.bind(this);
        this.updatePreferences = this.updatePreferences.bind(this);
        this.savePushSubscription = this.savePushSubscription.bind(this);
    }

    /**
     * Get user notification preferences
     */
    async getUserPreferences(userId) {
        const [prefsRows] = await pool.query(
            'SELECT * FROM notification_preferences WHERE user_id = ?',
            [userId]
        );
        const prefs = prefsRows[0];
        
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
    isInQuietHours(prefs) {
        if (!prefs.quiet_hours_enabled) return false;
        
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);
        const quietStart = prefs.quiet_start;
        const quietEnd = prefs.quiet_end;
        
        if (quietStart > quietEnd) {
            return currentTime >= quietStart || currentTime <= quietEnd;
        }
        return currentTime >= quietStart && currentTime <= quietEnd;
    }

    /**
     * Map notification type to preference field
     */
    getPreferenceField(type) {
        const mapping = {
            'QUEUE_UPDATE': 'queue_updates',
            'TURN_APPROACHING': 'queue_updates',
            'YOUR_TURN': 'queue_updates',
            'APPOINTMENT_REMINDER': 'appointment_reminders',
            'DELAY_ALERT': 'delay_alerts',
            'WAITLIST_OFFER': 'waitlist_offers',
            'CANCELLATION': 'cancellation_confirm',
            'MISSED': 'queue_updates',
            'EMERGENCY_ALERT': 'queue_updates'
        };
        return mapping[type] || null;
    }

    /**
     * Update notification preferences
     */
    async updatePreferences(userId, preferences) {
        const allowedFields = [
            'push_enabled', 'sms_enabled', 'email_enabled',
            'queue_updates', 'appointment_reminders', 'delay_alerts',
            'waitlist_offers', 'cancellation_confirm',
            'reminder_24h', 'reminder_1h', 'reminder_30m',
            'quiet_hours_enabled', 'quiet_start', 'quiet_end'
        ];
        
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(preferences)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) return { success: false };
        
        values.push(userId);
        
        await pool.query(
            `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );
        
        return { success: true };
    }

    /**
     * Save push subscription
     */
    async savePushSubscription(userId, subscription) {
        await pool.query(
            `INSERT INTO notification_preferences (user_id, push_subscription)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE push_subscription = VALUES(push_subscription)`,
            [userId, JSON.stringify(subscription)]
        );
        return { success: true };
    }
}

module.exports = new PreferenceService();
