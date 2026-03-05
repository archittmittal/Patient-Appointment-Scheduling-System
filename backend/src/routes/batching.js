/**
 * Issue #49: Appointment Batching Routes
 * API endpoints for batch scheduling functionality
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const batchingService = require('../services/batchingService');

// Get available batch types
router.get('/types', authenticate, async (req, res) => {
    try {
        const types = await batchingService.getBatchableTypes();
        res.json(types);
    } catch (err) {
        console.error('Get batch types error:', err);
        res.status(500).json({ error: 'Failed to get batch types' });
    }
});

// Get available batch slots for a doctor
router.get('/slots/:doctorId/:date', authenticate, async (req, res) => {
    try {
        const slots = await batchingService.getBatchSlots(
            req.params.doctorId,
            req.params.date
        );
        res.json(slots);
    } catch (err) {
        console.error('Get batch slots error:', err);
        res.status(500).json({ error: 'Failed to get batch slots' });
    }
});

// Create a new batch slot (doctor only)
router.post('/slots', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return res.status(403).json({ error: 'Only doctors can create batch slots' });
        }

        const slot = await batchingService.createBatchSlot(req.user.id, req.body);
        res.status(201).json(slot);
    } catch (err) {
        console.error('Create batch slot error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Book a batch appointment (patient)
router.post('/book/:slotId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Only patients can book batch appointments' });
        }

        const result = await batchingService.bookBatchAppointment(
            req.user.id,
            req.params.slotId,
            req.body.reason
        );
        res.status(201).json(result);
    } catch (err) {
        console.error('Book batch appointment error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Get patient's batch appointments
router.get('/my-appointments', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const appointments = await batchingService.getPatientBatchAppointments(req.user.id);
        res.json(appointments);
    } catch (err) {
        console.error('Get patient batch appointments error:', err);
        res.status(500).json({ error: 'Failed to get batch appointments' });
    }
});

// Get doctor's batch schedule
router.get('/doctor-schedule', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const schedule = await batchingService.getDoctorBatchSchedule(req.user.id, start, end);
        res.json(schedule);
    } catch (err) {
        console.error('Get doctor batch schedule error:', err);
        res.status(500).json({ error: 'Failed to get batch schedule' });
    }
});

// Get batch slot details
router.get('/slots/:slotId/details', authenticate, async (req, res) => {
    try {
        const details = await batchingService.getBatchSlotDetails(req.params.slotId);
        res.json(details);
    } catch (err) {
        console.error('Get batch slot details error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Suggest batch slots for a patient
router.get('/suggest', authenticate, async (req, res) => {
    try {
        const { appointmentType, preferredDate } = req.query;
        
        if (!appointmentType) {
            return res.status(400).json({ error: 'Appointment type is required' });
        }

        const suggestions = await batchingService.suggestBatchSlots(
            req.user.id,
            appointmentType,
            preferredDate
        );
        res.json(suggestions);
    } catch (err) {
        console.error('Suggest batch slots error:', err);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

// Cancel batch slot (doctor only)
router.delete('/slots/:slotId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return res.status(403).json({ error: 'Only doctors can cancel batch slots' });
        }

        const result = await batchingService.cancelBatchSlot(
            req.params.slotId,
            req.user.id,
            req.body.reason
        );
        res.json(result);
    } catch (err) {
        console.error('Cancel batch slot error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Get batch analytics (doctor)
router.get('/analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await batchingService.getBatchAnalytics(req.user.id, start, end);
        res.json(analytics);
    } catch (err) {
        console.error('Get batch analytics error:', err);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

module.exports = router;
