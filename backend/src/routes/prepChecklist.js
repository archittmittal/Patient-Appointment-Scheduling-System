/**
 * Issue #46: Patient Prep Checklist Routes
 * API endpoints for prep instructions and completion tracking
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const prepService = require('../services/prepChecklistService');

/**
 * @swagger
 * tags:
 *   name: PrepChecklist
 *   description: Patient appointment preparation instructions, checklist items, and completion tracking
 */

/**
 * @swagger
 * /api/prep/appointment/{appointmentId}:
 *   get:
 *     summary: Get prep checklist for an appointment
 *     tags: [PrepChecklist]
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
 *         description: Prep checklist retrieved successfully
 *       400:
 *         description: Bad request
 */
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

/**
 * @swagger
 * /api/prep/overview:
 *   get:
 *     summary: Get patient's upcoming appointments with prep status
 *     tags: [PrepChecklist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming appointments with prep status retrieved successfully
 *       403:
 *         description: Access denied (if user is not a PATIENT)
 *       500:
 *         description: Failed to get prep overview
 */
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

/**
 * @swagger
 * /api/prep/complete/{appointmentId}/{itemId}:
 *   post:
 *     summary: Mark a prep item as complete
 *     tags: [PrepChecklist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prep item marked complete successfully
 *       400:
 *         description: Bad request
 */
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

/**
 * @swagger
 * /api/prep/complete/{appointmentId}/{itemId}:
 *   delete:
 *     summary: Mark a prep item as incomplete
 *     tags: [PrepChecklist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prep item marked incomplete successfully
 *       400:
 *         description: Bad request
 */
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

/**
 * @swagger
 * /api/prep/custom/{appointmentId}:
 *   post:
 *     summary: Add a custom prep item for an appointment
 *     tags: [PrepChecklist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Custom prep item added successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden (Only doctors can add custom prep items)
 */
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

/**
 * @swagger
 * /api/prep/defaults:
 *   get:
 *     summary: Get default prep items (templates)
 *     tags: [PrepChecklist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default prep templates retrieved successfully
 *       500:
 *         description: Failed to get default prep items
 */
router.get('/defaults', authenticate, async (req, res) => {
    try {
        const defaults = prepService.getDefaultPrepItems();
        res.json(defaults);
    } catch (err) {
        console.error('Get defaults error:', err);
        res.status(500).json({ error: 'Failed to get default prep items' });
    }
});

/**
 * @swagger
 * /api/prep/template/{specialty}:
 *   get:
 *     summary: Get specialty prep template
 *     tags: [PrepChecklist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specialty
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Specialty template retrieved successfully
 *       500:
 *         description: Failed to get template
 */
router.get('/template/:specialty', authenticate, async (req, res) => {
    try {
        const template = prepService.getSpecialtyPrepTemplate(req.params.specialty);
        res.json(template);
    } catch (err) {
        console.error('Get template error:', err);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

/**
 * @swagger
 * /api/prep/reminder/{appointmentId}:
 *   post:
 *     summary: Send prep reminder notification to the patient
 *     tags: [PrepChecklist]
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
 *         description: Prep reminder sent successfully
 *       400:
 *         description: Bad request
 */
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
