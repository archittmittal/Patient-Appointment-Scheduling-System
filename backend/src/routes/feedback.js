/**
 * Issue #50: Feedback Analytics Routes
 * API endpoints for patient feedback collection and analytics
 */

const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');
const authenticate = require('../middleware/authenticate');

/**
 * Submit feedback for an appointment
 * POST /api/feedback/submit
 */
router.post('/submit', authenticate, async (req, res) => {
    try {
        const { appointmentId, ratings, comment, wouldRecommend, improvements } = req.body;
        const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;

        if (!appointmentId || !ratings) {
            return res.status(400).json({ error: 'Appointment ID and ratings required' });
        }

        const result = await feedbackService.submitFeedback(
            appointmentId,
            patientId,
            { ratings, comment, wouldRecommend, improvements }
        );
        res.json(result);
    } catch (err) {
        console.error('Submit feedback error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get pending feedback requests for the logged-in patient
 * GET /api/feedback/pending
 */
router.get('/pending', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ error: 'Patients only' });
        }

        const pending = await feedbackService.getPendingFeedbackRequests(req.user.id);
        res.json(pending);
    } catch (err) {
        console.error('Get pending feedback error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get feedback categories
 * GET /api/feedback/categories
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = feedbackService.getFeedbackCategories();
        res.json(categories);
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get patient's feedback history
 * GET /api/feedback/history
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ error: 'Patients only' });
        }

        const history = await feedbackService.getPatientFeedbackHistory(req.user.id);
        res.json(history);
    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get doctor feedback analytics (doctors only)
 * GET /api/feedback/doctor-analytics
 */
router.get('/doctor-analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Doctors only' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await feedbackService.getDoctorFeedbackAnalytics(req.user.id, start, end);
        res.json(analytics);
    } catch (err) {
        console.error('Get doctor analytics error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get system-wide feedback analytics (admin only)
 * GET /api/feedback/system-analytics
 */
router.get('/system-analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await feedbackService.getSystemFeedbackAnalytics(start, end);
        res.json(analytics);
    } catch (err) {
        console.error('Get system analytics error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
