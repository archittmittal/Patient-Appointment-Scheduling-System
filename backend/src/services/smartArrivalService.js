/**
 * Issue #37: Smart Arrival Time Service
 * Calculates optimal arrival time based on queue position, historical patterns, and buffer
 */

const pool = require('../config/db');

/**
 * Calculate smart arrival time for a patient's appointment
 */
async function calculateSmartArrival(appointmentId, options = {}) {
    const {
        bufferMinutes = 10,      // Safety buffer before expected turn
        includeTransit = false,  // Whether to factor in estimated transit time
        transitMinutes = 0       // User-provided transit time
    } = options;

    // Get appointment and queue details
    const [[appointment]] = await pool.query(`
        SELECT 
            a.id,
            a.appointment_date,
            a.time_slot,
            a.doctor_id,
            lq.queue_number,
            lq.status as queue_status,
            d.avg_consultation_time
        FROM appointments a
        LEFT JOIN live_queue lq ON a.id = lq.appointment_id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE a.id = ?
    `, [appointmentId]);

    if (!appointment) {
        return { error: 'Appointment not found' };
    }

    // Get doctor's historical consultation times
    const doctorStats = await getDoctorStats(appointment.doctor_id);
    const avgConsultTime = doctorStats.avgConsultationMins || 15;

    // Get current queue status for this doctor today
    const queueStatus = await getCurrentQueueStatus(appointment.doctor_id);
    
    // Calculate expected wait based on position
    const position = appointment.queue_number || 1;
    const patientsAhead = Math.max(0, position - queueStatus.currentPosition - 1);
    const estimatedWaitMins = patientsAhead * avgConsultTime;

    // Get historical delay patterns for this time of day
    const timeOfDay = getTimeOfDay(appointment.time_slot);
    const historicalDelay = await getHistoricalDelay(appointment.doctor_id, timeOfDay);

    // Calculate optimal arrival time
    const slotTime = parseTime(appointment.time_slot);
    const adjustedWait = estimatedWaitMins + historicalDelay;
    
    // Optimal arrival = slot time + adjusted wait - buffer - transit
    const arrivalOffset = adjustedWait - bufferMinutes - (includeTransit ? transitMinutes : 0);
    const optimalArrivalMins = Math.max(0, arrivalOffset); // Don't arrive before slot time if wait is short
    
    const optimalArrivalTime = addMinutes(slotTime, optimalArrivalMins - 15); // Default: 15 mins before slot + adjustments

    // Calculate time windows
    const earliestArrival = addMinutes(optimalArrivalTime, -10);
    const latestArrival = addMinutes(optimalArrivalTime, bufferMinutes);

    // Confidence score based on data availability
    const confidence = calculateConfidence(doctorStats, queueStatus, historicalDelay);

    return {
        appointmentId,
        appointmentDate: appointment.appointment_date,
        slotTime: appointment.time_slot,
        queuePosition: position,
        patientsAhead,
        
        // Time calculations
        avgConsultationMins: avgConsultTime,
        estimatedWaitMins,
        historicalDelayMins: historicalDelay,
        adjustedWaitMins: adjustedWait,
        
        // Arrival recommendations
        optimalArrivalTime: formatTime(optimalArrivalTime),
        earliestArrival: formatTime(earliestArrival),
        latestArrival: formatTime(latestArrival),
        bufferMinutes,
        
        // Status
        currentQueuePosition: queueStatus.currentPosition,
        isInProgress: queueStatus.isInProgress,
        confidence,
        
        // Human-readable message
        message: generateArrivalMessage(optimalArrivalTime, confidence, patientsAhead)
    };
}

/**
 * Get doctor's historical statistics
 */
async function getDoctorStats(doctorId) {
    // Get average consultation time from completed appointments
    const [[stats]] = await pool.query(`
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

    // Also get from doctors table as fallback
    const [[doctor]] = await pool.query(
        'SELECT avg_consultation_time FROM doctors WHERE id = ?',
        [doctorId]
    );

    return {
        totalAppointments: stats?.total_appointments || 0,
        avgConsultationMins: stats?.avg_consultation_mins || doctor?.avg_consultation_time || 15,
        stddevMins: stats?.stddev_mins || 5
    };
}

/**
 * Get current queue status for doctor today
 */
async function getCurrentQueueStatus(doctorId) {
    const [[current]] = await pool.query(`
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

    // Get total waiting
    const [[waiting]] = await pool.query(`
        SELECT COUNT(*) as count
        FROM live_queue lq
        JOIN appointments a ON lq.appointment_id = a.id
        WHERE a.doctor_id = ?
        AND a.appointment_date = CURDATE()
        AND lq.status = 'WAITING'
    `, [doctorId]);

    return {
        currentPosition: current?.queue_number || 0,
        isInProgress: !!current,
        waitingCount: waiting?.count || 0
    };
}

/**
 * Get historical delay patterns for time of day
 */
async function getHistoricalDelay(doctorId, timeOfDay) {
    // Calculate average delay from historical data
    const [[delays]] = await pool.query(`
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
        AND HOUR(a.time_slot) BETWEEN ? AND ?
        AND a.appointment_date > DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `, [doctorId, timeOfDay.startHour, timeOfDay.endHour]);

    return Math.max(0, delays?.avg_delay || 0);
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(doctorStats, queueStatus, historicalDelay) {
    let score = 50; // Base score

    // More historical data = higher confidence
    if (doctorStats.totalAppointments > 50) score += 20;
    else if (doctorStats.totalAppointments > 20) score += 10;

    // Lower variance = higher confidence
    if (doctorStats.stddevMins < 5) score += 15;
    else if (doctorStats.stddevMins < 10) score += 5;

    // Queue already in progress = more accurate
    if (queueStatus.isInProgress) score += 10;

    // Historical data available
    if (historicalDelay > 0) score += 5;

    return Math.min(100, Math.max(0, score));
}

/**
 * Helper: Get time of day category
 */
function getTimeOfDay(timeSlot) {
    const hour = parseInt(timeSlot?.split(':')[0] || '9');
    if (hour < 12) return { period: 'MORNING', startHour: 6, endHour: 11 };
    if (hour < 17) return { period: 'AFTERNOON', startHour: 12, endHour: 16 };
    return { period: 'EVENING', startHour: 17, endHour: 23 };
}

/**
 * Helper: Parse time string to minutes from midnight
 */
function parseTime(timeStr) {
    if (!timeStr) return 540; // Default 9:00 AM
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 540;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/**
 * Helper: Add minutes to time
 */
function addMinutes(timeMins, minutes) {
    return Math.max(0, Math.min(1439, timeMins + minutes)); // Cap at 23:59
}

/**
 * Helper: Format minutes to time string
 */
function formatTime(timeMins) {
    const hours = Math.floor(timeMins / 60);
    const mins = timeMins % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Generate human-readable arrival message
 */
function generateArrivalMessage(arrivalMins, confidence, patientsAhead) {
    const time = formatTime(arrivalMins);
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
async function getBatchSmartArrivals(doctorId) {
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
        const arrival = await calculateSmartArrival(apt.id);
        results.push(arrival);
    }

    return results;
}

module.exports = {
    calculateSmartArrival,
    getDoctorStats,
    getCurrentQueueStatus,
    getBatchSmartArrivals
};
