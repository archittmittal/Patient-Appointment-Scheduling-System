/**
 * Notification History Service
 * Handles persistence, state (read/unread), and retrieval of notifications.
 */

const pool = require('../config/db');

class NotificationHistoryService {
    /**
     * Get recent notifications for a user
     * @param {number} userId 
     * @param {number} limit 
     */
    async getHistory(userId, limit = 50) {
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [userId, limit]
        );
        return notifications;
    }

    /**
     * Mark a specific notification as read
     * @param {number} notificationId 
     * @param {number} userId 
     */
    async markAsRead(notificationId, userId) {
        await pool.query(
            'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', 
            [notificationId, userId]
        );
        return { success: true };
    }

    /**
     * Mark all unread notifications as read for a user
     * @param {number} userId 
     */
    async markAllAsRead(userId) {
        await pool.query(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
            [userId]
        );
        return { success: true };
    }

    /**
     * Get count of unread notifications
     * @param {number} userId 
     */
    async getUnreadCount(userId) {
        const [countRows] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL', 
            [userId]
        );
        return countRows[0]?.count || 0;
    }

    /**
     * Create a new notification record in history
     * @param {Object} data 
     */
    async createRecord({ userId, type, title, message, templateData, priority, scheduledFor }) {
        const [notifResult] = await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, data, priority, scheduled_for)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, type, title, message, JSON.stringify(templateData), priority, scheduledFor]
        );
        return notifResult.insertId;
    }

    /**
     * Update transport status for a notification
     * @param {number} notificationId 
     * @param {Object} updates { push_sent, sms_sent, email_sent }
     */
    async updateStatus(notificationId, updates) {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        
        if (fields.length === 0) return;
        
        values.push(notificationId);
        await pool.query(
            `UPDATE notifications SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    /**
     * Set the final sent_at timestamp
     * @param {number} notificationId 
     */
    async finalizeSentAt(notificationId) {
        await pool.query('UPDATE notifications SET sent_at = NOW() WHERE id = ?', [notificationId]);
    }
}

module.exports = new NotificationHistoryService();
