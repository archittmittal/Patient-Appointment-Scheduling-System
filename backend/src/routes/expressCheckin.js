/**
 * Issue #45: Express Check-in Routes
 * API endpoints for fast-track check-in
 */

const express = require('express');
const router = express.Router();
const expressCheckinService = require('../services/expressCheckinService');
const auth = require('../middleware/authenticate');

/**
 * GET /api/express-checkin/eligibility/:appointmentId
 * Check if patient is eligible for express check-in
 */
router.get('/eligibility/:appointmentId', auth, async (req, res) => {
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
 * POST /api/express-checkin/generate-token/:appointmentId
 * Generate QR code token for check-in
 */
router.post('/generate-token/:appointmentId', auth, async (req, res) => {
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
 * POST /api/express-checkin/scan
 * Process QR code scan for check-in
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
 * POST /api/express-checkin/one-tap/:appointmentId
 * One-tap check-in for eligible patients
 */
router.post('/one-tap/:appointmentId', auth, async (req, res) => {
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
 * GET /api/express-checkin/prefilled-info
 * Get pre-filled patient information for check-in
 */
router.get('/prefilled-info', auth, async (req, res) => {
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
 * GET /api/express-checkin/today
 * Get today's appointments eligible for express check-in
 */
router.get('/today', auth, async (req, res) => {
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
