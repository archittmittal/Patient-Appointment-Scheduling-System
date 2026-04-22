/**
 * Issue #44: Peak Hours Analytics Routes
 * API endpoints for appointment pattern analytics
 */

const express = require('express');
const router = express.Router();
const peakHoursService = require('../services/peakHoursService');
const predictionService = require('../services/predictionService');
const {
    getDoctorWorkloads,
    suggestDoctorForWalkin,
    getOptimalSequence
} = require('../services/dailyOptimizerService');
const { authenticate } = require('../middleware/authenticate');

/**
 * GET /api/analytics/doctor/:doctorId/peak-hours
 * Get peak hours analysis for a specific doctor
 */
router.get('/doctor/:doctorId/peak-hours', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const daysBack = parseInt(req.query.days) || 90;

        const analysis = await peakHoursService.getPeakHoursAnalysis(doctorId, daysBack);
        res.json(analysis);
    } catch (error) {
        console.error('Peak hours analysis error:', error);
        res.status(500).json({ error: 'Failed to get peak hours analysis' });
    }
});

/**
 * GET /api/analytics/doctor/:doctorId/heatmap
 * Get weekly heatmap data for a doctor
 */
router.get('/doctor/:doctorId/heatmap', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const daysBack = parseInt(req.query.days) || 90;

        const heatmap = await peakHoursService.getWeeklyHeatmap(doctorId, daysBack);
        res.json(heatmap);
    } catch (error) {
        console.error('Heatmap error:', error);
        res.status(500).json({ error: 'Failed to get heatmap data' });
    }
});

/**
 * GET /api/analytics/doctor/:doctorId/best-times
 * Get best booking times for a doctor
 */
router.get('/doctor/:doctorId/best-times', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const daysBack = parseInt(req.query.days) || 90;

        const bestTimes = await peakHoursService.getBestBookingTimes(doctorId, daysBack);
        res.json(bestTimes);
    } catch (error) {
        console.error('Best times error:', error);
        res.status(500).json({ error: 'Failed to get best booking times' });
    }
});

/**
 * GET /api/analytics/doctor/:doctorId/crowd-level
 * Get current crowd level for a doctor
 */
router.get('/doctor/:doctorId/crowd-level', async (req, res) => {
    try {
        const { doctorId } = req.params;

        const crowdLevel = await peakHoursService.getCurrentCrowdLevel(doctorId);
        res.json(crowdLevel);
    } catch (error) {
        console.error('Crowd level error:', error);
        res.status(500).json({ error: 'Failed to get crowd level' });
    }
});

/**
 * GET /api/analytics/doctor/:doctorId/hourly-stats
 * Get detailed hourly statistics for a doctor
 */
router.get('/doctor/:doctorId/hourly-stats', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const daysBack = parseInt(req.query.days) || 90;

        const stats = await peakHoursService.getDoctorHourlyStats(doctorId, daysBack);
        res.json(stats);
    } catch (error) {
        console.error('Hourly stats error:', error);
        res.status(500).json({ error: 'Failed to get hourly statistics' });
    }
});

/**
 * GET /api/analytics/clinic
 * Get clinic-wide analytics (admin only)
 */
router.get('/clinic', authenticate, async (req, res) => {
    try {
        const daysBack = parseInt(req.query.days) || 30;

        const analytics = await peakHoursService.getClinicWideAnalytics(daysBack);
        res.json(analytics);
    } catch (error) {
        console.error('Clinic analytics error:', error);
        res.status(500).json({ error: 'Failed to get clinic analytics' });
    }
});

/**
 * GET /api/analytics/doctor/:doctorId/predictive
 * Get predictive analytics for a specific doctor
 */
router.get('/doctor/:doctorId/predictive', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const analysis = await predictionService.getDoctorPredictiveAnalytics(doctorId);
        res.json(analysis);
    } catch (error) {
        console.error('Predictive analytics error:', error);
        res.status(500).json({ error: 'Failed to get predictive analytics' });
    }
});

/**
 * GET /api/analytics/appointment/:appointmentId/no-show-risk
 * Get no-show risk for a specific appointment
 */
router.get('/appointment/:appointmentId/no-show-risk', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const prediction = await predictionService.predictNoShowProbability(appointmentId);
        res.json(prediction);
    } catch (error) {
        console.error('No-show prediction error:', error);
        res.status(500).json({ error: 'Failed to predict no-show risk' });
    }
});

/**
 * GET /api/analytics/patient/:patientId/churn-risk
 * Get churn risk for a specific patient
 */
router.get('/patient/:patientId/churn-risk', authenticate, async (req, res) => {
    try {
        const { patientId } = req.params;
        const prediction = await predictionService.predictChurnRisk(patientId);
        res.json(prediction);
    } catch (error) {
        console.error('Churn prediction error:', error);
        res.status(500).json({ error: 'Failed to predict churn risk' });
    }
});

/**
 * GET /api/analytics/optimizer/workloads
 * Get real-time workload/congestion for all active doctors
 */
router.get('/optimizer/workloads', authenticate, async (req, res) => {
    try {
        const workloads = await getDoctorWorkloads();
        res.json(workloads);
    } catch (error) {
        console.error('Error in workload analytics:', error);
        res.status(500).json({ error: 'Failed to fetch doctor workloads' });
    }
});

/**
 * POST /api/analytics/optimizer/suggest-doctor
 * Suggest the best doctor for a new walk-in based on congestion
 */
router.post('/optimizer/suggest-doctor', authenticate, async (req, res) => {
    try {
        const { symptoms } = req.body;
        const patientId = req.user.id;
        
        const suggestion = await suggestDoctorForWalkin(patientId, symptoms);
        res.json(suggestion);
    } catch (error) {
        console.error('Error in doctor suggestion:', error);
        res.status(500).json({ error: 'Failed to suggest doctor' });
    }
});

/**
 * GET /api/analytics/optimizer/optimal-sequence/:doctorId
 * Get theoretically optimal sequence of waiting patients using DP
 */
router.get('/optimizer/optimal-sequence/:doctorId', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const result = await getOptimalSequence(doctorId);
        res.json(result);
    } catch (error) {
        console.error('Error in schedule optimization:', error);
        res.status(500).json({ error: 'Failed to generate optimal sequence' });
    }
});

module.exports = router;
