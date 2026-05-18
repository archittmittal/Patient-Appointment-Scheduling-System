/**
 * Issue #42: Walk-in Priority Routes
 * API endpoints for walk-in patient management
 */

const express = require('express');
const router = express.Router();
const walkinPriorityService = require('../services/walkinPriorityService');
const { authenticate, requireRole } = require('../middleware/authenticate');
const pool = require('../config/db');

/**
 * POST /api/walkin/register
 * Register a new walk-in patient
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
        console.error('Walk-in registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/walkin/queue/:doctorId
 * Get walk-in queue for a doctor
 */
router.get('/queue/:doctorId', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const queue = await walkinPriorityService.getWalkinQueue(doctorId);
        res.json(queue);
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({ error: 'Failed to get walk-in queue' });
    }
});

/**
 * GET /api/walkin/next/:doctorId
 * Get next walk-in patient to call
 */
router.get('/next/:doctorId', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const next = await walkinPriorityService.getNextWalkin(doctorId);
        res.json(next || { message: 'No walk-ins waiting' });
    } catch (error) {
        console.error('Get next error:', error);
        res.status(500).json({ error: 'Failed to get next walk-in' });
    }
});

/**
 * POST /api/walkin/:walkinId/call
 * Call a walk-in patient
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
        console.error('Call walk-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/walkin/:walkinId/complete
 * Complete a walk-in consultation
 */
router.post('/:walkinId/complete', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const { walkinId } = req.params;
        const result = await walkinPriorityService.completeWalkin(walkinId);
        res.json(result);
    } catch (error) {
        console.error('Complete walk-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/walkin/:walkinId/urgency
 * Update urgency level
 */
router.put('/:walkinId/urgency', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const { walkinId } = req.params;
        const { urgencyLevel, reason } = req.body;

        const result = await walkinPriorityService.updateUrgency(walkinId, urgencyLevel, reason);
        res.json(result);
    } catch (error) {
        console.error('Update urgency error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/walkin/stats
 * Get walk-in statistics
 */
router.get('/stats', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const doctorId = req.user.role === 'DOCTOR' ? req.user.id : (req.query.doctorId || null);
        const stats = await walkinPriorityService.getWalkinStats(doctorId);
        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * DELETE /api/walkin/:walkinId
 * Cancel/remove a walk-in from queue
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
        console.error('Cancel walk-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/walkin/:walkinId/wait-time
 * Get estimated wait time for a walk-in
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
        console.error('Get wait time error:', error);
        res.status(500).json({ error: 'Failed to estimate wait time' });
    }
});

module.exports = router;
