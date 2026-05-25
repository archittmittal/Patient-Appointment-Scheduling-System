/**
 * Issue #47: Late Arrival Routes
 * API endpoints for late arrival handling
 */

const express = require('express');
const router = express.Router();
const lateArrivalService = require('../services/lateArrivalService');
const { authenticate } = require('../middleware/authenticate');

/**
 * @swagger
 * tags:
 *   name: LateArrival
 *   description: Handling late arrival detection, grace period configuration, options processing, and analytics
 */

/**
 * @swagger
 * /api/late-arrival/check/{appointmentId}:
 *   get:
 *     summary: Check late status for an appointment
 *     tags: [LateArrival]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: integer
 *         description: Patient ID (Required if user role is not patient)
 *     responses:
 *       200:
 *         description: Late status and options retrieved successfully
 *       400:
 *         description: Patient ID required
 *       500:
 *         description: Server error
 */
router.get('/check/:appointmentId', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.role === 'patient' ? req.user.id : req.query.patientId;

        if (!patientId) {
            return res.status(400).json({ error: 'Patient ID required' });
        }

        const status = await lateArrivalService.checkLateStatus(appointmentId, patientId);
        res.json(status);
    } catch (err) {
        console.error('Check late status error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/late-arrival/process:
 *   post:
 *     summary: Process late arrival option selection (e.g. reschedule, proceed with wait, etc.)
 *     tags: [LateArrival]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *               - optionId
 *             properties:
 *               appointmentId:
 *                 type: integer
 *               optionId:
 *                 type: string
 *               notes:
 *                 type: string
 *               patientId:
 *                 type: integer
 *                 description: Patient ID (Required if user role is not patient)
 *     responses:
 *       200:
 *         description: Late arrival option processed successfully
 *       400:
 *         description: Bad request (missing fields)
 *       500:
 *         description: Server error
 */
router.post('/process', authenticate, async (req, res) => {
    try {
        const { appointmentId, optionId, notes } = req.body;
        const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;

        if (!appointmentId || !optionId) {
            return res.status(400).json({ error: 'Appointment ID and option ID required' });
        }

        const result = await lateArrivalService.processLateArrival(
            appointmentId, 
            patientId, 
            optionId, 
            notes
        );
        res.json(result);
    } catch (err) {
        console.error('Process late arrival error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/late-arrival/policy/{doctorId}:
 *   get:
 *     summary: Get doctor's late arrival policy
 *     tags: [LateArrival]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor's late arrival policy retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/policy/:doctorId', authenticate, async (req, res) => {
    try {
        const policy = await lateArrivalService.getDoctorLatePolicy(req.params.doctorId);
        res.json(policy);
    } catch (err) {
        console.error('Get policy error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/late-arrival/policy:
 *   post:
 *     summary: Set doctor's late arrival policy (grace period, actions)
 *     tags: [LateArrival]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gracePeriodMinutes
 *             properties:
 *               gracePeriodMinutes:
 *                 type: integer
 *               policyDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Late arrival policy set successfully
 *       403:
 *         description: Forbidden (Only doctors can set their policy)
 *       500:
 *         description: Server error
 */
router.post('/policy', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Only doctors can set their late arrival policy' });
        }

        const policy = await lateArrivalService.setDoctorLatePolicy(req.user.id, req.body);
        res.json({ success: true, policy });
    } catch (err) {
        console.error('Set policy error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/late-arrival/reminder/{appointmentId}:
 *   post:
 *     summary: Send pre-arrival reminder for the appointment
 *     tags: [LateArrival]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pre-arrival reminder sent successfully
 *       500:
 *         description: Server error
 */
router.post('/reminder/:appointmentId', authenticate, async (req, res) => {
    try {
        const result = await lateArrivalService.sendPreArrivalReminder(req.params.appointmentId);
        res.json(result);
    } catch (err) {
        console.error('Send reminder error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/late-arrival/analytics:
 *   get:
 *     summary: Get late arrival analytics
 *     tags: [LateArrival]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Late arrival analytics retrieved successfully
 *       403:
 *         description: Forbidden (Doctors only)
 *       500:
 *         description: Server error
 */
router.get('/analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Doctors only' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await lateArrivalService.getLateArrivalAnalytics(req.user.id, start, end);
        res.json(analytics);
    } catch (err) {
        console.error('Get analytics error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
