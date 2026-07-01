const db = require('../config/db');
const logger = require('../config/logger');

class DelayPropagationService {
    constructor() {
        // Ensure methods are bound to this instance
        this.calculateCurrentDelay = this.calculateCurrentDelay.bind(this);
        this.propagateDelayToQueue = this.propagateDelayToQueue.bind(this);
        this.setManualDelay = this.setManualDelay.bind(this);
        this.getDelayStatus = this.getDelayStatus.bind(this);
        this.checkAndPropagateDelay = this.checkAndPropagateDelay.bind(this);
        this.getDelayAnalytics = this.getDelayAnalytics.bind(this);
    }

    /**
     * Calculate current delay for a doctor based on active consultation
     * Returns delay in minutes (positive = behind schedule, negative = ahead)
     */
    async calculateCurrentDelay(doctorId, appointmentDate) {
        try {
            // Get the currently in-progress appointment
            const [inProgressRows] = await db.query(`
                SELECT id, time_slot, actual_start_time, scheduled_duration_mins
                FROM appointments
                WHERE doctor_id = ? AND appointment_date = ? AND status = 'IN_PROGRESS'
                LIMIT 1
            `, [doctorId, appointmentDate]);

            const inProgress = inProgressRows[0];
            if (!inProgress) {
                return { delayMins: 0, isDelayed: false };
            }

            // Calculate elapsed time vs expected duration
            const startTime = new Date(inProgress.actual_start_time);
            const now = new Date();
            const elapsedMins = Math.floor((now - startTime) / (1000 * 60));
            const expectedDuration = inProgress.scheduled_duration_mins || 15; // default 15m

            const delayMins = elapsedMins - expectedDuration;

            return {
                delayMins: Math.max(0, delayMins),
                isDelayed: delayMins > 2, // Consider delayed if >2 mins over
                elapsedMins,
                expectedDuration,
                inProgressAppointment: inProgress.id
            };
        } catch (error) {
            logger.error('Error calculating delay:', error);
            return { delayMins: 0, isDelayed: false, error: error.message };
        }
    }

    /**
     * Propagate delay to all waiting patients and update their estimated times
     * Returns list of affected patients with their updated ETAs
     */
    async propagateDelayToQueue(doctorId, appointmentDate, delayMins) {
        try {
            // Get all waiting/checked-in patients for the day
            const [waitingAppointments] = await db.query(`
                SELECT id, patient_id, time_slot, estimated_start_time, status
                FROM appointments
                WHERE doctor_id = ? AND appointment_date = ? AND status IN ('PENDING', 'CHECKED_IN', 'IN_PROGRESS')
                ORDER BY queue_position ASC, time_slot ASC
            `, [doctorId, appointmentDate]);

            const affectedPatients = [];

            for (const appt of waitingAppointments) {
                // If the appointment is PENDING or CHECKED_IN, we shift the estimated start time
                if (appt.status !== 'IN_PROGRESS') {
                    const currentEst = new Date(appt.estimated_start_time);
                    const newEst = new Date(currentEst.getTime() + delayMins * 60000);

                    await db.query(`
                        UPDATE appointments
                        SET estimated_start_time = ?
                        WHERE id = ?
                    `, [newEst, appt.id]);

                    affectedPatients.push({
                        appointmentId: appt.id,
                        patientId: appt.patient_id,
                        newEta: newEst
                    });
                }
            }

            return {
                affected: affectedPatients.length,
                patients: affectedPatients,
                delayMins
            };
        } catch (error) {
            logger.error('Error propagating delay:', error);
            return { affected: 0, patients: [], error: error.message };
        }
    }

    /**
     * Record a manual delay input from doctor
     * Allows doctor to proactively inform about expected delay
     */
    async setManualDelay(doctorId, appointmentDate, delayMins, reason = '') {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // Insert into delay history
            await conn.query(`
                INSERT INTO delay_history (doctor_id, delay_date, delay_mins, reason, is_manual, created_at)
                VALUES (?, ?, ?, ?, TRUE, NOW())
                ON DUPLICATE KEY UPDATE delay_mins = ?, reason = ?, updated_at = NOW()
            `, [doctorId, appointmentDate, delayMins, reason, delayMins, reason]);

            // Propagate the delay to all waiting patients
            const propagationResult = await this.propagateDelayToQueue(doctorId, appointmentDate, delayMins);

            await conn.commit();

            return {
                success: true,
                ...propagationResult
            };
        } catch (error) {
            await conn.rollback();
            logger.error('Error setting manual delay:', error);
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }

    /**
     * Get current delay status for a doctor
     */
    async getDelayStatus(doctorId, appointmentDate) {
        try {
            const currentDelay = await this.calculateCurrentDelay(doctorId, appointmentDate);
            
            // Also check if there's a manual delay set
            const [manualDelayRows] = await db.query(`
                SELECT delay_mins, reason, is_manual, updated_at
                FROM delay_history
                WHERE doctor_id = ? AND delay_date = ?
                ORDER BY created_at DESC
                LIMIT 1
            `, [doctorId, appointmentDate]);
            const manualDelay = manualDelayRows[0];

            return {
                ...currentDelay,
                manualDelay: manualDelay || null,
                effectiveDelay: Math.max(currentDelay.delayMins, manualDelay?.delay_mins || 0)
            };
        } catch (error) {
            logger.error('Error getting delay status:', error);
            return { delayMins: 0, isDelayed: false, error: error.message };
        }
    }

    /**
     * Check and auto-propagate delay if consultation is running over
     * Called periodically or on status check
     */
    async checkAndPropagateDelay(doctorId, appointmentDate) {
        try {
            const delayStatus = await this.getDelayStatus(doctorId, appointmentDate);
            
            if (delayStatus.isDelayed && delayStatus.delayMins > 0) {
                // Only propagate if delay is significant (> 5 mins)
                if (delayStatus.delayMins >= 5) {
                    const result = await this.propagateDelayToQueue(doctorId, appointmentDate, delayStatus.delayMins);
                    return {
                        propagated: true,
                        ...result,
                        delayStatus
                    };
                }
            }
            
            return {
                propagated: false,
                delayStatus
            };
        } catch (error) {
            logger.error('Error in auto delay propagation:', error);
            return { propagated: false, error: error.message };
        }
    }

    /**
     * Get delay analytics for a doctor over a time period
     */
    async getDelayAnalytics(doctorId, days = 30) {
        try {
            const [analytics] = await db.query(`
                SELECT 
                    COUNT(*) as total_delays,
                    AVG(delay_mins) as avg_delay,
                    MAX(delay_mins) as max_delay,
                    SUM(CASE WHEN is_manual THEN 1 ELSE 0 END) as manual_delays,
                    SUM(CASE WHEN delay_mins > 15 THEN 1 ELSE 0 END) as significant_delays
                FROM delay_history
                WHERE doctor_id = ? AND delay_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            `, [doctorId, days]);

            const [dailyPattern] = await db.query(`
                SELECT 
                    DAYOFWEEK(delay_date) as day_of_week,
                    AVG(delay_mins) as avg_delay,
                    COUNT(*) as count
                FROM delay_history
                WHERE doctor_id = ? AND delay_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DAYOFWEEK(delay_date)
                ORDER BY day_of_week
            `, [doctorId, days]);

            return {
                summary: analytics[0] || {},
                dailyPattern
            };
        } catch (error) {
            logger.error('Error getting delay analytics:', error);
            return { summary: {}, dailyPattern: [] };
        }
    }
}

module.exports = new DelayPropagationService();