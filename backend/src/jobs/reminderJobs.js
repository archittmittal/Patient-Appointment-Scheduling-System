/**
 * Reminder Jobs
 * Scheduled tasks for sending appointment reminders.
 */

const cron = require('node-cron');
const db = require('../config/db');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

const cronStatus = {
    initialized: false,
    lastMorningRun: null,
    lastProximityRun: null
};

/**
 * Initializes all cron jobs
 */
const initCronJobs = () => {
    cronStatus.initialized = true;
    if (process.env.NODE_ENV === 'test') {
        logger.debug('[Cron] Skipping initialization in test environment.');
        return;
    }

    // 1. Morning Reminder Service (24h-ish)
    // Runs every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        cronStatus.lastMorningRun = new Date().toISOString();
        logger.info('[Cron] Running Morning Appointment Reminders...');
        try {
            // Find appointments for today
            const query = `
                SELECT a.id AS appt_id, a.patient_id, a.time_slot, d.first_name AS doctor_first, d.last_name AS doctor_last
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                WHERE a.appointment_date = CURDATE() 
                AND a.status = 'CONFIRMED'
                -- BUG-005: was 'CONFIRMED' — statuses are stored lowercase at booking time
            `;

            const [appointments] = await db.query(query);

            for (const appt of appointments) {
                await notificationService.notifyAppointmentReminder(
                    appt.patient_id,
                    `Dr. ${appt.doctor_first} ${appt.doctor_last}`,
                    `today at ${appt.time_slot}`
                );
            }
            logger.info('[Cron] Morning reminders execution complete', { count: appointments.length });
        } catch (error) {
            logger.error('[Cron Error] Morning reminders failed', { error });
        }
    });

    // 2. Proximity Reminder Service (1-hour before)
    // Runs every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        cronStatus.lastProximityRun = new Date().toISOString();
        logger.info('[Cron] Running 1-Hour Proximity Check...');
        try {
            const now = new Date();
            const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
            const ninetyMinsLater = new Date(now.getTime() + 90 * 60 * 1000);

            const query = `
                SELECT a.id AS appt_id, a.patient_id, a.time_slot, d.first_name AS doctor_first, d.last_name AS doctor_last
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                WHERE a.appointment_date = CURDATE()
                AND a.status = 'CONFIRMED'
                -- BUG-005: was 'CONFIRMED' — statuses are stored lowercase at booking time
            `;

            const [appointments] = await db.query(query);

            for (const appt of appointments) {
                // Parse time_slot (e.g., "10:00 AM")
                const timeMatch = appt.time_slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (!timeMatch) continue;

                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toUpperCase();

                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;

                const apptTime = new Date();
                apptTime.setHours(hours, minutes, 0, 0);

                // If appt is between 1h and 1.5h from now
                if (apptTime > oneHourLater && apptTime < ninetyMinsLater) {
                    // Check if already sent in the last 2 hours to prevent duplicates
                    const [prevNotif] = await db.query(`
                        SELECT id FROM notifications 
                        WHERE user_id = ? 
                        AND type = 'APPOINTMENT_REMINDER' 
                        AND data LIKE ?
                        AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)
                    `, [appt.patient_id, `%${appt.appt_id}%`]);

                    if (prevNotif.length === 0) {
                        await notificationService.notifyAppointmentReminder(
                            appt.patient_id,
                            `Dr. ${appt.doctor_first} ${appt.doctor_last}`,
                            `in about 1 hour at ${appt.time_slot}`
                        );
                    }
                }
            }
        } catch (error) {
            logger.error('[Cron Error] Proximity check failed', { error });
        }
    });

    logger.info('Cron Scheduler Initialized successfully');
};

const getCronStatus = () => cronStatus;

module.exports = { initCronJobs, getCronStatus };

