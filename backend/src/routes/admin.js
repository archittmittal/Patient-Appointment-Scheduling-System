const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authenticate');

const BCRYPT_ROUNDS = 10;

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /api/admin/patients/list — simple list of all patients
router.get('/patients/list', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, CONCAT(first_name, " ", last_name) AS name FROM patients ORDER BY first_name');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/users — all users with profile info
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const role = req.query.role;
        const sortBy = req.query.sort_by || 'id';
        const order = req.query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        let whereClause = '';
        let queryParams = [];

        if (role && role !== 'ALL') {
            whereClause = 'WHERE u.role = ?';
            queryParams.push(role);
        }

        let orderByClause = '';
        if (sortBy === 'name') {
            orderByClause = `ORDER BY COALESCE(p.first_name, d.first_name, 'Admin') ${order}`;
        } else if (sortBy === 'created_at') {
            orderByClause = `ORDER BY u.created_at ${order}`;
        } else if (sortBy === 'role') {
            orderByClause = `ORDER BY u.role ${order}, u.id ASC`;
        } else {
            orderByClause = `ORDER BY u.id ${order}`;
        }

        const countQuery = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;
        const [countResult] = await db.query(countQuery, queryParams);
        const total = countResult[0].total;

        const dataQuery = `
            SELECT 
                u.id, u.email, u.role, u.created_at,
                p.first_name AS p_first, p.last_name AS p_last, p.phone, p.blood_group,
                d.first_name AS d_first, d.last_name AS d_last, d.specialty, d.location_room
            FROM users u
            LEFT JOIN patients p ON u.id = p.id
            LEFT JOIN doctors d ON u.id = d.id
            ${whereClause}
            ${orderByClause}
            LIMIT ? OFFSET ?
        `;
        
        queryParams.push(limit, offset);
        const [rows] = await db.query(dataQuery, queryParams);

        const users = rows.map(row => {
            let name = 'Admin';
            let extra = {};
            if (row.role === 'PATIENT') {
                name = `${row.p_first || ''} ${row.p_last || ''}`.trim();
                extra = {
                    first_name: row.p_first,
                    last_name: row.p_last,
                    phone: row.phone,
                    blood_group: row.blood_group
                };
            } else if (row.role === 'DOCTOR') {
                name = `${row.d_first || ''} ${row.d_last || ''}`.trim();
                extra = {
                    first_name: row.d_first,
                    last_name: row.d_last,
                    specialty: row.specialty,
                    location_room: row.location_room
                };
            }
            return {
                id: row.id,
                email: row.email,
                role: row.role,
                created_at: row.created_at,
                name: name || 'Unknown',
                ...extra
            };
        });

        res.json({
            data: users,
            meta: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit)
            }
        });
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
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, passwordHash, 'DOCTOR']
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
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, passwordHash, 'PATIENT']
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

// GET /api/admin/patients/search?q=... — search patients by name or phone
router.get('/patients/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        if (query.length < 2) return res.json([]);

        const [patients] = await db.query(`
            SELECT p.id, p.first_name, p.last_name, p.phone, p.blood_group, u.email
            FROM patients p
            JOIN users u ON p.id = u.id
            WHERE p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ?
            LIMIT 10
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);

        res.json(patients);
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
        const [_rows1] = await db.query('SELECT COUNT(*) AS total_doctors FROM doctors');
        const { total_doctors } = _rows1[0] || {};
        const [_rows2] = await db.query('SELECT COUNT(*) AS total_patients FROM patients');
        const { total_patients } = _rows2[0] || {};
        const [_rows3] = await db.query('SELECT COUNT(*) AS total_appointments FROM appointments');
        const { total_appointments } = _rows3[0] || {};
        const [_rows4] = await db.query(
            "SELECT COUNT(*) AS today_total FROM appointments WHERE appointment_date = CURDATE()"
        );
        const { today_total } = _rows4[0] || {};
        const [_rows5] = await db.query(
            "SELECT COUNT(*) AS today_confirmed FROM appointments WHERE appointment_date = CURDATE() AND status = 'CONFIRMED'"
        );
        const { today_confirmed } = _rows5[0] || {};
        const [_rows6] = await db.query(
            "SELECT COUNT(*) AS today_completed FROM appointments WHERE appointment_date = CURDATE() AND status = 'COMPLETED'"
        );
        const { today_completed } = _rows6[0] || {};
        const [_rows7] = await db.query(
            "SELECT COUNT(*) AS today_pending FROM appointments WHERE appointment_date = CURDATE() AND status = 'PENDING'"
        );
        const { today_pending } = _rows7[0] || {};
        const [_rows8] = await db.query(
            "SELECT COUNT(*) AS today_cancelled FROM appointments WHERE appointment_date = CURDATE() AND status = 'CANCELLED'"
        );
        const { today_cancelled } = _rows8[0] || {};

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

            const [_rows9] = await db.query(
                'SELECT COUNT(*) AS total_today FROM appointments WHERE doctor_id = ? AND appointment_date = CURDATE()',
                [doc.id]
            );
            const { total_today } = _rows9[0] || {};

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
