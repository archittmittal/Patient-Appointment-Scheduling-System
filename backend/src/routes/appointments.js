const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const {
    predictConsultationDuration,
    recordConsultationDuration,
    calculateQueueWaitTime,
    recalculateQueueEstimates
} = require('../services/durationPrediction');

// POST /api/appointments/book
router.post('/book', authenticate, async (req, res) => {
    try {
        const { patientId, doctorId, date, timeSlot, symptoms } = req.body;

        // Predict consultation duration using AI model
        const prediction = await predictConsultationDuration({
            doctorId,
            patientId,
            symptoms,
            timeSlot
        });

        const [result] = await db.query(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status, predicted_duration_mins, is_follow_up) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [patientId, doctorId, date, timeSlot, symptoms || null, 'CONFIRMED', prediction.predictedDuration, prediction.factors.isFollowUp]
        );

        // Add to live queue only if appointment is today
        const [todayCheck] = await db.query(
            'SELECT 1 FROM appointments WHERE id = ? AND appointment_date = CURDATE()',
            [result.insertId]
        );

        let queueNumber = null;
        let estimatedWait = null;
        if (todayCheck.length > 0) {
            const [[{ maxQ }]] = await db.query(
                `SELECT MAX(lq.queue_number) AS maxQ
                 FROM live_queue lq
                 JOIN appointments a ON lq.appointment_id = a.id
                 WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()`,
                [doctorId]
            );
            queueNumber = (maxQ || 0) + 1;
            
            // Calculate actual wait time based on AI predictions for patients ahead
            const waitInfo = await calculateQueueWaitTime(result.insertId);
            estimatedWait = waitInfo.estimatedWait || (queueNumber - 1) * prediction.predictedDuration;
            
            await db.query(
                'INSERT INTO live_queue (appointment_id, queue_number, status, estimated_time, predicted_duration) VALUES (?, ?, ?, ?, ?)',
                [result.insertId, queueNumber, 'WAITING', estimatedWait, prediction.predictedDuration]
            );
        }

        res.status(201).json({ 
            message: 'Appointment booked successfully', 
            appointmentId: result.insertId, 
            queueNumber,
            predictedDuration: prediction.predictedDuration,
            estimatedWait,
            predictionFactors: prediction.factors
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error booking appointment' });
    }
});

// GET /api/appointments/predict-duration — predict duration for given parameters (without booking)
router.get('/predict-duration', authenticate, async (req, res) => {
    try {
        const { doctorId, patientId, symptoms, timeSlot } = req.query;
        
        if (!doctorId) {
            return res.status(400).json({ message: 'doctorId is required' });
        }

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
router.get('/queue/:appointmentId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT lq.*, a.doctor_id, a.appointment_date, a.predicted_duration_mins
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE lq.appointment_id = ?
        `, [req.params.appointmentId]);

        if (rows.length === 0) return res.status(404).json({ message: 'Queue data not found' });

        const entry = rows[0];

        // Calculate actual wait time using AI predictions
        const waitInfo = await calculateQueueWaitTime(req.params.appointmentId);

        // Find the token currently IN_PROGRESS for this doctor today
        const [[inProgress]] = await db.query(`
            SELECT lq.queue_number FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status = 'IN_PROGRESS'
            ORDER BY lq.queue_number ASC LIMIT 1
        `, [entry.doctor_id, entry.appointment_date]);

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

        res.json({
            ...entry,
            currentToken,
            queueSequence: sequence,
            estimatedWaitMins: waitInfo.estimatedWait,
            patientsAhead: waitInfo.patientsAhead,
            predictedDuration: entry.predicted_duration || entry.predicted_duration_mins || 15
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/appointments/queue/:queueId/status — update a token's status (for doctor/assistant)
// When status is COMPLETED or MISSED, also syncs the parent appointments row so that
// admin views, patient history, and stats all reflect the real outcome (fixes D4).
// Now also records consultation duration for AI prediction training (Issue #48)
router.patch('/queue/:queueId/status', authenticate, async (req, res) => {
    const { status, diagnosis, notes, prescription, follow_up_date } = req.body;
    const validStatuses = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Get appointment details for duration tracking
        const [[queueRow]] = await conn.query(`
            SELECT lq.appointment_id, a.doctor_id, a.patient_id, a.symptoms, 
                   a.appointment_date, a.consultation_start, a.is_follow_up
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE lq.id = ?
        `, [req.params.queueId]);

        // 1. Update the queue entry itself
        await conn.query('UPDATE live_queue SET status = ? WHERE id = ?', [status, req.params.queueId]);

        // 2. Handle status-specific logic
        if (status === 'IN_PROGRESS') {
            // Record consultation start time
            await conn.query(
                'UPDATE appointments SET consultation_start = NOW() WHERE id = ?',
                [queueRow.appointment_id]
            );
        } else if (status === 'COMPLETED') {
            // Record consultation end time and calculate duration
            const [[consultStart]] = await conn.query(
                'SELECT consultation_start FROM appointments WHERE id = ?',
                [queueRow.appointment_id]
            );
            
            let actualDuration = 15; // Default if no start time
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
            await conn.query(
                `UPDATE appointments a
                 JOIN live_queue lq ON lq.appointment_id = a.id
                 SET a.status = 'CANCELLED'
                 WHERE lq.id = ?`,
                [req.params.queueId]
            );
            
            // Recalculate estimates for remaining queue
            recalculateQueueEstimates(queueRow.doctor_id, queueRow.appointment_date)
                .catch(err => console.error('Failed to recalculate estimates:', err));
        }

        await conn.commit();
        res.json({ message: 'Queue status updated' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

// PATCH /api/appointments/:id/cancel — cancel a CONFIRMED/PENDING appointment
router.patch('/:id/cancel', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const [[appt]] = await conn.query(
            'SELECT status, appointment_date FROM appointments WHERE id = ?',
            [req.params.id]
        );

        if (!appt) return res.status(404).json({ message: 'Appointment not found' });
        if (!['CONFIRMED', 'PENDING'].includes(appt.status)) {
            return res.status(400).json({ message: `Cannot cancel appointment with status ${appt.status}` });
        }

        await conn.beginTransaction();

        await conn.query(
            "UPDATE appointments SET status = 'CANCELLED' WHERE id = ?",
            [req.params.id]
        );

        // If the appointment is today, remove it from the live queue too
        const todayStr = new Date().toISOString().split('T')[0];
        const aptDate = String(appt.appointment_date).split('T')[0];
        if (aptDate === todayStr) {
            await conn.query(
                "UPDATE live_queue SET status = 'MISSED' WHERE appointment_id = ? AND status IN ('WAITING', 'IN_PROGRESS')",
                [req.params.id]
            );
        }

        await conn.commit();
        res.json({ message: 'Appointment cancelled' });
    } catch (error) {
        await conn.rollback();
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
        const [[avgTimes]] = await db.query(
            `SELECT * FROM doctor_avg_times WHERE doctor_id = ?`,
            [doctorId]
        );

        // Get consultation history stats
        const [[historyStats]] = await db.query(`
            SELECT 
                COUNT(*) as total_consultations,
                AVG(actual_duration_mins) as avg_duration,
                MIN(actual_duration_mins) as min_duration,
                MAX(actual_duration_mins) as max_duration,
                STDDEV(actual_duration_mins) as std_deviation
            FROM consultation_history
            WHERE doctor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [doctorId]);

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
        const [[accuracy]] = await db.query(`
            SELECT 
                AVG(ABS(predicted_duration_mins - actual_duration_mins)) as avg_error,
                AVG(CASE WHEN ABS(predicted_duration_mins - actual_duration_mins) <= 5 THEN 1 ELSE 0 END) * 100 as accuracy_within_5min
            FROM appointments
            WHERE doctor_id = ? 
              AND actual_duration_mins IS NOT NULL 
              AND predicted_duration_mins IS NOT NULL
        `, [doctorId]);

        res.json({
            averages: avgTimes || { avg_duration_mins: 15, total_consultations: 0 },
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

module.exports = router;
