/**
 * Issue #39: Virtual Waiting Room Routes
 * API endpoints for virtual check-in functionality
 */

const express = require('express');
const router = express.Router();
const virtualCheckinService = require('../services/virtualCheckinService');
const { authenticate } = require('../middleware/authenticate');

/**
 * POST /api/virtual-checkin/:appointmentId/checkin
 * Virtual check-in for an appointment
 */
router.post('/:appointmentId/checkin', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;
        const { etaMinutes, latitude, longitude, device } = req.body;

        const result = await virtualCheckinService.virtualCheckIn(
            appointmentId,
            patientId,
            { etaMinutes, latitude, longitude, device }
        );

        res.json(result);
    } catch (error) {
        console.error('Virtual check-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/virtual-checkin/:appointmentId/status
 * Update status (en_route, arrived, running_late)
 */
router.post('/:appointmentId/status', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;
        const { status, etaMinutes, message } = req.body;

        const result = await virtualCheckinService.updateStatus(
            appointmentId,
            patientId,
            status.toUpperCase(),
            { etaMinutes, message }
        );

        res.json(result);
    } catch (error) {
        console.error('Status update error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/virtual-checkin/:appointmentId/status
 * Get waiting room status for a patient
 */
router.get('/:appointmentId/status', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const status = await virtualCheckinService.getWaitingRoomStatus(appointmentId, patientId);

        if (!status) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json(status);
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Failed to get waiting room status' });
    }
});

/**
 * POST /api/virtual-checkin/:appointmentId/ping
 * Keep session alive (heartbeat)
 */
router.post('/:appointmentId/ping', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const result = await virtualCheckinService.pingSession(appointmentId, patientId);
        res.json(result);
    } catch (error) {
        console.error('Ping error:', error);
        res.status(500).json({ error: 'Failed to ping session' });
    }
});

/**
 * DELETE /api/virtual-checkin/:appointmentId/checkin
 * Cancel virtual check-in
 */
router.delete('/:appointmentId/checkin', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const result = await virtualCheckinService.cancelCheckin(appointmentId, patientId);
        res.json(result);
    } catch (error) {
        console.error('Cancel check-in error:', error);
        res.status(500).json({ error: 'Failed to cancel check-in' });
    }
});

/**
 * GET /api/virtual-checkin/doctor/:doctorId/queue
 * Get virtual queue for doctor (clinic view)
 */
router.get('/doctor/:doctorId/queue', authenticate, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const queue = await virtualCheckinService.getVirtualQueueForDoctor(doctorId);
        res.json(queue);
    } catch (error) {
        console.error('Get doctor queue error:', error);
        res.status(500).json({ error: 'Failed to get virtual queue' });
    }
});

/**
 * GET /api/virtual-checkin/notifications
 * Get pending check-in notifications for clinic staff
 */
router.get('/notifications', authenticate, async (req, res) => {
    try {
        const doctorId = req.query.doctorId || null;
        const notifications = await virtualCheckinService.getPendingNotifications(doctorId);
        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});

/**
 * POST /api/virtual-checkin/notifications/:notificationId/acknowledge
 * Acknowledge a notification
 */
router.post('/notifications/:notificationId/acknowledge', authenticate, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        const result = await virtualCheckinService.acknowledgeNotification(notificationId, userId);
        res.json(result);
    } catch (error) {
        console.error('Acknowledge error:', error);
        res.status(500).json({ error: 'Failed to acknowledge notification' });
    }
});

module.exports = router;
