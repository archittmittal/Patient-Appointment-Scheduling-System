/**
 * Issue #49: Appointment Batching Routes
 * API endpoints for batch scheduling functionality
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const batchingService = require('../services/batchingService');

/**
 * @swagger
 * tags:
 *   name: Batching
 *   description: Appointment batching and grouped booking operations
 */

/**
 * @swagger
 * /api/batching/types:
 *   get:
 *     summary: Get available batch appointment types
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of batchable types retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/types', authenticate, async (req, res) => {
    try {
        const types = await batchingService.getBatchableTypes();
        res.json(types);
    } catch (err) {
        console.error('Get batch types error:', err);
        res.status(500).json({ error: 'Failed to get batch types' });
    }
});

/**
 * @swagger
 * /api/batching/slots/{doctorId}/{date}:
 *   get:
 *     summary: Get available batch slots for a specific doctor and date
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of batch slots retrieved successfully
 *       401:
 *         description: Unauthorized
 */
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

/**
 * @swagger
 * /api/batching/slots:
 *   post:
 *     summary: Create a new batch slot
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - batch_type_id
 *               - date
 *               - start_time
 *               - end_time
 *               - max_patients
 *             properties:
 *               batch_type_id:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               max_patients:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Batch slot created successfully
 *       403:
 *         description: Forbidden (Requires DOCTOR role)
 *       400:
 *         description: Bad request
 */
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

/**
 * @swagger
 * /api/batching/book/{slotId}:
 *   post:
 *     summary: Book a batch appointment in a slot
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Batch appointment booked successfully
 *       403:
 *         description: Forbidden (Requires PATIENT role)
 *       400:
 *         description: Bad request
 */
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

/**
 * @swagger
 * /api/batching/my-appointments:
 *   get:
 *     summary: Retrieve patient's own batch appointments
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of patient's batch appointments retrieved successfully
 *       403:
 *         description: Forbidden (Requires PATIENT role)
 */
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

/**
 * @swagger
 * /api/batching/doctor-schedule:
 *   get:
 *     summary: Retrieve doctor's own batch schedule
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Doctor's batch schedule retrieved successfully
 *       403:
 *         description: Forbidden (Requires DOCTOR role)
 */
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

/**
 * @swagger
 * /api/batching/slots/{slotId}/details:
 *   get:
 *     summary: Retrieve details of a specific batch slot
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Batch slot details retrieved successfully
 *       400:
 *         description: Bad request
 */
router.get('/slots/:slotId/details', authenticate, async (req, res) => {
    try {
        const details = await batchingService.getBatchSlotDetails(req.params.slotId);
        res.json(details);
    } catch (err) {
        console.error('Get batch slot details error:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/batching/suggest:
 *   get:
 *     summary: Suggest available batch slots for a patient based on preferences
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: appointmentType
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: preferredDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of suggested batch slots retrieved successfully
 *       400:
 *         description: Bad request (missing appointmentType)
 */
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

/**
 * @swagger
 * /api/batching/slots/{slotId}:
 *   delete:
 *     summary: Cancel a batch slot
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch slot cancelled successfully
 *       403:
 *         description: Forbidden (Requires DOCTOR role)
 *       400:
 *         description: Bad request
 */
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

/**
 * @swagger
 * /api/batching/analytics:
 *   get:
 *     summary: Get batch scheduling analytics
 *     tags: [Batching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Batch analytics retrieved successfully
 *       403:
 *         description: Forbidden (Requires DOCTOR role)
 */
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
