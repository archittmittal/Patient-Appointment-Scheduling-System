const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');

const BCRYPT_ROUNDS = 10;

// Validation Schemas
const addDoctorSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().max(50).required(),
    last_name: Joi.string().max(50).required(),
    specialty: Joi.string().max(100).required(),
    degree: Joi.string().max(100),
    experience_years: Joi.number().min(0).max(100),
    location_room: Joi.string().max(20)
});

const addPatientSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().max(50).required(),
    last_name: Joi.string().max(50).required(),
    dob: Joi.string().isoDate(),
    phone: Joi.string().max(20),
    blood_group: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
    address: Joi.string().max(255)
});

const usersQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('PATIENT', 'DOCTOR', 'ADMIN', 'ALL').default('ALL'),
    sort_by: Joi.string().valid('id', 'name', 'created_at', 'role').default('id'),
    order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC')
});

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
// Allowed sort columns — explicit whitelist to prevent SQL injection on ORDER BY
const ALLOWED_SORT = {
    id: 'u.id',
    name: "COALESCE(p.first_name, d.first_name, 'Admin')",
    created_at: 'u.created_at',
    role: 'u.role'
};

router.get('/users', validateRequest(usersQuerySchema, 'query'), async (req, res) => {
    try {
        const { page, limit, role, sort_by, order: orderRaw } = req.query;
        const offset = (page - 1) * limit;

        const sortColumn = ALLOWED_SORT[sort_by] || ALLOWED_SORT.id;
        const order = orderRaw.toUpperCase();

        let whereClause = '';
        const filterParams = [];

        if (role && role !== 'ALL') {
            whereClause = 'WHERE u.role = ?';
            filterParams.push(role);
        }

        const orderByClause = sortColumn === ALLOWED_SORT.role
            ? `ORDER BY ${sortColumn} ${order}, u.id ASC`
            : `ORDER BY ${sortColumn} ${order}`;

        // --- Count query (uses only filterParams) ---
        const countQuery = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;
        const [countResult] = await db.query(countQuery, filterParams);
        const total = countResult[0].total;

        // --- Data query (clone filterParams + append limit/offset) ---
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

        const dataParams = [...filterParams, limit, offset];
        const [rows] = await db.query(dataQuery, dataParams);

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
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/doctors — add a new doctor
router.post('/doctors', validateRequest(addDoctorSchema), async (req, res) => {
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
router.post('/patients', validateRequest(addPatientSchema), async (req, res) => {
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

// GET /api/admin/stats — extended overview stats (Consolidated Query)
router.get('/stats', async (req, res) => {
    try {
        const [statsRows] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM doctors) AS total_doctors,
                (SELECT COUNT(*) FROM patients) AS total_patients,
                (SELECT COUNT(*) FROM appointments) AS total_appointments,
                COUNT(CASE WHEN appointment_date = CURDATE() THEN 1 END) AS today_total,
                COUNT(CASE WHEN appointment_date = CURDATE() AND status = 'CONFIRMED' THEN 1 END) AS today_confirmed,
                COUNT(CASE WHEN appointment_date = CURDATE() AND status = 'COMPLETED' THEN 1 END) AS today_completed,
                COUNT(CASE WHEN appointment_date = CURDATE() AND status = 'PENDING' THEN 1 END) AS today_pending,
                COUNT(CASE WHEN appointment_date = CURDATE() AND status = 'CANCELLED' THEN 1 END) AS today_cancelled
            FROM appointments
        `);
        
        const stats = statsRows[0];

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
            ...stats,
            today_appointments: stats.today_total, // backward compat
            top_doctors_today,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/queue-overview — today's live queue (Optimized JOIN version)
router.get('/queue-overview', async (req, res) => {
    try {
        // Single query to get all data: Doctors and their Live Queue entries for today
        const [rows] = await db.query(`
            SELECT 
                d.id AS doctor_id, d.first_name, d.last_name, d.specialty,
                lq.id AS queue_id, lq.queue_number, lq.status AS queue_status,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                a.time_slot,
                (SELECT COUNT(*) FROM appointments WHERE doctor_id = d.id AND appointment_date = CURDATE()) AS doc_total_today
            FROM doctors d
            LEFT JOIN appointments a ON a.doctor_id = d.id AND a.appointment_date = CURDATE()
            LEFT JOIN live_queue lq ON lq.appointment_id = a.id
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.id IS NOT NULL OR d.id IN (SELECT DISTINCT doctor_id FROM appointments WHERE appointment_date = CURDATE())
            ORDER BY d.first_name, lq.queue_number ASC
        `);

        // Group rows by doctor in memory
        const doctorMap = new Map();

        rows.forEach(row => {
            if (!doctorMap.has(row.doctor_id)) {
                doctorMap.set(row.doctor_id, {
                    doctor_id: row.doctor_id,
                    doctor_name: `Dr. ${row.first_name} ${row.last_name}`,
                    specialty: row.specialty,
                    total_today: Number(row.doc_total_today),
                    waiting: 0,
                    in_progress: 0,
                    completed: 0,
                    missed: 0,
                    queue: []
                });
            }

            const doc = doctorMap.get(row.doctor_id);
            
            if (row.queue_id) {
                doc.queue.push({
                    queue_id: row.queue_id,
                    queue_number: row.queue_number,
                    queue_status: row.queue_status,
                    patient_name: row.patient_name,
                    time_slot: row.time_slot
                });

                // Update counters
                if (row.queue_status === 'WAITING') doc.waiting++;
                else if (row.queue_status === 'IN_PROGRESS') doc.in_progress++;
                else if (row.queue_status === 'COMPLETED') doc.completed++;
                else if (row.queue_status === 'MISSED') doc.missed++;
            }
        });

        res.json(Array.from(doctorMap.values()));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
