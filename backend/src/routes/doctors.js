const express = require('express');
const router = express.Router();
const db = require('../config/db');

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
router.patch('/:id', async (req, res) => {
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
router.patch('/:id/availability', async (req, res) => {
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

module.exports = router;
