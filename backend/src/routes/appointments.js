const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Book an appointment (simplified)
router.post('/book', async (req, res) => {
    try {
        const { patientId, doctorId, date, timeSlot } = req.body;

        // In production, validate inputs, check slot availability, etc.
        const [result] = await db.query(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, status) VALUES (?, ?, ?, ?, ?)',
            [patientId, doctorId, date, timeSlot, 'CONFIRMED']
        );

        // Also inject into live queue if date is today (logic simplified)
        const [queueResult] = await db.query(
            'INSERT INTO live_queue (appointment_id, queue_number, estimated_time) VALUES (?, ?, ?)',
            [result.insertId, Math.floor(Math.random() * 20) + 5, 45] // simplified mock numbers
        );

        res.status(201).json({ message: 'Appointment booked successfully', appointmentId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error booking appointment' });
    }
});

// Get Live Queue for an appointment/patient
router.get('/queue/:appointmentId', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM live_queue WHERE appointment_id = ?', [req.params.appointmentId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Queue data not found' });
        }

        res.json({
            ...rows[0],
            currentToken: 14, // Mock dynamic value
            queueSequence: [ // Mock broader sequence
                { number: 12, name: "Maria Garcia", status: "Completed", time: "10:15 AM", isCurrent: false },
                { number: 13, name: "James Smith", status: "Completed", time: "10:30 AM", isCurrent: false },
                { number: 14, name: "Emma Johnson", status: "In Progress", time: "10:45 AM", isCurrent: true }
            ]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
