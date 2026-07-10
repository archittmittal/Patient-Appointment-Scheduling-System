const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../config/db');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, authenticateSse, requireRole } = require('../middleware/authenticate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const {
    calculateQueueWaitTime,
    recordConsultationDuration,
    recalculateQueueEstimates
} = require('../services/durationPrediction');
const sseManager = require('../services/sseManager');
const virtualCheckinService = require('../services/virtualCheckinService');
const smartArrivalService = require('../services/smartArrivalService');
const prescriptionService = require('../services/prescriptionService');
const vitalsService = require('../services/vitalsService');
const notificationService = require('../services/notificationService');
const { DEFAULT_PREDICTED_DURATION } = require('../config/constants');
const logger = require('../config/logger');

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

// GET /api/appointments/queue/:appointmentId
router.get('/queue/:appointmentId', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT lq.*, a.doctor_id, a.appointment_date, a.predicted_duration_mins, a.patient_id, a.virtual_checkin_status
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
            predictedDuration: entry.predicted_duration || entry.predicted_duration_mins || 15
        });
    } catch (error) {
        logger.error(error);
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
        logger.error('Queue SSE Error:', error);
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
        logger.error('Doctor SSE Error:', error);
        if (!res.headersSent) res.status(500).json({ message: 'SSE Connection Failed' });
    }
});

// PATCH /api/appointments/queue/:queueId/status
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

        // Use strict equality with parseInt() to prevent string/number type mismatch
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
                "UPDATE appointments a JOIN live_queue lq ON a.id = lq.appointment_id SET a.consultation_start = NOW(), a.status = 'IN_PROGRESS' WHERE lq.id = ?",
                [req.params.queueId]
            );

            // Notify CURRENT patient that it's their turn
            notificationService.notifyYourTurn(
                queueRow.patient_id, 
                doctorName, 
                queueRow.location_room
            ).catch(err => logger.error('Your Turn Notification Error:', err));

            // Notify NEXT patient
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
                ).catch(err => logger.error('Turn Approaching Notification Error:', err));
            }

        } else if (status === 'COMPLETED') {
            const [consultStartRows] = await conn.query(
                'SELECT consultation_start FROM appointments WHERE id = ?',
                [queueRow.appointment_id]
            );
            const consultStart = consultStartRows[0];
            
            let actualDuration = DEFAULT_PREDICTED_DURATION;
            if (consultStart?.consultation_start) {
                const startTime = new Date(consultStart.consultation_start);
                const endTime = new Date();
                actualDuration = Math.round((endTime - startTime) / 60000);
                actualDuration = Math.max(1, Math.min(120, actualDuration));
            }

            // Update appointment with completion details
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
            
            // Formal Prescription Storage
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

            // Vitals Storage
            if (vitals) {
                await vitalsService.logVitals(
                    queueRow.patient_id,
                    vitals,
                    queueRow.doctor_id,
                    conn
                );
            }

            // Notify NEXT patient
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
                ).catch(err => logger.error('Turn Approaching Notification Error:', err));
            }

            // Record duration for AI training in background
            recordConsultationDuration({
                appointmentId: queueRow.appointment_id,
                doctorId: queueRow.doctor_id,
                patientId: queueRow.patient_id,
                symptoms: queueRow.symptoms,
                actualDurationMins: actualDuration,
                isFollowUp: queueRow.is_follow_up || false
            }).catch(err => logger.error('Failed to record duration:', err));

            // Recalculate estimates
            recalculateQueueEstimates(queueRow.doctor_id, queueRow.appointment_date)
                .catch(err => logger.error('Failed to recalculate estimates:', err));

        } else if (status === 'MISSED') {
            const [_rows2] = await conn.query(`
                SELECT MAX(lq.queue_number) AS maxQ 
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status IN ('WAITING', 'IN_PROGRESS')
            `, [queueRow.doctor_id, queueRow.appointment_date]);
            const { maxQ } = _rows2[0] || {};
            
            const shiftCount = 5;
            const targetQ = Math.min(queueRow.queue_number + shiftCount, (maxQ || queueRow.queue_number));

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

            await conn.query(`
                UPDATE live_queue 
                SET queue_number = ?, status = 'WAITING' 
                WHERE id = ?
            `, [targetQ, req.params.queueId]);
            
            notificationService.notifyMissed(
                queueRow.patient_id,
                doctorName,
                targetQ,
                targetQ - queueRow.queue_number
            ).catch(err => logger.error('Missed Notification Error:', err));

            recalculateQueueEstimates(queueRow.doctor_id, queueRow.appointment_date)
                .catch(err => logger.error('Failed to recalculate estimates:', err));
        }

        await conn.commit();

        // BROADCAST UPDATES
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
            const patientStatus = await virtualCheckinService.getWaitingRoomStatus(p.appointment_id, p.patient_id);
            if (patientStatus) {
                sseManager.broadcastQueueUpdate(p.appointment_id, patientStatus);
            }
        }

        sseManager.broadcastToDoctor(queueRow.doctor_id, 'doctor_queue_update', {
            refresh: true,
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Queue status updated' });
    } catch (error) {
        if (conn) await conn.rollback();
        logger.error('QUEUE_STATUS_ERROR:', error);
        res.status(500).json({ message: safeErrorMessage(error, 'Server error updating queue status') });
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/appointments/:id/smart-arrival
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
        logger.error('Smart arrival error:', error);
        res.status(500).json({ message: 'Server error calculating arrival time' });
    }
});

// GET /api/appointments/doctor/:doctorId/smart-arrivals
router.get('/doctor/:doctorId/smart-arrivals', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const doctorId = parseInt(req.params.doctorId);
        if (req.user.role === 'DOCTOR' && parseInt(req.user.id) !== doctorId) {
            return res.status(403).json({ message: 'Access denied: You can only view your own smart arrivals' });
        }
        const results = await smartArrivalService.getBatchSmartArrivals(doctorId);
        res.json(results);
    } catch (error) {
        logger.error('Batch smart arrivals error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
