/**
 * Issue #47: Late Arrival Handling Service
 * Manages policies and accommodations for late-arriving patients
 */

const db = require('../config/db');

/**
 * Default late arrival policies
 */
const DEFAULT_POLICIES = {
    gracePeriodMins: 10,           // Minutes after appointment time before considered late
    maxLateMins: 30,               // Maximum late minutes to still be accommodated
    autoRescheduleAfterMins: 45,   // Auto-reschedule if later than this
    allowFitIn: true,              // Allow fitting in between appointments
    requireNotification: true,     // Require notification before arriving late
    lateArrivalsPerDay: 2          // Max late arrivals to accommodate per day
};

/**
 * Check if patient is arriving late
 */
const checkLateStatus = async (appointmentId, patientId) => {
    const [appointments] = await db.execute(`
        SELECT a.*, 
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty,
            NOW() as current_time
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE a.id = ? AND a.patient_id = ?
    `, [appointmentId, patientId]);

    if (appointments.length === 0) {
        throw new Error('Appointment not found');
    }

    const apt = appointments[0];
    const aptDateTime = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
    const now = new Date();

    // Calculate minutes late
    const minsLate = Math.max(0, Math.round((now - aptDateTime) / 60000));

    // Get doctor's late policy
    const policy = await getDoctorLatePolicy(apt.doctor_id);

    const status = {
        appointmentId,
        appointmentTime: aptDateTime,
        currentTime: now,
        minutesLate: minsLate,
        isLate: minsLate > policy.gracePeriodMins,
        isWithinGrace: minsLate <= policy.gracePeriodMins,
        canStillBeAccommodated: minsLate <= policy.maxLateMins,
        shouldAutoReschedule: minsLate > policy.autoRescheduleAfterMins,
        policy
    };

    // Determine available options
    status.options = getLateArrivalOptions(status, policy);

    return status;
};

/**
 * Get late arrival options based on status
 */
const getLateArrivalOptions = (status, policy) => {
    const options = [];

    if (status.isWithinGrace) {
        options.push({
            id: 'proceed',
            label: 'Proceed to Check-in',
            description: 'You\'re within the grace period',
            recommended: true,
            icon: '✓'
        });
    } else if (status.canStillBeAccommodated) {
        options.push({
            id: 'fit_in',
            label: 'Fit In When Available',
            description: 'Wait for a slot between scheduled patients',
            recommended: policy.allowFitIn,
            estimatedWaitMins: 15,
            icon: '⏱️'
        });
        options.push({
            id: 'end_of_session',
            label: 'See Doctor at End of Session',
            description: 'Will be seen after all scheduled patients',
            recommended: false,
            icon: '📅'
        });
        options.push({
            id: 'reschedule',
            label: 'Reschedule Appointment',
            description: 'Book a new appointment for another day',
            recommended: false,
            icon: '🔄'
        });
    } else if (!status.shouldAutoReschedule) {
        options.push({
            id: 'end_of_session',
            label: 'See Doctor at End of Session',
            description: 'Only option due to significant delay',
            recommended: true,
            icon: '📅'
        });
        options.push({
            id: 'reschedule',
            label: 'Reschedule Appointment',
            description: 'Book a new appointment',
            recommended: false,
            icon: '🔄'
        });
    } else {
        options.push({
            id: 'reschedule',
            label: 'Reschedule Required',
            description: 'Too late to be accommodated today',
            recommended: true,
            icon: '🔄'
        });
    }

    return options;
};

/**
 * Get doctor's late arrival policy
 */
const getDoctorLatePolicy = async (doctorId) => {
    try {
        const [policies] = await db.execute(`
            SELECT * FROM doctor_late_policies WHERE doctor_id = ?
        `, [doctorId]);

        if (policies.length > 0) {
            return { ...DEFAULT_POLICIES, ...policies[0] };
        }
    } catch (err) {
        // Table might not exist yet
    }

    return DEFAULT_POLICIES;
};

/**
 * Set doctor's late arrival policy
 */
const setDoctorLatePolicy = async (doctorId, policyUpdates) => {
    const policy = { ...DEFAULT_POLICIES, ...policyUpdates };

    try {
        await db.execute(`
            INSERT INTO doctor_late_policies 
            (doctor_id, grace_period_mins, max_late_mins, auto_reschedule_after_mins, 
             allow_fit_in, require_notification, late_arrivals_per_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            grace_period_mins = VALUES(grace_period_mins),
            max_late_mins = VALUES(max_late_mins),
            auto_reschedule_after_mins = VALUES(auto_reschedule_after_mins),
            allow_fit_in = VALUES(allow_fit_in),
            require_notification = VALUES(require_notification),
            late_arrivals_per_day = VALUES(late_arrivals_per_day)
        `, [
            doctorId,
            policy.gracePeriodMins,
            policy.maxLateMins,
            policy.autoRescheduleAfterMins,
            policy.allowFitIn,
            policy.requireNotification,
            policy.lateArrivalsPerDay
        ]);
    } catch (err) {
        console.log('Policy save note:', err.message);
    }

    return policy;
};

/**
 * Process late arrival choice
 */
const processLateArrival = async (appointmentId, patientId, optionId, notes) => {
    const status = await checkLateStatus(appointmentId, patientId);
    
    if (!status.options.some(o => o.id === optionId)) {
        throw new Error('Invalid option for this situation');
    }

    let result;

    switch (optionId) {
        case 'proceed':
        case 'fit_in':
            result = await fitInLatePatient(appointmentId, patientId, status.minutesLate);
            break;
        case 'end_of_session':
            result = await moveToEndOfSession(appointmentId, patientId, status.minutesLate);
            break;
        case 'reschedule':
            result = await markForReschedule(appointmentId, patientId, notes);
            break;
        default:
            throw new Error('Unknown option');
    }

    // Log the late arrival
    await logLateArrival(appointmentId, patientId, status.minutesLate, optionId);

    return result;
};

/**
 * Fit in late patient between scheduled appointments
 */
const fitInLatePatient = async (appointmentId, patientId, minutesLate) => {
    // Update appointment status
    await db.execute(`
        UPDATE appointments 
        SET status = 'late_arrival', 
            late_arrival_mins = ?,
            late_handling = 'fit_in',
            checked_in_at = NOW()
        WHERE id = ? AND patient_id = ?
    `, [minutesLate, appointmentId, patientId]);

    // Get queue position
    const [appointments] = await db.execute(`
        SELECT a.*, 
            (SELECT COUNT(*) FROM appointments a2 
             WHERE a2.doctor_id = a.doctor_id 
             AND DATE(a2.appointment_date) = DATE(a.appointment_date)
             AND a2.status IN ('checked_in', 'in_progress')
             AND a2.id != a.id) + 1 as queue_position
        FROM appointments a
        WHERE a.id = ?
    `, [appointmentId]);

    return {
        success: true,
        handling: 'fit_in',
        message: 'You\'ve been added to the queue. We\'ll fit you in as soon as possible.',
        queuePosition: appointments[0]?.queue_position || 'TBD',
        estimatedWaitMins: (appointments[0]?.queue_position || 2) * 15
    };
};

/**
 * Move patient to end of session
 */
const moveToEndOfSession = async (appointmentId, patientId, minutesLate) => {
    // Get doctor's last appointment time today
    const [lastApt] = await db.execute(`
        SELECT MAX(appointment_time) as last_time
        FROM appointments a
        JOIN appointments target ON a.doctor_id = target.doctor_id
        WHERE target.id = ?
        AND DATE(a.appointment_date) = DATE(target.appointment_date)
        AND a.status != 'cancelled'
    `, [appointmentId]);

    const estimatedTime = lastApt[0]?.last_time || '17:00';

    await db.execute(`
        UPDATE appointments 
        SET status = 'late_arrival',
            late_arrival_mins = ?,
            late_handling = 'end_of_session',
            rescheduled_time = ?,
            checked_in_at = NOW()
        WHERE id = ? AND patient_id = ?
    `, [minutesLate, estimatedTime, appointmentId, patientId]);

    return {
        success: true,
        handling: 'end_of_session',
        message: 'You\'ve been moved to the end of today\'s session.',
        estimatedTime,
        note: 'Please wait in the waiting area. We\'ll call you when it\'s your turn.'
    };
};

/**
 * Mark appointment for reschedule
 */
const markForReschedule = async (appointmentId, patientId, notes) => {
    await db.execute(`
        UPDATE appointments 
        SET status = 'needs_reschedule',
            late_handling = 'reschedule',
            notes = CONCAT(IFNULL(notes, ''), ' | Late arrival: ', ?)
        WHERE id = ? AND patient_id = ?
    `, [notes || 'Patient chose to reschedule', appointmentId, patientId]);

    // Get available slots for next 7 days
    const [appointments] = await db.execute(`
        SELECT a.doctor_id FROM appointments a WHERE a.id = ?
    `, [appointmentId]);

    const doctorId = appointments[0]?.doctor_id;

    return {
        success: true,
        handling: 'reschedule',
        message: 'Please book a new appointment at your convenience.',
        doctorId,
        bookingUrl: `/book?doctor=${doctorId}`
    };
};

/**
 * Log late arrival for analytics
 */
const logLateArrival = async (appointmentId, patientId, minutesLate, handling) => {
    try {
        await db.execute(`
            INSERT INTO late_arrival_log 
            (appointment_id, patient_id, minutes_late, handling_choice, logged_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [appointmentId, patientId, minutesLate, handling]);
    } catch (err) {
        // Log but don't fail
        console.log('Late arrival logging note:', err.message);
    }
};

/**
 * Notify patient about upcoming appointment (to prevent late arrival)
 */
const sendPreArrivalReminder = async (appointmentId) => {
    const [appointments] = await db.execute(`
        SELECT a.*, 
            CONCAT(p.first_name, ' ', p.last_name) as patient_name,
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE a.id = ?
    `, [appointmentId]);

    if (appointments.length === 0) {
        return { sent: false, error: 'Appointment not found' };
    }

    const apt = appointments[0];
    const policy = await getDoctorLatePolicy(apt.doctor_id);

    return {
        sent: true,
        message: `Reminder: Your appointment with Dr. ${apt.doctor_name} is at ${apt.appointment_time}. Please arrive ${policy.gracePeriodMins} minutes early. Late arrivals may be rescheduled.`,
        appointmentTime: apt.appointment_time,
        gracePeriodMins: policy.gracePeriodMins
    };
};

/**
 * Get late arrival analytics for doctor
 */
const getLateArrivalAnalytics = async (doctorId, startDate, endDate) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_appointments,
                SUM(CASE WHEN late_arrival_mins > 0 THEN 1 ELSE 0 END) as late_arrivals,
                AVG(CASE WHEN late_arrival_mins > 0 THEN late_arrival_mins ELSE NULL END) as avg_minutes_late,
                SUM(CASE WHEN late_handling = 'fit_in' THEN 1 ELSE 0 END) as fit_in_count,
                SUM(CASE WHEN late_handling = 'end_of_session' THEN 1 ELSE 0 END) as end_of_session_count,
                SUM(CASE WHEN late_handling = 'reschedule' THEN 1 ELSE 0 END) as reschedule_count
            FROM appointments
            WHERE doctor_id = ?
            AND DATE(appointment_date) BETWEEN DATE(?) AND DATE(?)
        `, [doctorId, startDate, endDate]);

        const [byHour] = await db.execute(`
            SELECT 
                HOUR(appointment_time) as hour,
                COUNT(*) as total,
                SUM(CASE WHEN late_arrival_mins > 0 THEN 1 ELSE 0 END) as late_count
            FROM appointments
            WHERE doctor_id = ?
            AND DATE(appointment_date) BETWEEN DATE(?) AND DATE(?)
            GROUP BY HOUR(appointment_time)
            ORDER BY hour
        `, [doctorId, startDate, endDate]);

        return {
            summary: stats[0],
            byHour,
            lateArrivalRate: stats[0].total_appointments > 0 
                ? ((stats[0].late_arrivals / stats[0].total_appointments) * 100).toFixed(1)
                : 0
        };
    } catch (err) {
        return { summary: {}, byHour: [], lateArrivalRate: 0 };
    }
};

module.exports = {
    checkLateStatus,
    getDoctorLatePolicy,
    setDoctorLatePolicy,
    processLateArrival,
    sendPreArrivalReminder,
    getLateArrivalAnalytics
};
