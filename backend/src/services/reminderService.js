const cron = require('node-cron');
const db = require('../config/db');
const notificationService = require('./notificationService');
const logger = require('../config/logger');

/**
 * Scheduled Reminder Service
 * Handles 24h and 1h pre-appointment notifications
 */
class ReminderService {
    constructor() {
        // Run every hour at minute 0
        this.hourlyTask = cron.schedule('0 * * * *', () => {
            logger.info('[Cron] Running hourly reminders check...');
            this.checkReminders();
        });
    }

    async checkReminders() {
        try {
            await this.send24hReminders();
            await this.send1hReminders();
        } catch (error) {
            logger.error('[ReminderService] Error checking reminders:', error);
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
        // BUG-005: was 'CONFIRMED' — statuses are stored lowercase at booking time

        const [appointments] = await db.query(query, [tomorrowStr]);
        
        for (const appt of appointments) {
            await notificationService.sendNotification(appt.id, 'APPOINTMENT_REMINDER', {
                doctor_name: appt.doctor_name,
                time_until: `tomorrow at ${appt.time_slot}`
            });
        }
    }

    async send1hReminders() {
        // Find appointments for today
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const twoHoursLater = new Date(now.getTime() + 120 * 60 * 1000);

        const query = `
            SELECT a.id, a.time_slot, p.first_name, p.phone, u.email, d.first_name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON p.id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_date = ? AND a.status = 'CONFIRMED'
        `;
        // BUG-005: was 'CONFIRMED' — statuses are stored lowercase at booking time

        const [appointments] = await db.query(query, [today]);

        for (const appt of appointments) {
            // Parse "10:00 AM" or "2:30 PM"
            const timeMatch = appt.time_slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!timeMatch) continue;

            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const ampm = timeMatch[3].toUpperCase();

            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            const apptTime = new Date();
            apptTime.setHours(hours, minutes, 0, 0);

            // If appt is between 1h and 2h from now (to avoid duplicate notifications if run hourly)
            // Or simpler: If it's in the next 75 minutes and hasn't been notified yet
            if (apptTime > oneHourLater && apptTime < twoHoursLater) {
                await notificationService.sendNotification(appt.id, 'APPOINTMENT_REMINDER', {
                    doctor_name: appt.doctor_name,
                    time_until: `in about 1 hour at ${appt.time_slot}`
                });
            }
        }
    }
}

module.exports = new ReminderService();
