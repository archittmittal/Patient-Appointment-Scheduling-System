/**
 * Issue #45: Express Check-in Routes
 * API endpoints for fast-track check-in
 */

const express = require('express');
const router = express.Router();
const expressCheckinService = require('../services/expressCheckinService');
const { authenticate } = require('../middleware/authenticate');

/**
 * @swagger
 * tags:
 *   name: ExpressCheckin
 *   description: Fast-track, QR code, and one-tap patient check-in management
 */

/**
 * @swagger
 * /api/express-checkin/eligibility/{appointmentId}:
 *   get:
 *     summary: Check if patient is eligible for express check-in
 *     tags: [ExpressCheckin]
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
 *         description: Express check-in eligibility details retrieved successfully
 *       500:
 *         description: Failed to check eligibility
 */
router.get('/eligibility/:appointmentId', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const eligibility = await expressCheckinService.checkExpressEligibility(patientId, appointmentId);
        res.json(eligibility);
    } catch (error) {
        console.error('Eligibility check error:', error);
        res.status(500).json({ error: 'Failed to check eligibility' });
    }
});

/**
 * @swagger
 * /api/express-checkin/generate-token/{appointmentId}:
 *   post:
 *     summary: Generate QR code token for check-in
 *     tags: [ExpressCheckin]
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
 *         description: QR check-in token generated successfully
 *       400:
 *         description: Bad request
 */
router.post('/generate-token/:appointmentId', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const tokenData = await expressCheckinService.generateCheckinToken(appointmentId, patientId);
        res.json(tokenData);
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/express-checkin/scan:
 *   post:
 *     summary: Process QR code scan for check-in
 *     tags: [ExpressCheckin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Express check-in completed successfully via QR scan
 *       400:
 *         description: Bad request (missing or invalid token)
 */
router.post('/scan', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const result = await expressCheckinService.processExpressCheckin(token);
        res.json(result);
    } catch (error) {
        console.error('QR scan error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/express-checkin/one-tap/{appointmentId}:
 *   post:
 *     summary: One-tap check-in for eligible patients
 *     tags: [ExpressCheckin]
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
 *         description: Checked in successfully with one-tap
 *       400:
 *         description: Bad request
 */
router.post('/one-tap/:appointmentId', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const result = await expressCheckinService.oneTapCheckin(appointmentId, patientId);
        res.json(result);
    } catch (error) {
        console.error('One-tap check-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/express-checkin/prefilled-info:
 *   get:
 *     summary: Get pre-filled patient information for check-in
 *     tags: [ExpressCheckin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pre-filled patient information retrieved successfully
 *       500:
 *         description: Failed to get prefilled info
 */
router.get('/prefilled-info', authenticate, async (req, res) => {
    try {
        const patientId = req.user.id;

        const info = await expressCheckinService.getPrefilledInfo(patientId);
        res.json(info);
    } catch (error) {
        console.error('Prefilled info error:', error);
        res.status(500).json({ error: 'Failed to get prefilled info' });
    }
});

/**
 * @swagger
 * /api/express-checkin/today:
 *   get:
 *     summary: Get today's appointments eligible for express check-in
 *     tags: [ExpressCheckin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's eligible appointments retrieved successfully
 *       500:
 *         description: Failed to get today's appointments
 */
router.get('/today', authenticate, async (req, res) => {
    try {
        const patientId = req.user.id;

        const appointments = await expressCheckinService.getTodayExpressEligible(patientId);
        res.json(appointments);
    } catch (error) {
        console.error('Get today appointments error:', error);
        res.status(500).json({ error: 'Failed to get today appointments' });
    }
});

module.exports = router;
