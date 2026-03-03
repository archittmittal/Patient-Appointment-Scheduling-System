const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/admin/users — all users with profile info
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, email, role, created_at FROM users ORDER BY role, id');
        const result = [];

        for (const user of users) {
            let name = 'Admin';
            let extra = {};
            if (user.role === 'PATIENT') {
                const [rows] = await db.query('SELECT first_name, last_name, phone, blood_group FROM patients WHERE id = ?', [user.id]);
                if (rows.length > 0) {
                    name = `${rows[0].first_name} ${rows[0].last_name}`;
                    extra = rows[0];
                }
            } else if (user.role === 'DOCTOR') {
                const [rows] = await db.query('SELECT first_name, last_name, specialty, location_room FROM doctors WHERE id = ?', [user.id]);
                if (rows.length > 0) {
                    name = `${rows[0].first_name} ${rows[0].last_name}`;
                    extra = rows[0];
                }
            }
            result.push({ ...user, name, ...extra });
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/doctors — add a new doctor
router.post('/doctors', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { email, password, first_name, last_name, specialty, degree, experience_years, location_room } = req.body;
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, password, 'DOCTOR']
        );
        const newId = userResult.insertId;

        await conn.query(
            'INSERT INTO doctors (id, first_name, last_name, specialty, degree, experience_years, location_room, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, first_name, last_name, specialty, degree || '', experience_years || 0, location_room || '',
             `https://ui-avatars.com/api/?name=${encodeURIComponent(first_name + '+' + last_name)}&background=random`]
        );

        await conn.commit();
        res.status(201).json({ message: 'Doctor added successfully', id: newId });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

// DELETE /api/admin/doctors/:id
router.delete('/doctors/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ? AND role = ?', [req.params.id, 'DOCTOR']);
        res.json({ message: 'Doctor removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/patients — add a new patient
router.post('/patients', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { email, password, first_name, last_name, dob, phone, blood_group, address } = req.body;
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, password, 'PATIENT']
        );
        const newId = userResult.insertId;

        await conn.query(
            'INSERT INTO patients (id, first_name, last_name, dob, phone, blood_group, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newId, first_name, last_name, dob || null, phone || '', blood_group || '', address || '']
        );

        await conn.commit();
        res.status(201).json({ message: 'Patient added successfully', id: newId });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

// DELETE /api/admin/patients/:id
router.delete('/patients/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ? AND role = ?', [req.params.id, 'PATIENT']);
        res.json({ message: 'Patient removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/appointments — all appointments
router.get('/appointments', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.id, a.appointment_date, a.time_slot, a.symptoms, a.status, a.created_at,
                   p.first_name AS patient_first, p.last_name AS patient_last,
                   d.first_name AS doctor_first, d.last_name AS doctor_last,
                   d.specialty, d.location_room
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            ORDER BY a.appointment_date DESC, a.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/stats — overview stats
router.get('/stats', async (req, res) => {
    try {
        const [[{ total_doctors }]] = await db.query('SELECT COUNT(*) AS total_doctors FROM doctors');
        const [[{ total_patients }]] = await db.query('SELECT COUNT(*) AS total_patients FROM patients');
        const [[{ today_appointments }]] = await db.query(
            "SELECT COUNT(*) AS today_appointments FROM appointments WHERE appointment_date = CURDATE()"
        );
        res.json({ total_doctors, total_patients, today_appointments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
