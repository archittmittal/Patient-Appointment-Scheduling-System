const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { bcryptRounds } = require('../config/auth');
const cache = require('../config/memoryCache');
const logger = require('../config/logger');

// Cache TTL for the real-time queue overview snapshot (milliseconds).
const QUEUE_OVERVIEW_CACHE_TTL = 5000;

const BCRYPT_ROUNDS = bcryptRounds || 10;

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

// DB-003: Validation schema for paginated appointments listing
const appointmentsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'SCHEDULED', 'ALL').default('ALL'),
    date: Joi.string().isoDate().allow('', null)
});

// DB-007 (Day-7): Cursor-based pagination schema for the simple patient list.
// max 50 rows per page; cursor is the last seen patient id (0 = start from beginning).
const patientsListQuerySchema = Joi.object({
    cursor: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(50).default(50)
});

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations for managing doctors, patients, appointments, and overall system status
 */

/**
 * @swagger
 * /api/admin/patients/list:
 *   get:
 *     summary: Get a cursor-paginated list of patients (max 50 per page)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Last seen patient id (0 to start from the beginning)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 50
 *         description: Number of rows to return (1–50)
 *     responses:
 *       200:
 *         description: >
 *           { data: [{id, name}], nextCursor: <number|null> }
 *           nextCursor is null when there are no more pages.
 *       400:
 *         description: Validation error (limit > 50 etc.)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
// DB-007 (Day-7): Cursor-based pagination — avoids full-table scans on large
// patient datasets.  Uses keyset pagination on the primary key (id > cursor)
// which is O(log N) with the PK index, unlike OFFSET which degrades as N grows.
router.get('/patients/list', validateRequest(patientsListQuerySchema, 'query'), async (req, res) => {
    try {
        const { cursor, limit } = req.query;
        // Fetch one extra row beyond the requested limit to reliably detect whether
        // more pages exist.  If rows.length === limit, the final page might also
        // happen to have exactly `limit` rows — we would wrongly set nextCursor.
        // Fetching limit+1 removes that ambiguity.
        const [rows] = await db.query(
            `SELECT id, CONCAT(first_name, ' ', last_name) AS name
             FROM patients
             WHERE id > ?
             ORDER BY id ASC
             LIMIT ?`,
            [cursor, limit + 1]
        );
        // If the extra row came back there is at least one more page.
        // Capture its cursor position before trimming the array.
        const hasMore = rows.length > limit;
        const nextCursor = hasMore ? rows[limit - 1].id : null;
        res.json({ data: hasMore ? rows.slice(0, limit) : rows, nextCursor });
    } catch (error) {
        logger.error(error);
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

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Retrieve a paginated, sorted list of all users with profile information
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [PATIENT, DOCTOR, ADMIN, ALL]
 *           default: ALL
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [id, name, created_at, role]
 *           default: id
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC, asc, desc]
 *           default: ASC
 *     responses:
 *       200:
 *         description: Paginated users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
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

/**
 * @swagger
 * /api/admin/doctors:
 *   post:
 *     summary: Add a new doctor to the system
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - first_name
 *               - last_name
 *               - specialty
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               specialty:
 *                 type: string
 *               degree:
 *                 type: string
 *               experience_years:
 *                 type: integer
 *               location_room:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doctor added successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 *       409:
 *         description: Email already exists
 */
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
        logger.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

/**
 * @swagger
 * /api/admin/doctors/{id}:
 *   delete:
 *     summary: Remove a doctor by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
router.delete('/doctors/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ? AND role = ?', [req.params.id, 'DOCTOR']);
        res.json({ message: 'Doctor removed' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/patients:
 *   post:
 *     summary: Add a new patient to the system
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - first_name
 *               - last_name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               phone:
 *                 type: string
 *               blood_group:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Patient added successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 *       409:
 *         description: Email already exists
 */
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
        logger.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

/**
 * @swagger
 * /api/admin/patients/{id}:
 *   delete:
 *     summary: Remove a patient by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patient removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
router.delete('/patients/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ? AND role = ?', [req.params.id, 'PATIENT']);
        res.json({ message: 'Patient removed' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/patients/search:
 *   get:
 *     summary: Search patients by name or phone number
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 2 characters)
 *     responses:
 *       200:
 *         description: List of matching patients retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
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
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/appointments:
 *   get:
 *     summary: Retrieve a paginated list of all appointments in the system
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmed, pending, completed, cancelled, scheduled, ALL]
 *           default: ALL
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Paginated list of appointments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
router.get('/appointments', validateRequest(appointmentsQuerySchema, 'query'), async (req, res) => {
    try {
        const { page, limit, status, date } = req.query;
        const offset = (page - 1) * limit;

        // Build optional WHERE clauses
        const conditions = [];
        const filterParams = [];

        // DB-003: status filter (ALL = no filter)
        if (status && status !== 'ALL') {
            conditions.push('a.status = ?');
            filterParams.push(status.toUpperCase());
        }

        // DB-003: optional exact date filter
        if (date) {
            conditions.push('a.appointment_date = ?');
            filterParams.push(date);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count query
        const [countResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN doctors d ON a.doctor_id = d.id
             ${whereClause}`,
            filterParams
        );
        const total = countResult[0].total;

        // Data query with pagination
        const [rows] = await db.query(
            `SELECT a.id, a.appointment_date, a.time_slot, a.symptoms, a.status, a.created_at,
                    p.first_name AS patient_first, p.last_name AS patient_last,
                    d.first_name AS doctor_first, d.last_name AS doctor_last,
                    d.specialty, d.location_room
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN doctors d ON a.doctor_id = d.id
             ${whereClause}
             ORDER BY a.appointment_date DESC, a.created_at DESC
             LIMIT ? OFFSET ?`,
            [...filterParams, limit, offset]
        );

        res.json({
            data: rows,
            meta: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get administrative statistics overview and top doctors today
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overall dashboard stats retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
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
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/queue-overview:
 *   get:
 *     summary: Get live queue status overview for all doctors today
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complete live queue overview retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 */
router.get('/queue-overview', async (req, res) => {
    // DB-007 (Day-7): Serve from in-process cache when the snapshot is fresh.
    // The queue-overview is polled every few seconds by the admin dashboard;
    // caching for 5 s eliminates redundant DB hits without staling the UX.
    const CACHE_KEY = 'admin:queue-overview';
    const cached = cache.get(CACHE_KEY);
    if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
    }

    try {
        // DB-007 (Day-7): Replace the per-doctor correlated subquery with a
        // pre-aggregated LEFT JOIN so doc_total_today costs one GROUP BY scan
        // instead of one COUNT(*) subquery per doctor row (N+1 fix).
        const [rows] = await db.query(`
            SELECT 
                d.id AS doctor_id, d.first_name, d.last_name, d.specialty,
                lq.id AS queue_id, lq.queue_number, lq.status AS queue_status,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                a.time_slot,
                COALESCE(agg.total_today, 0) AS doc_total_today
            FROM doctors d
            LEFT JOIN appointments a
                   ON a.doctor_id = d.id AND a.appointment_date = CURDATE()
            LEFT JOIN live_queue lq ON lq.appointment_id = a.id
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN (
                SELECT doctor_id, COUNT(*) AS total_today
                FROM appointments
                WHERE appointment_date = CURDATE()
                GROUP BY doctor_id
            ) agg ON agg.doctor_id = d.id
            WHERE a.id IS NOT NULL
               OR d.id IN (SELECT DISTINCT doctor_id FROM appointments WHERE appointment_date = CURDATE())
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
                if (row.queue_status === 'WAITING')     doc.waiting++;
                else if (row.queue_status === 'IN_PROGRESS') doc.in_progress++;
                else if (row.queue_status === 'COMPLETED')   doc.completed++;
                else if (row.queue_status === 'MISSED')      doc.missed++;
            }
        });

        const result = Array.from(doctorMap.values());

        // Store in cache for QUEUE_OVERVIEW_CACHE_TTL ms before next DB hit.
        cache.set(CACHE_KEY, result, QUEUE_OVERVIEW_CACHE_TTL);
        res.setHeader('X-Cache', 'MISS');
        res.json(result);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// DEPARTMENTS MANAGEMENT ROUTES
// ============================================

const addDepartmentSchema = Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(1000).allow('', null)
});

/**
 * @swagger
 * /api/admin/departments:
 *   get:
 *     summary: Get all departments with doctor stats
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments retrieved successfully
 */
router.get('/departments', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                dep.id, dep.name, dep.description, dep.created_at,
                COUNT(d.id) AS doctor_count,
                JSON_ARRAYAGG(
                    IF(d.id IS NOT NULL, 
                       JSON_OBJECT('id', d.id, 'name', CONCAT('Dr. ', d.first_name, ' ', d.last_name)), 
                       NULL)
                ) AS doctors
            FROM departments dep
            LEFT JOIN doctors d ON dep.name = d.specialty
            GROUP BY dep.id
            ORDER BY dep.name
        `);
        
        const result = rows.map(r => {
            let docs = [];
            try {
                const parsedDocs = typeof r.doctors === 'string' ? JSON.parse(r.doctors) : r.doctors;
                docs = Array.isArray(parsedDocs) ? parsedDocs.filter(Boolean) : [];
            } catch (e) {
                // If JSON parsing fails or JSON_ARRAYAGG returns something else
                docs = [];
            }
            return {
                id: r.id,
                name: r.name,
                description: r.description,
                created_at: r.created_at,
                doctor_count: r.doctor_count,
                doctors: docs
            };
        });
        
        res.json(result);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/departments:
 *   post:
 *     summary: Add a new department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department added successfully
 */
router.post('/departments', validateRequest(addDepartmentSchema), async (req, res) => {
    try {
        const { name, description } = req.body;
        const [result] = await db.query(
            'INSERT INTO departments (name, description) VALUES (?, ?)',
            [name, description || null]
        );
        res.status(201).json({ id: result.insertId, name, description });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Department already exists' });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/admin/departments/{id}:
 *   delete:
 *     summary: Remove a department by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Department removed successfully
 */
router.delete('/departments/:id', async (req, res) => {
    try {
        const [depRows] = await db.query('SELECT name FROM departments WHERE id = ?', [req.params.id]);
        if (depRows.length === 0) {
            return res.status(404).json({ message: 'Department not found' });
        }
        const depName = depRows[0].name;

        const [docRows] = await db.query('SELECT id FROM doctors WHERE specialty = ?', [depName]);
        if (docRows.length > 0) {
            return res.status(400).json({ message: 'Cannot delete department. There are doctors assigned to it.' });
        }

        await db.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            return res.status(400).json({ message: 'Cannot delete department. There are doctors assigned to it.' });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

