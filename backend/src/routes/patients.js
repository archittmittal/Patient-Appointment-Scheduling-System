const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get a patient's simple profile
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM patients p JOIN users u ON p.id = u.id WHERE p.id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Patient not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a patient's appointments — supports ?type=upcoming|past (default: upcoming)
router.get('/:id/appointments', async (req, res) => {
    try {
        const type = req.query.type || 'upcoming';

        let whereClause;
        let orderClause;
        if (type === 'past') {
            // Completed/cancelled OR in the past
            whereClause = `a.patient_id = ? AND (a.appointment_date < CURDATE() OR a.status IN ('COMPLETED', 'CANCELLED'))`;
            orderClause = 'ORDER BY a.appointment_date DESC';
        } else if (type === 'all') {
            whereClause = `a.patient_id = ?`;
            orderClause = 'ORDER BY a.appointment_date DESC';
        } else {
            // upcoming: today or future, not cancelled/completed
            whereClause = `a.patient_id = ? AND a.appointment_date >= CURDATE() AND a.status IN ('CONFIRMED', 'PENDING')`;
            orderClause = 'ORDER BY a.appointment_date ASC';
        }

        const query = `
            SELECT a.id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
                   a.time_slot, a.symptoms, a.status,
                   d.first_name as doc_first, d.last_name as doc_last, d.specialty, d.location_room
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE ${whereClause}
            ${orderClause}
        `;
        const [rows] = await db.query(query, [req.params.id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
