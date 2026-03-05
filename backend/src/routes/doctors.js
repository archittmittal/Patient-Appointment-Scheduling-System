const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const waitlistService = require('../services/waitlistService');

// GET /api/doctors — all doctors
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM doctors');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/doctors/:id — single doctor (with availability)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Doctor not found' });
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/doctors/:id — update doctor profile (photo, bio, specialty, etc.)
router.patch('/:id', authenticate, async (req, res) => {
    try {
        const { first_name, last_name, specialty, degree, experience_years, about, location_room, image_url, max_patients_per_slot } = req.body;
        await db.query(
            `UPDATE doctors SET
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                specialty = COALESCE(?, specialty),
                degree = COALESCE(?, degree),
                experience_years = COALESCE(?, experience_years),
                about = COALESCE(?, about),
                location_room = COALESCE(?, location_room),
                image_url = COALESCE(?, image_url),
                max_patients_per_slot = COALESCE(?, max_patients_per_slot)
             WHERE id = ?`,
            [first_name, last_name, specialty, degree, experience_years, about, location_room, image_url, max_patients_per_slot ?? null, req.params.id]
        );
        const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/doctors/:id/slot-counts?date=YYYY-MM-DD — booking count per slot for a given date
router.get('/:id/slot-counts', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date query param required' });
    try {
        const [rows] = await db.query(
            `SELECT time_slot, COUNT(*) AS count FROM appointments
             WHERE doctor_id = ? AND appointment_date = ? AND status != 'CANCELLED'
             GROUP BY time_slot`,
            [req.params.id, date]
        );
        const counts = {};
        rows.forEach(r => { counts[r.time_slot] = Number(r.count); });
        res.json(counts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/doctors/:id/availability — update weekly schedule
router.patch('/:id/availability', authenticate, async (req, res) => {
    try {
        const { availability } = req.body;
        if (!availability || typeof availability !== 'object') {
            return res.status(400).json({ message: 'Invalid availability data' });
        }
        await db.query('UPDATE doctors SET availability = ? WHERE id = ?', [JSON.stringify(availability), req.params.id]);
        res.json({ message: 'Availability updated', availability });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/doctors/:id/reviews — mock reviews
router.get('/:id/reviews', async (req, res) => {
    const reviews = [
        { id: 1, name: 'Alice Walker', rating: 5.0, date: '2 days ago', comment: 'Very thorough and professional. Highly recommended.', avatar: 'https://ui-avatars.com/api/?name=Alice+Walker&background=random' },
        { id: 2, name: 'David Chen', rating: 4.5, date: '1 week ago', comment: 'Very professional and the clinic is well-equipped.', avatar: 'https://ui-avatars.com/api/?name=David+Chen&background=random' }
    ];
    res.json(reviews);
});

// GET /api/doctors/:id/patients — all patients with their appointments + symptoms
router.get('/:id/patients', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.id AS appointment_id, a.appointment_date, a.time_slot, a.symptoms, a.status,
                   a.diagnosis, a.notes, a.prescription, a.follow_up_date,
                   p.id AS patient_id, p.first_name, p.last_name, p.phone, p.blood_group,
                   u.email
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON p.id = u.id
            WHERE a.doctor_id = ?
            ORDER BY a.appointment_date DESC, a.id DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/doctors/:id/queue — today's live queue for this doctor
router.get('/:id/queue', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT lq.id AS queue_id, lq.queue_number, lq.status AS queue_status, lq.estimated_time,
                   a.id AS appointment_id, a.time_slot, a.symptoms,
                   p.first_name, p.last_name
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
            ORDER BY lq.queue_number ASC
        `, [req.params.id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/doctors/:id/blocked-dates — list all blocked dates for a doctor
router.get('/:id/blocked-dates', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, blocked_date, reason FROM doctor_blocked_dates WHERE doctor_id = ? ORDER BY blocked_date ASC',
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/doctors/:id/blocked-dates — block a specific date
router.post('/:id/blocked-dates', async (req, res) => {
    try {
        const { date, reason } = req.body;
        if (!date) return res.status(400).json({ message: 'date is required' });
        const [result] = await db.query(
            'INSERT INTO doctor_blocked_dates (doctor_id, blocked_date, reason) VALUES (?, ?, ?)',
            [req.params.id, date, reason || null]
        );
        res.status(201).json({ id: result.insertId, blocked_date: date, reason: reason || null });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This date is already blocked' });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/doctors/:id/blocked-dates/:dateId — unblock a date
router.delete('/:id/blocked-dates/:dateId', async (req, res) => {
    try {
        await db.query(
            'DELETE FROM doctor_blocked_dates WHERE id = ? AND doctor_id = ?',
            [req.params.dateId, req.params.id]
        );
        res.json({ message: 'Date unblocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/doctors/:id/weekly-schedule?week=YYYY-MM-DD
// Returns booked slot counts for each day of the week that starts on the given Monday.
// Defaults to the current week if no ?week param provided.
router.get('/:id/weekly-schedule', async (req, res) => {
    try {
        const toStr = d => d.toISOString().split('T')[0];

        // Determine week start (Monday)
        let weekStart;
        if (req.query.week) {
            weekStart = new Date(req.query.week);
        } else {
            weekStart = new Date();
            const day = weekStart.getDay(); // 0=Sun, 1=Mon, ...
            const diff = day === 0 ? -6 : 1 - day;
            weekStart.setDate(weekStart.getDate() + diff);
        }
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // Booked counts grouped by date + time_slot
        const [appointments] = await db.query(
            `SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date,
                    time_slot,
                    COUNT(*) AS booked,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled
             FROM appointments
             WHERE doctor_id = ?
               AND appointment_date BETWEEN ? AND ?
             GROUP BY appointment_date, time_slot
             ORDER BY appointment_date ASC, time_slot ASC`,
            [req.params.id, toStr(weekStart), toStr(weekEnd)]
        );

        // Doctor availability + capacity
        const [[doctor]] = await db.query(
            'SELECT availability, max_patients_per_slot FROM doctors WHERE id = ?',
            [req.params.id]
        );

        // Blocked dates in this range
        const [blocked] = await db.query(
            `SELECT DATE_FORMAT(blocked_date, '%Y-%m-%d') AS blocked_date
             FROM doctor_blocked_dates
             WHERE doctor_id = ? AND blocked_date BETWEEN ? AND ?`,
            [req.params.id, toStr(weekStart), toStr(weekEnd)]
        );

        res.json({
            week_start:    toStr(weekStart),
            week_end:      toStr(weekEnd),
            availability:  doctor?.availability  ?? null,
            capacity:      doctor?.max_patients_per_slot ?? 15,
            blocked_dates: blocked.map(b => b.blocked_date),
            appointments,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== Issue #41: Waitlist Endpoints (Doctor Side) ====================

// GET /api/doctors/:id/waitlist - Get waitlist for this doctor
router.get('/:id/waitlist', authenticate, async (req, res) => {
    try {
        const { date } = req.query;
        const entries = await waitlistService.getDoctorWaitlist(parseInt(req.params.id), date);
        res.json(entries);
    } catch (error) {
        console.error('Get doctor waitlist error:', error);
        res.status(500).json({ message: 'Server error fetching waitlist' });
    }
});

// GET /api/doctors/:id/autofill-settings - Get auto-fill settings
router.get('/:id/autofill-settings', authenticate, async (req, res) => {
    try {
        const settings = await waitlistService.getAutoFillSettings(parseInt(req.params.id));
        res.json(settings);
    } catch (error) {
        console.error('Get autofill settings error:', error);
        res.status(500).json({ message: 'Server error fetching settings' });
    }
});

// PUT /api/doctors/:id/autofill-settings - Update auto-fill settings
router.put('/:id/autofill-settings', authenticate, async (req, res) => {
    try {
        const { enabled, offerWindowMins, minNoticeHours, maxOffersPerSlot, priorityMode } = req.body;
        
        await waitlistService.updateAutoFillSettings(parseInt(req.params.id), {
            enabled,
            offerWindowMins,
            minNoticeHours,
            maxOffersPerSlot,
            priorityMode
        });
        
        res.json({ message: 'Settings updated' });
    } catch (error) {
        console.error('Update autofill settings error:', error);
        res.status(500).json({ message: 'Server error updating settings' });
    }
});

// GET /api/doctors/:id/autofill-analytics - Get auto-fill analytics
router.get('/:id/autofill-analytics', authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        
        const analytics = await waitlistService.getAutoFillAnalytics(parseInt(req.params.id), start, end);
        res.json(analytics);
    } catch (error) {
        console.error('Get autofill analytics error:', error);
        res.status(500).json({ message: 'Server error fetching analytics' });
    }
});

module.exports = router;
