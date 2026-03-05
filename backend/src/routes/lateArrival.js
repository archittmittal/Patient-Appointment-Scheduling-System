/**
 * Issue #47: Late Arrival Routes
 * API endpoints for late arrival handling
 */

const express = require('express');
const router = express.Router();
const lateArrivalService = require('../services/lateArrivalService');
const authenticate = require('../middleware/authenticate');

/**
 * Check late status for an appointment
 * GET /api/late-arrival/check/:appointmentId
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
 * Process late arrival option selection
 * POST /api/late-arrival/process
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
 * Get doctor's late arrival policy
 * GET /api/late-arrival/policy/:doctorId
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
 * Set doctor's late arrival policy (doctors only)
 * POST /api/late-arrival/policy
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
 * Send pre-arrival reminder
 * POST /api/late-arrival/reminder/:appointmentId
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
 * Get late arrival analytics (doctors only)
 * GET /api/late-arrival/analytics
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
