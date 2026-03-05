/**
 * Issue #44: Peak Hours Analytics Routes
 * API endpoints for appointment pattern analytics
 */

const express = require('express');
const router = express.Router();
const peakHoursService = require('../services/peakHoursService');
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

module.exports = router;
