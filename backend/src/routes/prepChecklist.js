/**
 * Issue #46: Patient Prep Checklist Routes
 * API endpoints for prep instructions and completion tracking
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const prepService = require('../services/prepChecklistService');

// Get prep checklist for an appointment
router.get('/appointment/:appointmentId', authenticate, async (req, res) => {
    try {
        const prep = await prepService.getAppointmentPrep(
            req.params.appointmentId,
            req.user.id
        );
        res.json(prep);
    } catch (err) {
        console.error('Get prep error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Get patient's upcoming appointments with prep status
router.get('/overview', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const overview = await prepService.getPatientPrepOverview(req.user.id);
        res.json(overview);
    } catch (err) {
        console.error('Get prep overview error:', err);
        res.status(500).json({ error: 'Failed to get prep overview' });
    }
});

// Mark prep item as complete
router.post('/complete/:appointmentId/:itemId', authenticate, async (req, res) => {
    try {
        const result = await prepService.markPrepComplete(
            req.params.appointmentId,
            req.user.id,
            req.params.itemId
        );
        res.json(result);
    } catch (err) {
        console.error('Mark prep complete error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Mark prep item as incomplete
router.delete('/complete/:appointmentId/:itemId', authenticate, async (req, res) => {
    try {
        const result = await prepService.markPrepIncomplete(
            req.params.appointmentId,
            req.user.id,
            req.params.itemId
        );
        res.json(result);
    } catch (err) {
        console.error('Mark prep incomplete error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Add custom prep item (doctor only)
router.post('/custom/:appointmentId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return res.status(403).json({ error: 'Only doctors can add custom prep items' });
        }

        const item = await prepService.addCustomPrepItem(
            req.user.id,
            req.params.appointmentId,
            req.body
        );
        res.status(201).json(item);
    } catch (err) {
        console.error('Add custom prep error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Get default prep items (templates)
router.get('/defaults', authenticate, async (req, res) => {
    try {
        const defaults = prepService.getDefaultPrepItems();
        res.json(defaults);
    } catch (err) {
        console.error('Get defaults error:', err);
        res.status(500).json({ error: 'Failed to get default prep items' });
    }
});

// Get specialty template
router.get('/template/:specialty', authenticate, async (req, res) => {
    try {
        const template = prepService.getSpecialtyPrepTemplate(req.params.specialty);
        res.json(template);
    } catch (err) {
        console.error('Get template error:', err);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

// Send prep reminder
router.post('/reminder/:appointmentId', authenticate, async (req, res) => {
    try {
        const result = await prepService.sendPrepReminder(
            req.params.appointmentId,
            req.user.id
        );
        res.json(result);
    } catch (err) {
        console.error('Send reminder error:', err);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
