const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const exportService = require('../services/exportService');
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient profile and history
 */

/**
 * @swagger
 * /api/patients/{id}:
 *   get:
 *     summary: Get patient profile by ID
 *     tags: [Patients]
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
 *         description: Patient profile retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Patient not found
 */
/**
 * @swagger
 * /api/patients/{id}/appointments:
 *   get:
 *     summary: Get patient's appointments
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [upcoming, past, all]
 *     responses:
 *       200:
 *         description: List of appointments retrieved successfully
 */
// Get a patient's simple profile
router.get('/:id', authenticate, async (req, res) => {
    // Check if the user is authorized to view this profile
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN' && req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
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

// PATCH /api/patients/:id — update editable profile fields
router.patch('/:id', authenticate, async (req, res) => {
    // Only the patient themselves can update their profile
    if (req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const { first_name, last_name, phone, address, blood_group } = req.body;
        await db.query(
            `UPDATE patients SET
                first_name  = COALESCE(?, first_name),
                last_name   = COALESCE(?, last_name),
                phone       = COALESCE(?, phone),
                address     = COALESCE(?, address),
                blood_group = COALESCE(?, blood_group)
             WHERE id = ?`,
            [first_name ?? null, last_name ?? null, phone ?? null, address ?? null, blood_group ?? null, req.params.id]
        );
        const [rows] = await db.query('SELECT * FROM patients p JOIN users u ON p.id = u.id WHERE p.id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a patient's appointments — supports ?type=upcoming|past (default: upcoming)
router.get('/:id/appointments', authenticate, async (req, res) => {
    // Check authorization: doctors/admins or the patient themselves
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN' && req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const type = req.query.type || 'upcoming';

        let whereClause;
        let orderClause;
        if (type === 'past') {
            // Completed/cancelled OR in the past
            whereClause = `a.patient_id = ? AND (a.appointment_date < CURDATE() OR a.status IN ('COMPLETED', 'CANCELLED', 'MISSED'))`;
            orderClause = 'ORDER BY a.appointment_date DESC';
        } else if (type === 'all') {
            whereClause = `a.patient_id = ?`;
            orderClause = 'ORDER BY a.appointment_date DESC';
        } else {
            // upcoming: today or future, not cancelled/completed
            whereClause = `a.patient_id = ? AND a.appointment_date >= CURDATE() AND a.status IN ('CONFIRMED', 'PENDING', 'WAITING', 'IN_PROGRESS')`;
            orderClause = 'ORDER BY a.appointment_date ASC';
        }

        const query = `
            SELECT a.id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
                   a.time_slot, a.symptoms, a.status, a.prescription, a.diagnosis, a.notes, DATE_FORMAT(a.follow_up_date, '%Y-%m-%d') AS follow_up_date,
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

const prescriptionService = require('../services/prescriptionService');
const vitalsService = require('../services/vitalsService');

// ... (existing routes)

// Issue #94: Get patient prescriptions
router.get('/:id/prescriptions', authenticate, async (req, res) => {
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN' && req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const data = await prescriptionService.getPatientPrescriptions(req.params.id);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching prescriptions' });
    }
});

// Issue #95: Get patient vitals history
router.get('/:id/vitals', authenticate, async (req, res) => {
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN' && req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const data = await vitalsService.getPatientVitals(req.params.id);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching vitals' });
    }
});

const vitalsSchema = Joi.object({
    weight_kg: Joi.number().min(1).max(500).allow(null),
    height_cm: Joi.number().min(20).max(300).allow(null),
    blood_pressure_sys: Joi.number().min(40).max(300).allow(null),
    blood_pressure_dia: Joi.number().min(30).max(200).allow(null),
    heart_rate: Joi.number().min(30).max(250).allow(null),
    temperature_c: Joi.number().min(30).max(45).allow(null)
}).min(1);

// Issue #95: Log new vitals
router.post('/:id/vitals', authenticate, validateRequest(vitalsSchema), async (req, res) => {
    // Both patients (self-logging) and doctors can log vitals
    if (req.user.role !== 'DOCTOR' && req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const data = await vitalsService.logVitals(req.params.id, req.body, req.user.id);
        res.status(201).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error logging vitals' });
    }
});

// Issue #110: Export patient vitals as CSV
router.get('/:id/vitals/export', authenticate, async (req, res) => {
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'ADMIN' && req.user.id != req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        await exportService.exportVitalsCSV(req.params.id, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error exporting vitals' });
    }
});

module.exports = router;
