/**
 * Issue #37: Smart Arrival Time Service
 * Calculates optimal arrival time based on queue position, historical patterns, and buffer
 */

const pool = require('../config/db');

class SmartArrivalService {
    constructor() {
        // Ensure methods are bound to this instance
        this.calculateSmartArrival = this.calculateSmartArrival.bind(this);
        this.getDoctorStats = this.getDoctorStats.bind(this);
        this.getCurrentQueueStatus = this.getCurrentQueueStatus.bind(this);
        this.getHistoricalDelay = this.getHistoricalDelay.bind(this);
        this.calculateConfidence = this.calculateConfidence.bind(this);
        this.getTimeOfDay = this.getTimeOfDay.bind(this);
        this.parseTime = this.parseTime.bind(this);
        this.addMinutes = this.addMinutes.bind(this);
        this.formatTime = this.formatTime.bind(this);
        this.generateArrivalMessage = this.generateArrivalMessage.bind(this);
        this.getBatchSmartArrivals = this.getBatchSmartArrivals.bind(this);
    }

    /**
     * Calculate smart arrival time for a patient's appointment
     */
    async calculateSmartArrival(appointmentId, options = {}) {
        const {
            bufferMinutes = 10,      // Safety buffer before expected turn
            includeTransit = false,  // Whether to factor in estimated transit time
            transitMinutes = 0       // User-provided transit time
        } = options;

        // Get appointment and queue details
        const [appointmentRows] = await pool.query(`
            SELECT 
                a.id,
                a.appointment_date,
                a.time_slot,
                a.doctor_id,
                lq.queue_number,
                lq.status as queue_status
            FROM appointments a
            LEFT JOIN live_queue lq ON a.id = lq.appointment_id
            WHERE a.id = ?
        `, [appointmentId]);
        const appointment = appointmentRows[0];

        if (!appointment) {
            return { error: 'Appointment not found' };
        }

        // Get doctor's historical consultation times
        const doctorStats = await this.getDoctorStats(appointment.doctor_id);
        const avgConsultTime = doctorStats.avgConsultationMins || 15;

        // Get current queue status for this doctor today
        const queueStatus = await this.getCurrentQueueStatus(appointment.doctor_id);
        
        // Calculate actual patients ahead in queue (Waiting or In Progress)
        const [aheadRows] = await pool.query(`
            SELECT COUNT(*) as aheadCount
            FROM live_queue lq
            JOIN appointments a_ahead ON lq.appointment_id = a_ahead.id
            WHERE a_ahead.doctor_id = ? 
              AND a_ahead.appointment_date = CURDATE()
              AND lq.queue_number < ?
              AND lq.status IN ('WAITING', 'IN_PROGRESS')
        `, [appointment.doctor_id, appointment.queue_number]);
        const { aheadCount } = aheadRows[0] || {};

        const patientsAhead = aheadCount || 0;
        const estimatedWaitMins = patientsAhead * avgConsultTime;

        // Get historical delay patterns for this time of day
        const timeOfDay = this.getTimeOfDay(appointment.time_slot);
        const historicalDelay = await this.getHistoricalDelay(appointment.doctor_id, timeOfDay);

        // Calculate optimal arrival time
        const slotTime = this.parseTime(appointment.time_slot);
        const adjustedWait = estimatedWaitMins + historicalDelay;
        
        // Optimal arrival = slot time + adjusted wait - buffer - transit
        const arrivalOffset = adjustedWait - bufferMinutes - (includeTransit ? transitMinutes : 0);
        const optimalArrivalMins = Math.max(0, arrivalOffset); // Don't arrive before slot time if wait is short
        
        const optimalArrivalTime = this.addMinutes(slotTime, optimalArrivalMins - 15); // Default: 15 mins before slot + adjustments

        // Calculate time windows
        const earliestArrival = this.addMinutes(optimalArrivalTime, -10);
        const latestArrival = this.addMinutes(optimalArrivalTime, bufferMinutes);

        // Confidence score based on data availability
        const confidence = this.calculateConfidence(doctorStats, queueStatus, historicalDelay);

        return {
            appointmentId,
            appointmentDate: appointment.appointment_date,
            slotTime: appointment.time_slot,
            queuePosition: appointment.queue_number,
            patientsAhead,
            
            // Time calculations
            avgConsultationMins: avgConsultTime,
            estimatedWaitMins,
            historicalDelayMins: historicalDelay,
            adjustedWaitMins: adjustedWait,
            
            // Arrival recommendations
            optimalArrivalTime: this.formatTime(optimalArrivalTime),
            earliestArrival: this.formatTime(earliestArrival),
            latestArrival: this.formatTime(latestArrival),
            bufferMinutes,
            
            // Status
            currentQueuePosition: queueStatus.currentPosition,
            isInProgress: queueStatus.isInProgress,
            confidence,
            
            // Human-readable message
            message: this.generateArrivalMessage(optimalArrivalTime, confidence, patientsAhead)
        };
    }

    /**
     * Get doctor's historical statistics
     */
    async getDoctorStats(doctorId) {
        // Get average consultation time from completed appointments
        const [statsRows] = await pool.query(`
            SELECT 
                COUNT(*) as total_appointments,
                AVG(TIMESTAMPDIFF(MINUTE, 
                    COALESCE(consultation_start, check_in_time), 
                    COALESCE(consultation_end, updated_at)
                )) as avg_consultation_mins,
                STDDEV(TIMESTAMPDIFF(MINUTE, 
                    COALESCE(consultation_start, check_in_time), 
                    COALESCE(consultation_end, updated_at)
                )) as stddev_mins
            FROM appointments 
            WHERE doctor_id = ? 
            AND status = 'COMPLETED'
            AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [doctorId]);
        const stats = statsRows[0];

        // Also get from doctors table as fallback
        const [doctorRows] = await pool.query(
            'SELECT avg_consultation_time FROM doctors WHERE id = ?',
            [doctorId]
        );
        const doctor = doctorRows[0];

        return {
            totalAppointments: stats?.total_appointments || 0,
            avgConsultationMins: stats?.avg_consultation_mins || (doctor ? doctor.avg_consultation_time : 15),
            stddevMins: stats?.stddev_mins || 5
        };
    }

    /**
     * Get current queue status for doctor today
     */
    async getCurrentQueueStatus(doctorId) {
        const [currentRows] = await pool.query(`
            SELECT 
                lq.queue_number,
                lq.status
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ?
            AND a.appointment_date = CURDATE()
            AND lq.status = 'IN_PROGRESS'
            ORDER BY lq.queue_number ASC
            LIMIT 1
        `, [doctorId]);
        const current = currentRows[0];

        // Get total waiting
        const [waitingRows] = await pool.query(`
            SELECT COUNT(*) as count
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ?
            AND a.appointment_date = CURDATE()
            AND lq.status = 'WAITING'
        `, [doctorId]);
        const waiting = waitingRows[0];

        return {
            currentPosition: current?.queue_number || 0,
            isInProgress: !!current,
            waitingCount: waiting?.count || 0
        };
    }

    /**
     * Get historical delay patterns for time of day
     */
    async getHistoricalDelay(doctorId, timeOfDay) {
        // Calculate average delay from historical data
        const [delaysRows] = await pool.query(`
            SELECT AVG(
                CASE 
                    WHEN lq.actual_start_time IS NOT NULL 
                    THEN TIMESTAMPDIFF(MINUTE, a.time_slot, lq.actual_start_time)
                    ELSE 0 
                END
            ) as avg_delay
            FROM appointments a
            JOIN live_queue lq ON a.id = lq.appointment_id
            WHERE a.doctor_id = ?
            AND a.status = 'COMPLETED'
            AND CAST(SUBSTRING_INDEX(a.time_slot, ':', 1) AS UNSIGNED) BETWEEN ? AND ?
            AND a.appointment_date > DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `, [doctorId, timeOfDay.startHour, timeOfDay.endHour]);
        const delays = delaysRows[0];

        return Math.max(0, delays?.avg_delay || 0);
    }

    /**
     * Calculate confidence score (0-100)
     */
    calculateConfidence(doctorStats, queueStatus, historicalDelay) {
        let score = 50; // Base score

        if (doctorStats.totalAppointments > 50) score += 20;
        else if (doctorStats.totalAppointments > 20) score += 10;

        if (doctorStats.stddevMins < 5) score += 15;
        else if (doctorStats.stddevMins < 10) score += 5;

        if (queueStatus.isInProgress) score += 10;

        if (historicalDelay > 0) score += 5;

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Helper: Get time of day category
     */
    getTimeOfDay(timeSlot) {
        const hour = parseInt(timeSlot?.split(':')[0] || '9');
        if (hour < 12) return { period: 'MORNING', startHour: 6, endHour: 11 };
        if (hour < 17) return { period: 'AFTERNOON', startHour: 12, endHour: 16 };
        return { period: 'EVENING', startHour: 17, endHour: 23 };
    }

    /**
     * Helper: Parse time string to minutes from midnight
     */
    parseTime(timeStr) {
        if (!timeStr) return 540; // Default 9:00 AM
        const match = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!match) return 540;
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }

    /**
     * Helper: Add minutes to time
     */
    addMinutes(timeMins, minutes) {
        return Math.max(0, Math.min(1439, timeMins + minutes)); // Cap at 23:59
    }

    /**
     * Helper: Format minutes to time string
     */
    formatTime(timeMins) {
        const hours = Math.floor(timeMins / 60);
        const mins = timeMins % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    /**
     * Generate human-readable arrival message
     */
    generateArrivalMessage(arrivalMins, confidence, patientsAhead) {
        const time = this.formatTime(arrivalMins);
        const hour = Math.floor(arrivalMins / 60);
        const ampm = hour < 12 ? 'AM' : 'PM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const displayMins = String(arrivalMins % 60).padStart(2, '0');
        
        const timeDisplay = `${displayHour}:${displayMins} ${ampm}`;
        
        if (patientsAhead === 0) {
            return `You're next! Please arrive by ${timeDisplay} and proceed to the waiting area.`;
        } else if (patientsAhead <= 2) {
            return `Almost your turn! Arrive by ${timeDisplay}. ${patientsAhead} patient${patientsAhead > 1 ? 's' : ''} ahead.`;
        } else if (confidence >= 70) {
            return `Recommended arrival: ${timeDisplay}. ${patientsAhead} patients ahead of you.`;
        } else {
            return `Suggested arrival: ~${timeDisplay}. This is an estimate based on limited data.`;
        }
    }

    /**
     * Get smart arrival for all appointments in queue for a doctor today
     */
    async getBatchSmartArrivals(doctorId) {
        const [appointments] = await pool.query(`
            SELECT a.id
            FROM appointments a
            JOIN live_queue lq ON a.id = lq.appointment_id
            WHERE a.doctor_id = ?
            AND a.appointment_date = CURDATE()
            AND lq.status = 'WAITING'
            ORDER BY lq.queue_number ASC
        `, [doctorId]);

        const results = [];
        for (const apt of appointments) {
            const arrival = await this.calculateSmartArrival(apt.id);
            results.push(arrival);
        }

        return results;
    }
}

module.exports = new SmartArrivalService();
