/**
 * Issue #43: Multi-Doctor Routing Routes
 * API endpoints for multi-doctor journeys
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const multiDoctorService = require('../services/multiDoctorService');

// Create a new multi-doctor journey
router.post('/journey', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Only patients can create journeys' });
        }

        const journey = await multiDoctorService.createJourney(
            req.user.id,
            req.body.appointments
        );
        res.status(201).json(journey);
    } catch (err) {
        console.error('Create journey error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Get patient's active journeys
router.get('/journeys', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const journeys = await multiDoctorService.getPatientJourneys(req.user.id);
        res.json(journeys);
    } catch (err) {
        console.error('Get journeys error:', err);
        res.status(500).json({ error: 'Failed to get journeys' });
    }
});

// Get journey details
router.get('/journey/:journeyId', authenticate, async (req, res) => {
    try {
        const journey = await multiDoctorService.getJourneyDetails(
            req.params.journeyId,
            req.user.id
        );
        res.json(journey);
    } catch (err) {
        console.error('Get journey details error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Update stop status (doctor/admin)
router.patch('/stop/:stopId/status', authenticate, async (req, res) => {
    try {
        if (!['DOCTOR', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await multiDoctorService.updateStopStatus(
            req.params.stopId,
            req.body.status,
            req.body.notes
        );
        res.json(result);
    } catch (err) {
        console.error('Update stop status error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Get route optimization suggestion
router.post('/optimize', authenticate, async (req, res) => {
    try {
        const optimization = await multiDoctorService.getRouteOptimization(
            req.body.doctorIds
        );
        res.json(optimization);
    } catch (err) {
        console.error('Optimize route error:', err);
        res.status(500).json({ error: 'Failed to optimize route' });
    }
});

// Get suggested doctor combinations for symptoms
router.get('/suggestions', authenticate, async (req, res) => {
    try {
        const { symptom } = req.query;
        if (!symptom) {
            return res.status(400).json({ error: 'Symptom is required' });
        }

        const suggestions = await multiDoctorService.getSuggestedCombinations(symptom);
        res.json(suggestions);
    } catch (err) {
        console.error('Get suggestions error:', err);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

// Get journey analytics (admin only)
router.get('/analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await multiDoctorService.getJourneyAnalytics(start, end);
        res.json(analytics);
    } catch (err) {
        console.error('Get analytics error:', err);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

module.exports = router;
