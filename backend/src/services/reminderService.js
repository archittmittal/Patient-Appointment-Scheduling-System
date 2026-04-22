const cron = require('node-cron');
const db = require('../config/db');
const notificationService = require('./notificationService');

/**
 * Scheduled Reminder Service
 * Handles 24h and 1h pre-appointment notifications
 */
class ReminderService {
    constructor() {
        // Run every hour at minute 0
        this.hourlyTask = cron.schedule('0 * * * *', () => {
            console.log('[Cron] Running hourly reminders check...');
            this.checkReminders();
        });
    }

    async checkReminders() {
        try {
            await this.send24hReminders();
            await this.send1hReminders();
        } catch (error) {
            console.error('[ReminderService] Error checking reminders:', error);
        }
    }

    async send24hReminders() {
        // Logic: Find appointments for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const query = `
            SELECT a.id, a.time_slot, p.first_name, p.phone, u.email, d.first_name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON p.id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_date = ? AND a.status = 'CONFIRMED'
        `;

        const [appointments] = await db.query(query, [tomorrowStr]);
        
        for (const appt of appointments) {
            await notificationService.sendNotification(appt.id, 'APPOINTMENT_REMINDER', {
                doctor_name: appt.doctor_name,
                time_until: `tomorrow at ${appt.time_slot}`
            });
        }
    }

    async send1hReminders() {
        // Logic: Find appointments for today that start in ~1 hour
        const today = new Date().toISOString().split('T')[0];
        const currentHour = new Date().getHours();
        const targetHour = (currentHour + 1) % 24;
        
        // This is tricky because time_slot is VARCHAR "10:00 AM"
        // We need to parse it or query for slots that match the target hour
        const targetHourStr = targetHour > 12 ? `${targetHour - 12}:` : targetHour === 0 ? '12:' : `${targetHour}:`;
        const ampm = targetHour >= 12 ? 'PM' : 'AM';
        const searchPattern = `%${targetHourStr}%${ampm}%`;

        const query = `
            SELECT a.id, a.time_slot, p.first_name, p.phone, u.email, d.first_name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON p.id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_date = ? AND a.status = 'CONFIRMED' AND a.time_slot LIKE ?
        `;

        const [appointments] = await db.query(query, [today, searchPattern]);

        for (const appt of appointments) {
            await notificationService.sendNotification(appt.id, 'APPOINTMENT_REMINDER', {
                doctor_name: appt.doctor_name,
                time_until: `in 1 hour at ${appt.time_slot}`
            });
        }
    }
}

module.exports = new ReminderService();
