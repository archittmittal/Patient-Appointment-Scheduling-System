const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const smartArrivalService = require('../services/smartArrivalService');

// POST /api/appointments/book
router.post('/book', authenticate, async (req, res) => {
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
// When status is COMPLETED or MISSED, also syncs the parent appointments row so that
// admin views, patient history, and stats all reflect the real outcome (fixes D4).
router.patch('/queue/:queueId/status', authenticate, async (req, res) => {
    const { status, diagnosis, notes, prescription, follow_up_date } = req.body;
    const validStatuses = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'MISSED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Update the queue entry itself
        await conn.query('UPDATE live_queue SET status = ? WHERE id = ?', [status, req.params.queueId]);

        // 2. For terminal statuses mirror the result onto appointments so both tables stay consistent
        if (status === 'COMPLETED') {
            const [[queueRow]] = await conn.query(
                'SELECT appointment_id FROM live_queue WHERE id = ?',
                [req.params.queueId]
            );
            if (queueRow) {
                await conn.query(
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
        } else if (status === 'MISSED') {
            await conn.query(
                `UPDATE appointments a
                 JOIN live_queue lq ON lq.appointment_id = a.id
                 SET a.status = 'CANCELLED'
                 WHERE lq.id = ?`,
                [req.params.queueId]
            );
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

module.exports = router;
