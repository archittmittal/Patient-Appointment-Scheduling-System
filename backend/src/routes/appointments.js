const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST /api/appointments/book
router.post('/book', async (req, res) => {
    try {
        const { patientId, doctorId, date, timeSlot, symptoms } = req.body;

        const [result] = await db.query(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status) VALUES (?, ?, ?, ?, ?, ?)',
            [patientId, doctorId, date, timeSlot, symptoms || null, 'CONFIRMED']
        );

        // Add to live queue only if appointment is today
        const [todayCheck] = await db.query(
            'SELECT 1 FROM appointments WHERE id = ? AND appointment_date = CURDATE()',
            [result.insertId]
        );

        let queueNumber = null;
        if (todayCheck.length > 0) {
            const [[{ maxQ }]] = await db.query(
                `SELECT MAX(lq.queue_number) AS maxQ
                 FROM live_queue lq
                 JOIN appointments a ON lq.appointment_id = a.id
                 WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()`,
                [doctorId]
            );
            queueNumber = (maxQ || 0) + 1;
            await db.query(
                'INSERT INTO live_queue (appointment_id, queue_number, status, estimated_time) VALUES (?, ?, ?, ?)',
                [result.insertId, queueNumber, 'WAITING', queueNumber * 15]
            );
        }

        res.status(201).json({ message: 'Appointment booked successfully', appointmentId: result.insertId, queueNumber });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error booking appointment' });
    }
});

// GET /api/appointments/queue/:appointmentId
router.get('/queue/:appointmentId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT lq.*, a.doctor_id, a.appointment_date
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE lq.appointment_id = ?
        `, [req.params.appointmentId]);

        if (rows.length === 0) return res.status(404).json({ message: 'Queue data not found' });

        const entry = rows[0];

        // Find the token currently IN_PROGRESS for this doctor today
        const [[inProgress]] = await db.query(`
            SELECT lq.queue_number FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status = 'IN_PROGRESS'
            ORDER BY lq.queue_number ASC LIMIT 1
        `, [entry.doctor_id, entry.appointment_date]);

        const currentToken = inProgress ? inProgress.queue_number : 0;

        // Full queue sequence for this doctor today
        const [sequence] = await db.query(`
            SELECT lq.id AS queue_id, lq.queue_number AS number,
                   CONCAT(p.first_name, ' ', p.last_name) AS name,
                   lq.status, a.time_slot AS time,
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
            queueSequence: sequence
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/appointments/queue/:queueId/status — update a token's status (for doctor/assistant)
router.patch('/queue/:queueId/status', async (req, res) => {
    try {
        const { status, diagnosis, notes, prescription, follow_up_date } = req.body;
        const validStatuses = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }
        await db.query('UPDATE live_queue SET status = ? WHERE id = ?', [status, req.params.queueId]);

        // When completing, write consultation notes back to the appointments row
        if (status === 'COMPLETED') {
            const [[queueRow]] = await db.query(
                'SELECT appointment_id FROM live_queue WHERE id = ?',
                [req.params.queueId]
            );
            if (queueRow) {
                await db.query(
                    `UPDATE appointments
                        SET status = 'COMPLETED',
                            diagnosis    = COALESCE(?, diagnosis),
                            notes        = COALESCE(?, notes),
                            prescription = COALESCE(?, prescription),
                            follow_up_date = COALESCE(?, follow_up_date)
                     WHERE id = ?`,
                    [
                        diagnosis    || null,
                        notes        || null,
                        prescription || null,
                        follow_up_date || null,
                        queueRow.appointment_id
                    ]
                );
            }
        }

        res.json({ message: 'Queue status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
