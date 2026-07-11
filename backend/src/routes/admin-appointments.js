const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../config/db');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');
const cache = require('../config/memoryCache');
const logger = require('../config/logger');

const QUEUE_OVERVIEW_CACHE_TTL = 5000;

const appointmentsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'SCHEDULED', 'ALL').default('ALL'),
    date: Joi.string().isoDate().allow('', null)
});

// All admin appointments routes require authenticate + requireRole('ADMIN')
router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /api/admin/appointments
router.get('/appointments', validateRequest(appointmentsQuerySchema, 'query'), async (req, res) => {
    try {
        const { page, limit, status, date } = req.query;
        const offset = (page - 1) * limit;

        const conditions = [];
        const filterParams = [];

        if (status && status !== 'ALL') {
            conditions.push('a.status = ?');
            filterParams.push(status.toUpperCase());
        }

        if (date) {
            conditions.push('a.appointment_date = ?');
            filterParams.push(date);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [countResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN doctors d ON a.doctor_id = d.id
             ${whereClause}`,
            filterParams
        );
        const total = countResult[0].total;

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

// GET /api/admin/stats
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
            today_appointments: stats.today_total,
            top_doctors_today,
        });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/queue-overview
router.get('/queue-overview', async (req, res) => {
    const CACHE_KEY = 'admin:queue-overview';
    const cached = cache.get(CACHE_KEY);
    if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
    }

    try {
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

                if (row.queue_status === 'WAITING')     doc.waiting++;
                else if (row.queue_status === 'IN_PROGRESS') doc.in_progress++;
                else if (row.queue_status === 'COMPLETED')   doc.completed++;
                else if (row.queue_status === 'MISSED')      doc.missed++;
            }
        });

        const result = Array.from(doctorMap.values());

        cache.set(CACHE_KEY, result, QUEUE_OVERVIEW_CACHE_TTL);
        res.setHeader('X-Cache', 'MISS');
        res.json(result);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

const reorderQueueSchema = Joi.object({
    doctorId: Joi.number().integer().required(),
    queueIds: Joi.array().items(Joi.number().integer()).min(1).max(1000).required()
});

// POST /api/admin/reorder-queue
router.post('/reorder-queue', validateRequest(reorderQueueSchema), async (req, res) => {
    const { doctorId, queueIds } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(queueIds) || queueIds.length > 1000) {
        return res.status(400).json({ message: 'Invalid queue length' });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // Update queue_number sequentially based on the order of queueIds
        for (let i = 0; i < queueIds.length; i++) {
            const queueId = queueIds[i];
            await conn.query(
                'UPDATE live_queue SET queue_number = ? WHERE id = ?',
                [i + 1, queueId]
            );
        }

        await conn.commit();

        // Audit logging
        logger.info('Admin reordered queue', {
            adminId,
            doctorId,
            queueIds
        });

        // Clear cache
        cache.invalidate('admin:queue-overview');

        // Broadcast real-time SSE updates
        const sseManager = require('../services/sseManager');
        const virtualCheckinService = require('../services/virtualCheckinService');

        // 1. Broadcast to doctor
        sseManager.broadcastToDoctor(doctorId, 'queue_update', { message: 'Queue reordered by administrator' });

        // 2. Broadcast to all active appointments for this doctor today
        const [appointments] = await db.query(
            `SELECT id, patient_id FROM appointments 
             WHERE doctor_id = ? 
               AND appointment_date = CURDATE() 
               AND status IN ('CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_PROGRESS', 'WAITING')`,
            [doctorId]
        );

        for (const apt of appointments) {
            const activeStatus = await virtualCheckinService.getWaitingRoomStatus(apt.id, apt.patient_id);
            if (activeStatus) {
                sseManager.broadcastQueueUpdate(apt.id, activeStatus);
            }
        }

        res.json({ success: true, message: 'Queue reordered successfully' });
    } catch (error) {
        await conn.rollback();
        logger.error('Failed to reorder queue:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        conn.release();
    }
});

module.exports = router;
