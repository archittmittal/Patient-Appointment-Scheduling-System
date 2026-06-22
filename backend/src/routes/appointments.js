const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { safeErrorMessage } = require('../middleware/errorHandler');
const { authenticate, authenticateSse, requireRole } = require('../middleware/authenticate');
const {
    predictConsultationDuration,
    recordConsultationDuration,
    calculateQueueWaitTime,
    recalculateQueueEstimates
} = require('../services/durationPrediction');
const waitlistService = require('../services/waitlistService');
const smartArrivalService = require('../services/smartArrivalService');
const prescriptionService = require('../services/prescriptionService');
const vitalsService = require('../services/vitalsService');
const exportService = require('../services/exportService');
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const sseManager = require('../services/sseManager');
const virtualCheckinService = require('../services/virtualCheckinService');
const { DEFAULT_PREDICTED_DURATION, DEFAULT_MAX_PATIENTS_PER_SLOT } = require('../config/constants');

function parseStartHourMinute(timeStr) {
    if (!timeStr) return null;
    const rangeParts = timeStr.split(/[–\-—]/);
    const startPart = rangeParts[0].trim();
    const ampmMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1], 10);
        const minutes = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return { hours, minutes };
    }
    const simpleMatch = startPart.match(/(\d+):(\d+)/);
    if (simpleMatch) {
        const hours = parseInt(simpleMatch[1], 10);
        const minutes = parseInt(simpleMatch[2], 10);
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            return { hours, minutes };
        }
    }
    return null;
}

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

const bookSchema = Joi.object({
    doctorId: Joi.number().required(),
    patientId: Joi.number().integer().positive().optional(),
    date: Joi.string().isoDate().required().custom((value, helpers) => {
        const todayStr = getTodayDateString();
        const inputDateStr = toDateString(value);
        if (inputDateStr < todayStr) {
            return helpers.message('Cannot book appointments in the past');
        }
        return value;
    }),
    timeSlot: Joi.string().required(),
    symptoms: Joi.string().allow('', null)
});

const predictDurationQuerySchema = Joi.object({
    doctorId: Joi.number().required(),
    patientId: Joi.number().allow(null),
    symptoms: Joi.string().allow('', null),
    timeSlot: Joi.string().allow('', null)
});

const joinWaitlistSchema = Joi.object({
    doctorId: Joi.number().required(),
    preferredDate: Joi.string().isoDate().required(),
    timePreference: Joi.string().valid('MORNING', 'AFTERNOON', 'EVENING', 'ANY').default('ANY'),
    maxNoticeHours: Joi.number().integer().min(1).max(72).default(24),
    reason: Joi.string().max(255).allow('', null)
});

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment management and booking
 */

/**
 * @swagger
 * /api/appointments/book:
 *   post:
 *     summary: Book a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *               - date
 *               - timeSlot
 *             properties:
 *               doctorId:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *               timeSlot:
 *                 type: string
 *               symptoms:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment booked successfully
 *       400:
 *         description: Invalid input
 */
router.post('/book', authenticate, validateRequest(bookSchema), async (req, res) => {
    try {
        const { doctorId, date, timeSlot, symptoms } = req.body;
        const formattedDate = toDateString(date);
        const patientId = req.user.role === 'PATIENT' ? req.user.id : req.body.patientId;

        // Validate that if appointment date is today, the slot starting time is in the future
        const todayStr = getTodayDateString();
        if (formattedDate === todayStr) {
            const parsedTime = parseStartHourMinute(timeSlot);
            if (parsedTime) {
                const slotTime = new Date();
                slotTime.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
                if (slotTime < new Date()) {
                    return res.status(400).json({ message: 'Cannot book a time slot that has already passed today' });
                }
            }
        }

        if (!patientId) {
            return res.status(400).json({ message: 'Patient ID is required' });
        }

        // Validate patient ID ownership and authorization (BUG-006)
        if (req.user.role !== 'PATIENT') {
            const [patientRows] = await db.query('SELECT id FROM users WHERE id = ? AND role = ?', [patientId, 'PATIENT']);
            if (patientRows.length === 0) {
                return res.status(403).json({ message: 'Invalid patient ID or unauthorized' });
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
            console.error('Duration prediction failed, using defaults:', predErr.message);
            prediction = {
                predictedDuration: DEFAULT_PREDICTED_DURATION,
                factors: { isFollowUp: false, error: 'Prediction unavailable' }
            };
        }

        let conn = null;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            // BUG-001 & DB-004: Slot capacity check with FOR UPDATE lock
            const [docRows] = await conn.query('SELECT max_patients_per_slot FROM doctors WHERE id = ?', [doctorId]);
            if (docRows.length === 0) {
                await conn.rollback();
                return res.status(404).json({ message: 'Doctor not found' });
            }
            const maxPatients = docRows[0].max_patients_per_slot ?? DEFAULT_MAX_PATIENTS_PER_SLOT;

            const [slotRows] = await conn.query(
                `SELECT COUNT(*) AS slot_count 
                 FROM appointments 
                 WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'CANCELLED' 
                 FOR UPDATE`,
                [doctorId, formattedDate, timeSlot]
            );

            if (slotRows[0].slot_count >= maxPatients) {
                await conn.rollback();
                return res.status(409).json({ message: 'Time slot is fully booked' });
            }

            // Insert appointment — use UPPERCASE status
            let result;
            try {
                [result] = await conn.query(
                    'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status, predicted_duration_mins, is_follow_up) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [patientId, doctorId, formattedDate, timeSlot, symptoms || null, 'CONFIRMED', prediction.predictedDuration, prediction.factors.isFollowUp || false]
                );
            } catch (fullInsertErr) {
                // If the error is about unknown columns (predicted_duration_mins / is_follow_up), try a simpler INSERT
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

            // Add to live queue only if appointment is today
            let queueNumber = null;
            let estimatedWait = null;
            
            const [todayCheck] = await conn.query(
                'SELECT 1 FROM appointments WHERE id = ? AND appointment_date = CURDATE()',
                [result.insertId]
            );

            if (todayCheck.length > 0) {
                const [_rows1] = await conn.query(
                    `SELECT MAX(lq.queue_number) AS maxQ
                     FROM live_queue lq
                     JOIN appointments a ON lq.appointment_id = a.id
                     WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()`,
                    [doctorId]
                );
                const { maxQ } = _rows1[0] || {};
                queueNumber = (maxQ || 0) + 1;
                
                // Calculate actual wait time based on AI predictions for patients ahead
                const waitInfo = await calculateQueueWaitTime(result.insertId);
                estimatedWait = waitInfo.estimatedWait || (queueNumber - 1) * prediction.predictedDuration;
                
                await conn.query(
                    'INSERT INTO live_queue (appointment_id, queue_number, status, estimated_time, predicted_duration) VALUES (?, ?, ?, ?, ?)',
                    [result.insertId, queueNumber, 'WAITING', estimatedWait, prediction.predictedDuration]
                );
            }

            await conn.commit();

            res.status(201).json({ 
                message: 'Appointment booked successfully', 
                appointmentId: result.insertId, 
                queueNumber,
                predictedDuration: prediction.predictedDuration,
                estimatedWait,
                predictionFactors: prediction.factors
            });
        } catch (error) {
            if (conn) await conn.rollback();
            throw error;
        } finally {
            if (conn) conn.release();
        }
    } catch (error) {
        console.error('BOOKING_ERROR:', error);
        res.status(500).json({ message: 'Server error booking appointment' });
    }
});

// GET /api/appointments/predict-duration — predict duration for given parameters (without booking)
router.get('/predict-duration', authenticate, validateRequest(predictDurationQuerySchema, 'query'), async (req, res) => {
    try {
        const { doctorId, patientId, symptoms, timeSlot } = req.query;

        const prediction = await predictConsultationDuration({
            doctorId: parseInt(doctorId),
            patientId: patientId ? parseInt(patientId) : null,
            symptoms: symptoms || '',
            timeSlot: timeSlot || ''
        });

        res.json(prediction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error predicting duration' });
    }
});

// GET /api/appointments/queue/:appointmentId
router.get('/queue/:appointmentId', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT lq.*, a.doctor_id, a.appointment_date, a.predicted_duration_mins, a.patient_id
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE lq.appointment_id = ?
        `, [req.params.appointmentId]);

        if (rows.length === 0) return res.status(404).json({ message: 'Queue data not found' });

        const entry = rows[0];

        // SECURITY: Verify patient owns appointment
        if (req.user.role === 'PATIENT' && req.user.id !== entry.patient_id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Calculate actual wait time using AI predictions
        const waitInfo = await calculateQueueWaitTime(req.params.appointmentId);

        // Find the token currently IN_PROGRESS for this doctor today
        const [inProgressRows] = await db.query(`
            SELECT lq.queue_number FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status = 'IN_PROGRESS'
            ORDER BY lq.queue_number ASC LIMIT 1
        `, [entry.doctor_id, entry.appointment_date]);
        const inProgress = inProgressRows[0];

        const currentToken = inProgress ? inProgress.queue_number : 0;

        // Full queue sequence for this doctor today with predicted durations
        const [sequence] = await db.query(`
            SELECT lq.id AS queue_id, lq.queue_number AS number,
                   CONCAT(p.first_name, ' ', p.last_name) AS name,
                   lq.status, a.time_slot AS time,
                   lq.predicted_duration,
                   (lq.appointment_id = ?) AS isCurrent
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = ?
            ORDER BY lq.queue_number ASC
        `, [req.params.appointmentId, entry.doctor_id, entry.appointment_date]);

        // Obfuscate names for other patients
        const processedSequence = sequence.map(r => ({
            ...r,
            name: (r.isCurrent || req.user.role === 'DOCTOR' || req.user.role === 'ADMIN') ? r.name : 'Patient'
        }));

        res.json({
            ...entry,
            currentToken,
            queueSequence: processedSequence,
            estimatedWaitMins: waitInfo.estimatedWait,
            patientsAhead: waitInfo.patientsAhead,
            predictedDuration: entry.predicted_duration || entry.predicted_duration_mins || DEFAULT_PREDICTED_DURATION
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/appointments/queue/:appointmentId/stream
router.get('/queue/:appointmentId/stream', authenticateSse, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        
        // Get initial data
        const [rows] = await db.query(`
            SELECT a.doctor_id, a.patient_id
            FROM appointments a WHERE a.id = ?
        `, [appointmentId]);
        
        if (rows.length === 0) return res.status(404).json({ message: 'Appointment not found' });
        const { doctor_id, patient_id } = rows[0];

        // SECURITY: Verify patient owns appointment
        if (req.user.role === 'PATIENT' && req.user.id !== patient_id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const connectionId = `queue-${appointmentId}-${Date.now()}`;
        sseManager.addClient(connectionId, res, { appointmentId, doctorId: doctor_id });

    } catch (error) {
        console.error('Queue SSE Error:', error);
        if (!res.headersSent) res.status(500).json({ message: 'SSE Connection Failed' });
    }
});

// GET /api/appointments/stream — establish SSE stream for doctor queue updates
router.get('/stream', authenticateSse, requireRole('DOCTOR'), async (req, res) => {
    try {
        const doctorId = parseInt(req.query.doctorId);
        if (!doctorId) {
            return res.status(400).json({ message: 'doctorId query parameter is required' });
        }

        // SECURITY: Verify doctor matches authenticated user
        if (req.user.role === 'DOCTOR' && req.user.id !== doctorId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const connectionId = `doctor-${doctorId}-${Date.now()}`;
        sseManager.addClient(connectionId, res, { doctorId });

    } catch (error) {
        console.error('Doctor SSE Error:', error);
        if (!res.headersSent) res.status(500).json({ message: 'SSE Connection Failed' });
    }
});

const notificationService = require('../services/notificationService');


const queueUpdateSchema = Joi.object({
    status: Joi.string().valid('WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED').required(),
    diagnosis: Joi.string().allow('', null),
    notes: Joi.string().allow('', null),
    prescription: Joi.string().allow('', null),
    follow_up_date: Joi.string().isoDate().allow('', null),
    vitals: Joi.object({
        weight_kg: Joi.number().min(1).max(500).allow(null),
        height_cm: Joi.number().min(20).max(300).allow(null),
        blood_pressure_sys: Joi.number().min(40).max(300).allow(null),
        blood_pressure_dia: Joi.number().min(30).max(200).allow(null),
        heart_rate: Joi.number().min(30).max(250).allow(null),
        temperature_c: Joi.number().min(30).max(45).allow(null)
    }).allow(null)
});

// PATCH /api/appointments/queue/:queueId/status — update a token's status (for doctor/assistant)
// When status is COMPLETED or MISSED, also syncs the parent appointments row so that
// admin views, patient history, and stats all reflect the real outcome (fixes D4).
// Now also records consultation duration for AI prediction training (Issue #48)
router.patch('/queue/:queueId/status', authenticate, requireRole('DOCTOR'), validateRequest(queueUpdateSchema), async (req, res) => {
    const status = (req.body.status || '').toUpperCase();
    const { diagnosis, notes, prescription, follow_up_date, vitals } = req.body;
    const validStatuses = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    let conn = null;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // Get appointment details for duration tracking and notifications
        const [queueRowRows] = await conn.query(`
            SELECT lq.appointment_id, lq.queue_number, a.doctor_id, a.patient_id, a.symptoms, 
                   a.appointment_date, a.consultation_start, a.is_follow_up,
                   d.first_name AS doc_first, d.last_name AS doc_last, d.location_room
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE lq.id = ?
        `, [req.params.queueId]);
        const queueRow = queueRowRows[0];

        if (!queueRow) {
            throw new Error('Queue entry not found');
        }

        // [BUG-010] Use strict equality with parseInt() to prevent string/number type mismatch
        if (parseInt(req.user.id) !== parseInt(queueRow.doctor_id)) {
            if (conn) await conn.rollback();
            return res.status(403).json({ message: 'You are not authorized to manage this queue' });
        }

        const doctorName = `Dr. ${queueRow.doc_first} ${queueRow.doc_last}`;

        // 1. Update the queue entry itself
        await conn.query('UPDATE live_queue SET status = ? WHERE id = ?', [status, req.params.queueId]);

        // 2. Handle status-specific logic
        if (status === 'IN_PROGRESS') {
            await conn.query(
                "UPDATE appointments a JOIN live_queue lq ON a.id = lq.appointment_id SET a.consultation_start = NOW(), a.status = 'in_progress' WHERE lq.id = ?",
                [req.params.queueId]
            );

            // Notify CURRENT patient that it's their turn
            notificationService.notifyYourTurn(
                queueRow.patient_id, 
                doctorName, 
                queueRow.location_room
            ).catch(err => console.error('Your Turn Notification Error:', err));

            // Notify NEXT patient that the doctor is now seeing the patient before them
            const [nextPatientRows] = await conn.query(`
                SELECT a.patient_id, lq.queue_number, lq.estimated_time
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.queue_number > ? AND lq.status = 'WAITING'
                ORDER BY lq.queue_number ASC LIMIT 1
            `, [queueRow.doctor_id, queueRow.appointment_date, queueRow.queue_number]);
            const nextPatient = nextPatientRows[0];

            if (nextPatient) {
                notificationService.notifyTurnApproaching(
                    nextPatient.patient_id,
                    nextPatient.queue_number,
                    doctorName,
                    nextPatient.estimated_time || 0
                ).catch(err => console.error('Turn Approaching Notification Error:', err));
            }

        } else if (status === 'COMPLETED') {
            // Record consultation end time and calculate duration
            const [consultStartRows] = await conn.query(
                'SELECT consultation_start FROM appointments WHERE id = ?',
                [queueRow.appointment_id]
            );
            const consultStart = consultStartRows[0];
            
            let actualDuration = DEFAULT_PREDICTED_DURATION; // Default if no start time
            if (consultStart?.consultation_start) {
                const startTime = new Date(consultStart.consultation_start);
                const endTime = new Date();
                actualDuration = Math.round((endTime - startTime) / 60000); // Convert ms to minutes
                actualDuration = Math.max(1, Math.min(120, actualDuration)); // Clamp 1-120 mins
            }

            // Update appointment with completion details and actual duration
            await conn.query(
                `UPDATE appointments
                    SET status = 'COMPLETED',
                        consultation_end = NOW(),
                        actual_duration_mins = ?,
                        diagnosis    = COALESCE(?, diagnosis),
                        notes        = COALESCE(?, notes),
                        prescription = COALESCE(?, prescription),
                        follow_up_date = COALESCE(?, follow_up_date)
                 WHERE id = ?`,
                [
                    actualDuration,
                    diagnosis    || null,
                    notes        || null,
                    prescription || null,
                    follow_up_date || null,
                    queueRow.appointment_id
                ]
            );
            
            // 3. Formal Prescription Storage
            if (prescription) {
                await prescriptionService.createPrescription(
                    queueRow.doctor_id,
                    queueRow.patient_id,
                    {
                        medications: prescription,
                        instructions: notes || 'Prescribed during consultation',
                        dosage: null,
                        frequency: null,
                        duration_days: null,
                        refills_remaining: 0
                    },
                    queueRow.appointment_id,
                    conn
                );
            }

            // 4. Vitals Storage
            if (vitals) {
                await vitalsService.logVitals(
                    queueRow.patient_id,
                    vitals,
                    queueRow.doctor_id,
                    conn
                );
            }

            // Notify NEXT patient that they are next
            const [nextPatientRows] = await conn.query(`
                SELECT a.patient_id, lq.queue_number, lq.estimated_time
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.queue_number = ?
            `, [queueRow.doctor_id, queueRow.appointment_date, queueRow.queue_number + 1]);
            const nextPatient = nextPatientRows[0];

            if (nextPatient) {
                notificationService.notifyTurnApproaching(
                    nextPatient.patient_id,
                    nextPatient.queue_number,
                    doctorName,
                    nextPatient.estimated_time || 0
                ).catch(err => console.error('Turn Approaching Notification Error:', err));
            }

            // Record duration for AI training (don't await, run in background)
            recordConsultationDuration({
                appointmentId: queueRow.appointment_id,
                doctorId: queueRow.doctor_id,
                patientId: queueRow.patient_id,
                symptoms: queueRow.symptoms,
                actualDurationMins: actualDuration,
                isFollowUp: queueRow.is_follow_up || false
            }).catch(err => console.error('Failed to record duration:', err));

            // Recalculate estimates for remaining queue (don't await)
            recalculateQueueEstimates(queueRow.doctor_id, queueRow.appointment_date)
                .catch(err => console.error('Failed to recalculate estimates:', err));

        } else if (status === 'MISSED') {
            // Find the maximum queue number for waiting patients
            const [_rows2] = await conn.query(`
                SELECT MAX(lq.queue_number) AS maxQ 
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status IN ('WAITING', 'IN_PROGRESS')
            `, [queueRow.doctor_id, queueRow.appointment_date]);
            const { maxQ } = _rows2[0] || {};
            
            // Re-insert 5 positions down or at the end of the queue, whichever is strictly closer
            const shiftCount = 5;
            const targetQ = Math.min(queueRow.queue_number + shiftCount, (maxQ || queueRow.queue_number));

            // Shift patients between current and target forward in the line
            if (targetQ > queueRow.queue_number) {
                await conn.query(`
                    UPDATE live_queue lq
                    JOIN appointments a ON lq.appointment_id = a.id
                    SET lq.queue_number = lq.queue_number - 1 
                    WHERE a.doctor_id = ? AND a.appointment_date = ? 
                      AND lq.queue_number > ? AND lq.queue_number <= ? 
                      AND lq.status IN ('WAITING', 'IN_PROGRESS')
                 `, [queueRow.doctor_id, queueRow.appointment_date, queueRow.queue_number, targetQ]);
            }

            // Move the missed patient to the new position and set them back to WAITING
            await conn.query(`
                UPDATE live_queue 
                SET queue_number = ?, status = 'WAITING' 
                WHERE id = ?
            `, [targetQ, req.params.queueId]);
            
            // Notify the missed patient
            notificationService.notifyMissed(
                queueRow.patient_id,
                doctorName,
                targetQ,
                targetQ - queueRow.queue_number
            ).catch(err => console.error('Missed Notification Error:', err));

            // Recalculate estimates for remaining queue
            recalculateQueueEstimates(queueRow.doctor_id, queueRow.appointment_date)
                .catch(err => console.error('Failed to recalculate estimates:', err));
        }

        await conn.commit();

        // BROADCAST UPDATES
        // 1. Update individual waiting rooms (first broadcast to the active patient who was just updated, even if completed/missed)
        const activeStatus = await virtualCheckinService.getWaitingRoomStatus(queueRow.appointment_id, queueRow.patient_id);
        if (activeStatus) {
            sseManager.broadcastQueueUpdate(queueRow.appointment_id, activeStatus);
        }

        const [waitingPatients] = await db.query(`
            SELECT lq.appointment_id, a.patient_id 
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE lq.status IN ('WAITING', 'IN_PROGRESS') 
            AND a.doctor_id = ? AND a.appointment_date = ?
        `, [queueRow.doctor_id, queueRow.appointment_date]);

        for (const p of waitingPatients) {
            // [DEAD-001] Renamed from 'status' to avoid shadowing outer scope variable
            const patientStatus = await virtualCheckinService.getWaitingRoomStatus(p.appointment_id, p.patient_id);
            if (patientStatus) {
                sseManager.broadcastQueueUpdate(p.appointment_id, patientStatus);
            }
        }

        // 2. Update Live Queue for all subscribers of this doctor
        sseManager.broadcastToDoctor(queueRow.doctor_id, 'doctor_queue_update', {
            refresh: true,
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Queue status updated' });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error('QUEUE_STATUS_ERROR:', error); // Full detail always in server logs
        // SEC-010: Do not leak raw error.message to clients in production
        res.status(500).json({ message: safeErrorMessage(error, 'Server error updating queue status') });
    } finally {
        if (conn) conn.release();
    }
});

// PATCH /api/appointments/:id/cancel — cancel a CONFIRMED/PENDING appointment
router.patch('/:id/cancel', authenticate, async (req, res) => {
    const conn = await db.getConnection();
    try {
        const [apptRows] = await conn.query(
            'SELECT status, appointment_date, patient_id FROM appointments WHERE id = ?',
            [req.params.id]
        );
        const appt = apptRows[0];

        if (!appt) return res.status(404).json({ message: 'Appointment not found' });

        // SECURITY: Verify patient owns appointment
        if (req.user.role === 'PATIENT' && req.user.id !== appt.patient_id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // BUG-003: Patients may not cancel past appointments
        if (req.user.role === 'PATIENT') {
            const todayStr = getTodayDateString();
            const apptDateStr = toDateString(appt.appointment_date);
            if (apptDateStr < todayStr) {
                return res.status(400).json({ message: 'Cannot cancel a past appointment' });
            }
        }

        // BUG-008: Use LOWER() to normalize before comparison — statuses are stored lowercase
        if (!['CONFIRMED', 'PENDING', 'SCHEDULED'].includes(String(appt.status).toUpperCase())) {
            return res.status(400).json({ message: `Cannot cancel appointment with status ${appt.status}` });
        }

        await conn.beginTransaction();

        await conn.query(
            "UPDATE appointments SET status = 'CANCELLED' WHERE id = ?",
            [req.params.id]
        );

        const todayStr = getTodayDateString();
        const aptDate = toDateString(appt.appointment_date);
        if (aptDate === todayStr) {
            await conn.query(
                "UPDATE live_queue SET status = 'MISSED' WHERE appointment_id = ? AND status IN ('WAITING', 'IN_PROGRESS')",
                [req.params.id]
            );
        }

        await conn.commit();
        
        // Issue #41: Trigger auto-fill for cancellation
        waitlistService.handleSlotRelease(parseInt(req.params.id), 'CANCELLATION')
            .catch(err => console.error('Auto-fill error:', err));
        
        res.json({ message: 'Appointment cancelled' });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error cancelling appointment' });
    } finally {
        conn.release();
    }
});

// GET /api/appointments/analytics/doctor/:doctorId — get prediction analytics for a doctor
router.get('/analytics/doctor/:doctorId', authenticate, async (req, res) => {
    try {
        const doctorId = req.params.doctorId;

        // Get doctor's average times
        const [avgTimesRows] = await db.query(
            `SELECT * FROM doctor_avg_times WHERE doctor_id = ?`,
            [doctorId]
        );
        const avgTimes = avgTimesRows[0];

        // Get consultation history stats
        const [historyStatsRows] = await db.query(`
            SELECT 
                COUNT(*) as total_consultations,
                AVG(actual_duration_mins) as avg_duration,
                MIN(actual_duration_mins) as min_duration,
                MAX(actual_duration_mins) as max_duration,
                STDDEV(actual_duration_mins) as std_deviation
            FROM consultation_history
            WHERE doctor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [doctorId]);
        const historyStats = historyStatsRows[0];

        // Get day-wise patterns
        const [dayPatterns] = await db.query(`
            SELECT 
                day_of_week,
                AVG(actual_duration_mins) as avg_duration,
                COUNT(*) as count
            FROM consultation_history
            WHERE doctor_id = ?
            GROUP BY day_of_week
            ORDER BY day_of_week
        `, [doctorId]);

        // Get hour-wise patterns
        const [hourPatterns] = await db.query(`
            SELECT 
                hour_of_day,
                AVG(actual_duration_mins) as avg_duration,
                COUNT(*) as count
            FROM consultation_history
            WHERE doctor_id = ?
            GROUP BY hour_of_day
            ORDER BY hour_of_day
        `, [doctorId]);

        // Get prediction accuracy (compare predicted vs actual)
        const [accuracyRows] = await db.query(`
            SELECT 
                AVG(ABS(predicted_duration_mins - actual_duration_mins)) as avg_error,
                AVG(CASE WHEN ABS(predicted_duration_mins - actual_duration_mins) <= 5 THEN 1 ELSE 0 END) * 100 as accuracy_within_5min
            FROM appointments
            WHERE doctor_id = ? 
              AND actual_duration_mins IS NOT NULL 
              AND predicted_duration_mins IS NOT NULL
        `, [doctorId]);
        const accuracy = accuracyRows[0];

        res.json({
            averages: avgTimes || { avg_duration_mins: DEFAULT_PREDICTED_DURATION, total_consultations: 0 },
            historyStats: historyStats || {},
            dayPatterns: dayPatterns || [],
            hourPatterns: hourPatterns || [],
            accuracy: accuracy || { avg_error: null, accuracy_within_5min: null }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching analytics' });
    }
});

// GET /api/appointments/analytics/symptoms — get symptom complexity data
router.get('/analytics/symptoms', authenticate, async (req, res) => {
    try {
        const [symptoms] = await db.query(
            `SELECT keyword, complexity_score, avg_extra_mins FROM symptom_complexity ORDER BY complexity_score DESC`
        );
        res.json(symptoms);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching symptoms' });
    }
});

// ==================== Issue #41: Waitlist Endpoints ====================

// POST /api/appointments/waitlist/join - Join waitlist for a doctor
router.post('/waitlist/join', authenticate, validateRequest(joinWaitlistSchema), async (req, res) => {
    try {
        const { doctorId, preferredDate, timePreference, maxNoticeHours, reason } = req.body;
        
        // Get patient ID from user
        const [patientRows] = await db.query(
            'SELECT id FROM patients WHERE id = ?',
            [req.user.id]
        );
        const patient = patientRows[0];
        
        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.joinWaitlist(patient.id, doctorId, {
            preferredDate,
            timePreference,
            maxNoticeHours,
            reason
        });

        if (!result.success) {
            return res.status(400).json({ message: result.error });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Join waitlist error:', error);
        res.status(500).json({ message: 'Server error joining waitlist' });
    }
});

// DELETE /api/appointments/waitlist/:id - Leave waitlist
router.delete('/waitlist/:id', authenticate, async (req, res) => {
    try {
        const [patientRows] = await db.query(
            'SELECT id FROM patients WHERE id = ?',
            [req.user.id]
        );
        const patient = patientRows[0];

        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.leaveWaitlist(parseInt(req.params.id), patient.id);
        
        if (!result.success) {
            return res.status(404).json({ message: 'Waitlist entry not found' });
        }

        res.json({ message: 'Removed from waitlist' });
    } catch (error) {
        console.error('Leave waitlist error:', error);
        res.status(500).json({ message: 'Server error leaving waitlist' });
    }
});

// GET /api/appointments/waitlist/my - Get patient's waitlist entries
router.get('/waitlist/my', authenticate, async (req, res) => {
    try {
        const [patientRows] = await db.query(
            'SELECT id FROM patients WHERE id = ?',
            [req.user.id]
        );
        const patient = patientRows[0];

        if (!patient) {
            return res.json([]);
        }

        const entries = await waitlistService.getPatientWaitlist(patient.id);
        res.json(entries);
    } catch (error) {
        console.error('Get patient waitlist error:', error);
        res.status(500).json({ message: 'Server error fetching waitlist' });
    }
});

// GET /api/appointments/waitlist/offers - Get pending slot offers for patient
router.get('/waitlist/offers', authenticate, async (req, res) => {
    try {
        const [patientRows] = await db.query(
            'SELECT id FROM patients WHERE id = ?',
            [req.user.id]
        );
        const patient = patientRows[0];

        if (!patient) {
            return res.json([]);
        }

        const offers = await waitlistService.getPatientOffers(patient.id);
        res.json(offers);
    } catch (error) {
        console.error('Get offers error:', error);
        res.status(500).json({ message: 'Server error fetching offers' });
    }
});

// POST /api/appointments/waitlist/offers/:id/accept - Accept a slot offer
router.post('/waitlist/offers/:id/accept', authenticate, async (req, res) => {
    try {
        const [patientRows] = await db.query(
            'SELECT id FROM patients WHERE id = ?',
            [req.user.id]
        );
        const patient = patientRows[0];

        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.acceptSlotOffer(parseInt(req.params.id), patient.id);
        
        if (!result.success) {
            return res.status(400).json({ message: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Accept offer error:', error);
        res.status(500).json({ message: 'Server error accepting offer' });
    }
});

// POST /api/appointments/waitlist/offers/:id/decline - Decline a slot offer
router.post('/waitlist/offers/:id/decline', authenticate, async (req, res) => {
    try {
        const [patientRows] = await db.query(
            'SELECT id FROM patients WHERE id = ?',
            [req.user.id]
        );
        const patient = patientRows[0];

        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.declineSlotOffer(parseInt(req.params.id), patient.id);
        
        if (!result.success) {
            return res.status(400).json({ message: result.error });
        }

        res.json({ message: 'Offer declined' });
    } catch (error) {
        console.error('Decline offer error:', error);
        res.status(500).json({ message: 'Server error declining offer' });
    }
});

// POST /api/appointments/waitlist/cleanup - Clean up expired entries (admin/cron)
router.post('/waitlist/cleanup', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await waitlistService.cleanupExpired();
        res.json({ message: 'Cleanup complete', ...result });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ message: 'Server error during cleanup' });
    }
});

// ==================== Issue #37: Smart Arrival Time ====================

// GET /api/appointments/:id/smart-arrival - Get optimal arrival time
router.get('/:id/smart-arrival', authenticate, async (req, res) => {
    try {
        const { buffer, transit } = req.query;
        
        const result = await smartArrivalService.calculateSmartArrival(
            parseInt(req.params.id),
            {
                bufferMinutes: buffer ? parseInt(buffer) : 10,
                includeTransit: !!transit,
                transitMinutes: transit ? parseInt(transit) : 0
            }
        );

        if (result.error) {
            return res.status(404).json({ message: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Smart arrival error:', error);
        res.status(500).json({ message: 'Server error calculating arrival time' });
    }
});

// GET /api/appointments/doctor/:doctorId/smart-arrivals - Get all smart arrivals for a doctor today
router.get('/doctor/:doctorId/smart-arrivals', authenticate, async (req, res) => {
    try {
        const results = await smartArrivalService.getBatchSmartArrivals(parseInt(req.params.doctorId));
        res.json(results);
    } catch (error) {
        console.error('Batch smart arrivals error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Issue #110: Export prescription as PDF
router.get('/:id/prescription/pdf', authenticate, async (req, res) => {
    try {
        // Check if appointment exists and user is authorized (patient/doctor/admin)
        const [appt] = await db.query('SELECT patient_id, doctor_id FROM appointments WHERE id = ?', [req.params.id]);
        if (appt.length === 0) return res.status(404).json({ message: 'Appointment not found' });
        
        if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN' && parseInt(req.user.id) !== parseInt(appt[0].patient_id)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=prescription_${req.params.id}.pdf`);
        
        await exportService.generatePrescriptionPDF(req.params.id, res);
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error exporting PDF' });
        }
    }
});

module.exports = router;
