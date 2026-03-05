/**
 * Delay Propagation Service
 * Issue #40: Doctor Delay Propagation and Cascade Notifications
 * 
 * Handles cascade updates when consultations run over expected time:
 * 1. Detects delays when consultation exceeds predicted duration
 * 2. Recalculates ETAs for all patients ahead in queue
 * 3. Notifies affected patients of updated wait times
 * 4. Tracks delay history for analytics
 */

const db = require('../config/db');

/**
 * Calculate current delay for a doctor based on active consultation
 * Returns delay in minutes (positive = behind schedule, negative = ahead)
 */
async function calculateCurrentDelay(doctorId, appointmentDate) {
    try {
        // Get the currently in-progress appointment
        const [[inProgress]] = await db.query(`
            SELECT a.id, a.consultation_start, a.predicted_duration_mins,
                   lq.queue_number, lq.predicted_duration
            FROM appointments a
            JOIN live_queue lq ON lq.appointment_id = a.id
            WHERE a.doctor_id = ? 
              AND a.appointment_date = ?
              AND lq.status = 'IN_PROGRESS'
            LIMIT 1
        `, [doctorId, appointmentDate]);

        if (!inProgress || !inProgress.consultation_start) {
            return { delayMins: 0, isDelayed: false };
        }

        const startTime = new Date(inProgress.consultation_start);
        const now = new Date();
        const elapsedMins = Math.round((now - startTime) / 60000);
        const expectedDuration = inProgress.predicted_duration || inProgress.predicted_duration_mins || 15;
        
        const delayMins = elapsedMins - expectedDuration;
        
        return {
            delayMins: Math.max(0, delayMins),
            isDelayed: delayMins > 2, // Consider delayed if >2 mins over
            elapsedMins,
            expectedDuration,
            inProgressAppointment: inProgress.id
        };
    } catch (error) {
        console.error('Error calculating delay:', error);
        return { delayMins: 0, isDelayed: false, error: error.message };
    }
}

/**
 * Propagate delay to all waiting patients and update their estimated times
 * Returns list of affected patients with their updated ETAs
 */
async function propagateDelayToQueue(doctorId, appointmentDate, delayMins) {
    try {
        // Get all waiting patients for this doctor today
        const [waitingPatients] = await db.query(`
            SELECT lq.id as queue_id, lq.appointment_id, lq.queue_number, 
                   lq.estimated_time, lq.predicted_duration,
                   a.patient_id, p.first_name, p.last_name, u.email,
                   patients.phone
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON p.id = u.id
            JOIN patients ON patients.id = p.id
            WHERE a.doctor_id = ? 
              AND a.appointment_date = ?
              AND lq.status = 'WAITING'
            ORDER BY lq.queue_number ASC
        `, [doctorId, appointmentDate]);

        if (waitingPatients.length === 0) {
            return { affected: 0, patients: [] };
        }

        const affectedPatients = [];
        
        // Calculate cumulative delay for each patient
        for (const patient of waitingPatients) {
            const originalETA = patient.estimated_time;
            const newETA = originalETA + delayMins;
            
            // Update the estimated time in database
            await db.query(
                'UPDATE live_queue SET estimated_time = ? WHERE id = ?',
                [newETA, patient.queue_id]
            );

            affectedPatients.push({
                queueId: patient.queue_id,
                appointmentId: patient.appointment_id,
                patientId: patient.patient_id,
                name: `${patient.first_name} ${patient.last_name}`,
                email: patient.email,
                phone: patient.phone,
                queueNumber: patient.queue_number,
                originalETA,
                newETA,
                delayAdded: delayMins
            });
        }

        return {
            affected: affectedPatients.length,
            patients: affectedPatients,
            delayMins
        };
    } catch (error) {
        console.error('Error propagating delay:', error);
        return { affected: 0, patients: [], error: error.message };
    }
}

/**
 * Record a manual delay input from doctor
 * Allows doctor to proactively inform about expected delay
 */
async function setManualDelay(doctorId, appointmentDate, delayMins, reason = '') {
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
        const propagationResult = await propagateDelayToQueue(doctorId, appointmentDate, delayMins);

        await conn.commit();

        return {
            success: true,
            ...propagationResult
        };
    } catch (error) {
        await conn.rollback();
        console.error('Error setting manual delay:', error);
        return { success: false, error: error.message };
    } finally {
        conn.release();
    }
}

/**
 * Get current delay status for a doctor
 */
async function getDelayStatus(doctorId, appointmentDate) {
    try {
        const currentDelay = await calculateCurrentDelay(doctorId, appointmentDate);
        
        // Also check if there's a manual delay set
        const [[manualDelay]] = await db.query(`
            SELECT delay_mins, reason, is_manual, updated_at
            FROM delay_history
            WHERE doctor_id = ? AND delay_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [doctorId, appointmentDate]);

        return {
            ...currentDelay,
            manualDelay: manualDelay || null,
            effectiveDelay: Math.max(currentDelay.delayMins, manualDelay?.delay_mins || 0)
        };
    } catch (error) {
        console.error('Error getting delay status:', error);
        return { delayMins: 0, isDelayed: false, error: error.message };
    }
}

/**
 * Check and auto-propagate delay if consultation is running over
 * Called periodically or on status check
 */
async function checkAndPropagateDelay(doctorId, appointmentDate) {
    try {
        const delayStatus = await getDelayStatus(doctorId, appointmentDate);
        
        if (delayStatus.isDelayed && delayStatus.delayMins > 0) {
            // Only propagate if delay is significant (> 5 mins)
            if (delayStatus.delayMins >= 5) {
                const result = await propagateDelayToQueue(doctorId, appointmentDate, delayStatus.delayMins);
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
        console.error('Error in auto delay propagation:', error);
        return { propagated: false, error: error.message };
    }
}

/**
 * Get delay analytics for a doctor over a time period
 */
async function getDelayAnalytics(doctorId, days = 30) {
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
        console.error('Error getting delay analytics:', error);
        return { summary: {}, dailyPattern: [] };
    }
}

module.exports = {
    calculateCurrentDelay,
    propagateDelayToQueue,
    setManualDelay,
    getDelayStatus,
    checkAndPropagateDelay,
    getDelayAnalytics
};
