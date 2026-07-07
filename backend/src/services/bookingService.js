const db = require('../config/db');
const {
    predictConsultationDuration,
    recalculateQueueEstimates
} = require('./durationPrediction');
const waitlistService = require('./waitlistService');
const { DEFAULT_PREDICTED_DURATION, DEFAULT_MAX_PATIENTS_PER_SLOT } = require('../config/constants');
const notificationService = require('./notificationService');
const logger = require('../config/logger');
const sseManager = require('./sseManager');

// Helper date functions
const toDateString = (dateVal) => {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        const y = dateVal.getUTCFullYear();
        const m = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(dateVal).split('T')[0].split(' ')[0];
};

const getTodayDateString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

async function bookAppointment({ doctorId, date, timeSlot, symptoms, patientId, reqUser }) {
    const formattedDate = toDateString(date);

    // Validate patient ID ownership and authorization
    if (reqUser.role !== 'PATIENT') {
        const [patientRows] = await db.query('SELECT id FROM users WHERE id = ? AND role = ?', [patientId, 'PATIENT']);
        if (patientRows.length === 0) {
            throw { status: 403, message: 'Invalid patient ID or unauthorized' };
        }
    }

    // Predict consultation duration using AI model
    let prediction;
    try {
        prediction = await predictConsultationDuration({
            doctorId,
            patientId,
            symptoms,
            timeSlot
        });
    } catch (predErr) {
        logger.error('Duration prediction failed, using defaults:', predErr.message);
        prediction = {
            predictedDuration: DEFAULT_PREDICTED_DURATION,
            factors: { isFollowUp: false, error: 'Prediction unavailable' }
        };
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Slot capacity check with FOR UPDATE lock
        const [docRows] = await conn.query('SELECT max_patients_per_slot, first_name, last_name FROM doctors WHERE id = ?', [doctorId]);
        if (docRows.length === 0) {
            throw { status: 404, message: 'Doctor not found' };
        }
        const maxPatients = docRows[0].max_patients_per_slot ?? DEFAULT_MAX_PATIENTS_PER_SLOT;
        const doctorName = `Dr. ${docRows[0].first_name} ${docRows[0].last_name}`.trim();

        const [slotRows] = await conn.query(
            `SELECT COUNT(*) AS slot_count 
             FROM appointments 
             WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'CANCELLED' 
             FOR UPDATE`,
            [doctorId, formattedDate, timeSlot]
        );

        if (slotRows[0].slot_count >= maxPatients) {
            throw { status: 409, message: 'Time slot is fully booked' };
        }

        // Insert appointment
        let result;
        try {
            [result] = await conn.query(
                'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status, predicted_duration_mins, is_follow_up) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [patientId, doctorId, formattedDate, timeSlot, symptoms || null, 'CONFIRMED', prediction.predictedDuration, prediction.factors.isFollowUp || false]
            );
        } catch (fullInsertErr) {
            if (fullInsertErr.code === 'ER_BAD_FIELD_ERROR' || (fullInsertErr.message && fullInsertErr.message.includes('Unknown column'))) {
                [result] = await conn.query(
                    'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [patientId, doctorId, formattedDate, timeSlot, symptoms || null, 'CONFIRMED']
                );
            } else {
                throw fullInsertErr;
            }
        }

        if (!result || !result.insertId) {
            throw new Error('Failed to create appointment record');
        }

        const appointmentId = result.insertId;

        // Add to live queue only if appointment is today
        let queueNumber = null;
        let estimatedWait = null;
        
        const [todayCheck] = await conn.query(
            'SELECT 1 FROM appointments WHERE id = ? AND appointment_date = CURDATE()',
            [appointmentId]
        );

        if (todayCheck.length > 0) {
            const [_rows1] = await conn.query(
                `SELECT MAX(lq.queue_number) AS maxQ
                 FROM live_queue lq
                 JOIN appointments a ON lq.appointment_id = a.id
                 WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()`,
                [doctorId]
            );
            queueNumber = (_rows1[0].maxQ || 0) + 1;

            const [waitResult] = await conn.query(
                'SELECT COALESCE(SUM(predicted_duration_mins), 0) AS total_wait FROM live_queue lq JOIN appointments a ON lq.appointment_id = a.id WHERE a.doctor_id = ? AND a.appointment_date = CURDATE() AND lq.status IN (\'WAITING\', \'IN_PROGRESS\')',
                [doctorId]
            );
            estimatedWait = waitResult[0]?.total_wait ?? 0;

            await conn.query(
                'INSERT INTO live_queue (appointment_id, queue_number, status, estimated_time) VALUES (?, ?, ?, ?)',
                [appointmentId, queueNumber, 'WAITING', estimatedWait]
            );
        }

        await conn.commit();

        // Side effects (non-blocking notification & SSE broadcasts)
        if (queueNumber !== null) {
            recalculateQueueEstimates(doctorId)
                .then(() => sseManager.broadcastToDoctor(doctorId, 'queue_update', { message: 'New patient checked in' }))
                .catch(err => logger.error('Recalculate estimates error:', err));
        }

        const [patientRows] = await db.query('SELECT phone FROM patients WHERE id = ?', [patientId]);
        const patientPhone = patientRows[0]?.phone;

        notificationService.notifyAppointmentBooked({
            patientId,
            doctorId,
            date: formattedDate,
            timeSlot,
            doctorName,
            patientPhone
        }).catch(err => logger.error('Notification error:', err));

        sseManager.broadcastToDoctor(doctorId, 'appointment_booked', { appointmentId, patientId, timeSlot });

        return {
            appointmentId,
            queueNumber,
            estimatedWaitMinutes: estimatedWait
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function cancelAppointment(appointmentId, reqUser) {
    const conn = await db.getConnection();
    try {
        // --- Pre-flight validation read (no transaction yet) ---
        const [preRows] = await conn.query(
            'SELECT status, appointment_date, patient_id FROM appointments WHERE id = ?',
            [appointmentId]
        );
        const preAppt = preRows[0];

        if (!preAppt) {
            throw { status: 404, message: 'Appointment not found' };
        }

        // SECURITY: Verify patient owns appointment
        if (reqUser.role === 'PATIENT' && reqUser.id !== preAppt.patient_id) {
            throw { status: 403, message: 'Access denied' };
        }

        // Patients may not cancel past appointments
        if (reqUser.role === 'PATIENT') {
            const todayStr = getTodayDateString();
            const apptDateStr = toDateString(preAppt.appointment_date);
            if (apptDateStr < todayStr) {
                throw { status: 400, message: 'Cannot cancel a past appointment' };
            }
        }

        if (!['CONFIRMED', 'PENDING', 'SCHEDULED'].includes(String(preAppt.status).toUpperCase())) {
            throw { status: 400, message: `Cannot cancel appointment with status ${preAppt.status}` };
        }

        // --- Transactional write path ---
        await conn.beginTransaction();

        // Re-read with FOR UPDATE lock
        const [apptRows] = await conn.query(
            'SELECT status, appointment_date FROM appointments WHERE id = ? FOR UPDATE',
            [appointmentId]
        );
        const appt = apptRows[0];

        if (!appt || !['CONFIRMED', 'PENDING', 'SCHEDULED'].includes(String(appt.status).toUpperCase())) {
            throw { status: 400, message: 'Appointment cannot be cancelled (status changed)' };
        }

        await conn.query(
            "UPDATE appointments SET status = 'CANCELLED' WHERE id = ?",
            [appointmentId]
        );

        const todayStr = getTodayDateString();
        const aptDate = toDateString(appt.appointment_date);
        if (aptDate === todayStr) {
            await conn.query(
                "UPDATE live_queue SET status = 'MISSED' WHERE appointment_id = ? AND status IN ('WAITING', 'IN_PROGRESS')",
                [appointmentId]
            );
        }

        await conn.commit();
        
        // Trigger auto-fill for cancellation
        waitlistService.handleSlotRelease(appointmentId, 'CANCELLATION')
            .catch(err => logger.error('Auto-fill error:', err));
            
        return { message: 'Appointment cancelled' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = {
    bookAppointment,
    cancelAppointment,
    toDateString,
    getTodayDateString
};
