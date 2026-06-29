/**
 * Issue #42: Walk-in Priority Routes
 * API endpoints for walk-in patient management
 */

const express = require('express');
const router = express.Router();
const walkinPriorityService = require('../services/walkinPriorityService');
const { authenticate, requireRole } = require('../middleware/authenticate');
const pool = require('../config/db');
const logger = require('../config/logger');

/**
 * @swagger
 * tags:
 *   name: WalkIn
 *   description: Walk-in patient queue registration and prioritization operations
 */

/**
 * @swagger
 * /api/walkin/register:
 *   post:
 *     summary: Register a new walk-in patient
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *               - urgencyLevel
 *               - reason
 *             properties:
 *               doctorId:
 *                 type: integer
 *               specialtyId:
 *                 type: integer
 *               urgencyLevel:
 *                 type: integer
 *                 description: Urgency score/tier for prioritization
 *               reason:
 *                 type: string
 *               symptoms:
 *                 type: string
 *               vitalSigns:
 *                 type: object
 *               overridePatientId:
 *                 type: integer
 *                 description: Admin or doctor can specify patient ID to register
 *     responses:
 *       200:
 *         description: Walk-in patient registered successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/register', authenticate, async (req, res) => {
    try {
        let patientId = req.user.id;
        const { doctorId, specialtyId, urgencyLevel, reason, symptoms, vitalSigns, overridePatientId } = req.body;

        // Allow ADMIN or DOCTOR to register for a specific patient
        if ((req.user.role === 'ADMIN' || req.user.role === 'DOCTOR') && overridePatientId) {
            patientId = overridePatientId;
        }

        const result = await walkinPriorityService.registerWalkin(patientId, {
            doctorId,
            specialtyId,
            urgencyLevel,
            reason,
            symptoms,
            vitalSigns
        });

        res.json(result);
    } catch (error) {
        logger.error('Walk-in registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/walkin/queue/{doctorId}:
 *   get:
 *     summary: Get walk-in queue for a specific doctor
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Walk-in queue retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/queue/:doctorId', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const queue = await walkinPriorityService.getWalkinQueue(doctorId);
        res.json(queue);
    } catch (error) {
        logger.error('Get queue error:', error);
        res.status(500).json({ error: 'Failed to get walk-in queue' });
    }
});

/**
 * @swagger
 * /api/walkin/next/{doctorId}:
 *   get:
 *     summary: Get the next walk-in patient in line for a specific doctor
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Next walk-in patient details retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/next/:doctorId', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const next = await walkinPriorityService.getNextWalkin(doctorId);
        res.json(next || { message: 'No walk-ins waiting' });
    } catch (error) {
        logger.error('Get next error:', error);
        res.status(500).json({ error: 'Failed to get next walk-in' });
    }
});

/**
 * @swagger
 * /api/walkin/{walkinId}/call:
 *   post:
 *     summary: Call a walk-in patient from the waiting queue
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walkinId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               doctorId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Walk-in patient called successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires DOCTOR or ADMIN role)
 */
router.post('/:walkinId/call', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const { walkinId } = req.params;
        const doctorId = req.user.role === 'DOCTOR' ? req.user.id : (req.body.doctorId || null);

        if (!doctorId && req.user.role === 'DOCTOR') {
            return res.status(400).json({ error: 'Doctor ID is required' });
        }

        const result = await walkinPriorityService.callWalkin(walkinId, doctorId);
        res.json(result);
    } catch (error) {
        logger.error('Call walk-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/walkin/{walkinId}/complete:
 *   post:
 *     summary: Complete a walk-in patient consultation
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walkinId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Consultation marked complete successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires DOCTOR or ADMIN role)
 */
router.post('/:walkinId/complete', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const { walkinId } = req.params;
        const result = await walkinPriorityService.completeWalkin(walkinId);
        res.json(result);
    } catch (error) {
        logger.error('Complete walk-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/walkin/{walkinId}/urgency:
 *   put:
 *     summary: Update urgency level of a registered walk-in
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walkinId
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
 *               - urgencyLevel
 *             properties:
 *               urgencyLevel:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Urgency level updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires DOCTOR or ADMIN role)
 */
router.put('/:walkinId/urgency', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const { walkinId } = req.params;
        const { urgencyLevel, reason } = req.body;

        const result = await walkinPriorityService.updateUrgency(walkinId, urgencyLevel, reason);
        res.json(result);
    } catch (error) {
        logger.error('Update urgency error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/walkin/stats:
 *   get:
 *     summary: Get walk-in scheduling statistics
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Walk-in statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires DOCTOR or ADMIN role)
 */
router.get('/stats', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const doctorId = req.user.role === 'DOCTOR' ? req.user.id : (req.query.doctorId || null);
        const stats = await walkinPriorityService.getWalkinStats(doctorId);
        res.json(stats);
    } catch (error) {
        logger.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * @swagger
 * /api/walkin/{walkinId}:
 *   delete:
 *     summary: Cancel walk-in queue registration
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walkinId
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
 *         description: Walk-in registration cancelled successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not authorized to cancel this registration)
 */
router.delete('/:walkinId', authenticate, async (req, res) => {
    try {
        const { walkinId } = req.params;
        const { reason } = req.body;

        // If patient, verify ownership
        if (req.user.role === 'PATIENT') {
            const [walkin] = await pool.query('SELECT patient_id FROM walkin_queue WHERE id = ?', [walkinId]);
            if (!walkin || walkin.length === 0 || walkin[0].patient_id !== req.user.id) {
                return res.status(403).json({ error: 'You can only cancel your own walk-in registration' });
            }
        }

        const result = await walkinPriorityService.cancelWalkin(walkinId, reason);
        res.json(result);
    } catch (error) {
        logger.error('Cancel walk-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/walkin/{walkinId}/wait-time:
 *   get:
 *     summary: Get estimated wait time for a walk-in patient
 *     tags: [WalkIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walkinId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estimated wait time retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/:walkinId/wait-time', authenticate, async (req, res) => {
    try {
        const { walkinId } = req.params;

        // If patient, verify ownership
        if (req.user.role === 'PATIENT') {
            const [walkin] = await pool.query('SELECT patient_id FROM walkin_queue WHERE id = ?', [walkinId]);
            if (!walkin || walkin.length === 0 || walkin[0].patient_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const waitTime = await walkinPriorityService.estimateWaitTime(walkinId);
        res.json({ estimatedMinutes: waitTime });
    } catch (error) {
        logger.error('Get wait time error:', error);
        res.status(500).json({ error: 'Failed to estimate wait time' });
    }
});

module.exports = router;
