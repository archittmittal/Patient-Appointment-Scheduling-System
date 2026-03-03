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

// GET /api/admin/stats — extended overview stats
router.get('/stats', async (req, res) => {
    try {
        const [[{ total_doctors }]] = await db.query('SELECT COUNT(*) AS total_doctors FROM doctors');
        const [[{ total_patients }]] = await db.query('SELECT COUNT(*) AS total_patients FROM patients');
        const [[{ total_appointments }]] = await db.query('SELECT COUNT(*) AS total_appointments FROM appointments');
        const [[{ today_total }]] = await db.query(
            "SELECT COUNT(*) AS today_total FROM appointments WHERE appointment_date = CURDATE()"
        );
        const [[{ today_confirmed }]] = await db.query(
            "SELECT COUNT(*) AS today_confirmed FROM appointments WHERE appointment_date = CURDATE() AND status = 'CONFIRMED'"
        );
        const [[{ today_completed }]] = await db.query(
            "SELECT COUNT(*) AS today_completed FROM appointments WHERE appointment_date = CURDATE() AND status = 'COMPLETED'"
        );
        const [[{ today_pending }]] = await db.query(
            "SELECT COUNT(*) AS today_pending FROM appointments WHERE appointment_date = CURDATE() AND status = 'PENDING'"
        );
        const [[{ today_cancelled }]] = await db.query(
            "SELECT COUNT(*) AS today_cancelled FROM appointments WHERE appointment_date = CURDATE() AND status = 'CANCELLED'"
        );

        // Top 5 doctors by appointment count today
        const [top_doctors_today] = await db.query(`
            SELECT d.id, d.first_name, d.last_name, d.specialty,
                   COUNT(a.id) AS count
            FROM doctors d
            LEFT JOIN appointments a ON d.id = a.doctor_id AND a.appointment_date = CURDATE()
            GROUP BY d.id
            ORDER BY count DESC
            LIMIT 5
        `);

        res.json({
            total_doctors, total_patients, total_appointments,
            today_total, today_confirmed, today_completed, today_pending, today_cancelled,
            // backward compat alias
            today_appointments: today_total,
            top_doctors_today,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/queue-overview — today's live queue grouped by doctor
router.get('/queue-overview', async (req, res) => {
    try {
        // All doctors who have appointments today
        const [doctors] = await db.query(`
            SELECT DISTINCT d.id, d.first_name, d.last_name, d.specialty
            FROM doctors d
            JOIN appointments a ON a.doctor_id = d.id
            WHERE a.appointment_date = CURDATE()
            ORDER BY d.first_name
        `);

        const result = [];

        for (const doc of doctors) {
            const [queue] = await db.query(`
                SELECT lq.id AS queue_id, lq.queue_number, lq.status AS queue_status,
                       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                       a.time_slot
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                JOIN patients p ON a.patient_id = p.id
                WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
                ORDER BY lq.queue_number ASC
            `, [doc.id]);

            const counts = { WAITING: 0, IN_PROGRESS: 0, COMPLETED: 0, MISSED: 0 };
            queue.forEach(q => { counts[q.queue_status] = (counts[q.queue_status] || 0) + 1; });

            const [[{ total_today }]] = await db.query(
                'SELECT COUNT(*) AS total_today FROM appointments WHERE doctor_id = ? AND appointment_date = CURDATE()',
                [doc.id]
            );

            result.push({
                doctor_id: doc.id,
                doctor_name: `Dr. ${doc.first_name} ${doc.last_name}`,
                specialty: doc.specialty,
                total_today: Number(total_today),
                waiting:     counts.WAITING,
                in_progress: counts.IN_PROGRESS,
                completed:   counts.COMPLETED,
                missed:      counts.MISSED,
                queue,
            });
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
