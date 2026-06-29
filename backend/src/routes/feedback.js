/**
 * Issue #50: Feedback Analytics Routes
 * API endpoints for patient feedback collection and analytics
 */

const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');
const { authenticate } = require('../middleware/authenticate');
const logger = require('../config/logger');

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Patient feedback submission, categories, history, and analytical reporting
 */

/**
 * @swagger
 * /api/feedback/submit:
 *   post:
 *     summary: Submit feedback for an appointment
 *     tags: [Feedback]
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
 *               - ratings
 *             properties:
 *               appointmentId:
 *                 type: integer
 *               patientId:
 *                 type: integer
 *                 description: Explicit patient ID (Only used if user is not PATIENT)
 *               ratings:
 *                 type: object
 *                 description: "Multi-category ratings (e.g. { doctor: 5, punctuality: 4 })"
 *               comment:
 *                 type: string
 *               wouldRecommend:
 *                 type: boolean
 *               improvements:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 *       400:
 *         description: Bad request (missing appointment ID or ratings)
 *       500:
 *         description: Server error
 */
router.post('/submit', authenticate, async (req, res) => {
    try {
        const { appointmentId, ratings, comment, wouldRecommend, improvements } = req.body;
        const patientId = req.user.role === 'PATIENT' ? req.user.id : req.body.patientId;

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
        logger.error('Submit feedback error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/feedback/pending:
 *   get:
 *     summary: Get pending feedback requests for the logged-in patient
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending feedback requests retrieved successfully
 *       403:
 *         description: Forbidden (Only patients can view pending feedback)
 *       500:
 *         description: Server error
 */
router.get('/pending', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Patients only' });
        }

        const pending = await feedbackService.getPendingFeedbackRequests(req.user.id);
        res.json(pending);
    } catch (err) {
        logger.error('Get pending feedback error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/feedback/categories:
 *   get:
 *     summary: Get feedback categories
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: Feedback categories retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = feedbackService.getFeedbackCategories();
        res.json(categories);
    } catch (err) {
        logger.error('Get categories error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/feedback/history:
 *   get:
 *     summary: Get patient's feedback history
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback history retrieved successfully
 *       403:
 *         description: Forbidden (Only patients can view history)
 *       500:
 *         description: Server error
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Patients only' });
        }

        const history = await feedbackService.getPatientFeedbackHistory(req.user.id);
        res.json(history);
    } catch (err) {
        logger.error('Get history error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/feedback/doctor-analytics:
 *   get:
 *     summary: Get doctor feedback analytics
 *     tags: [Feedback]
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
 *         description: Doctor analytics retrieved successfully
 *       403:
 *         description: Forbidden (Doctors only)
 *       500:
 *         description: Server error
 */
router.get('/doctor-analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return res.status(403).json({ error: 'Doctors only' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await feedbackService.getDoctorFeedbackAnalytics(req.user.id, start, end);
        res.json(analytics);
    } catch (err) {
        logger.error('Get doctor analytics error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/feedback/system-analytics:
 *   get:
 *     summary: Get system-wide feedback analytics
 *     tags: [Feedback]
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
 *         description: System-wide analytics retrieved successfully
 *       403:
 *         description: Forbidden (Admin only)
 *       500:
 *         description: Server error
 */
router.get('/system-analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await feedbackService.getSystemFeedbackAnalytics(start, end);
        res.json(analytics);
    } catch (err) {
        logger.error('Get system analytics error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
