/**
 * Issue #39: Virtual Waiting Room Routes
 * API endpoints for virtual check-in functionality
 */

const express = require('express');
const router = express.Router();
const virtualCheckinService = require('../services/virtualCheckinService');
const sseManager = require('../services/sseManager');
const { authenticate, requireRole } = require('../middleware/authenticate');

/**
 * @swagger
 * tags:
 *   name: VirtualCheckin
 *   description: Virtual waiting room and patient check-in management
 */

/**
 * @swagger
 * /api/virtual-checkin/{appointmentId}/checkin:
 *   post:
 *     summary: Check-in virtually for a scheduled appointment
 *     tags: [VirtualCheckin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               etaMinutes:
 *                 type: integer
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               device:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checked in virtually successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
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

        // Broadcast real-time updates to patient waiting room and doctor dashboard
        const activeStatus = await virtualCheckinService.getWaitingRoomStatus(appointmentId, patientId);
        if (activeStatus) {
            sseManager.broadcastQueueUpdate(appointmentId, activeStatus);
            const doctorId = activeStatus.appointment.doctorId || activeStatus.appointment.doctor_id;
            if (doctorId) {
                sseManager.broadcastToDoctor(doctorId, 'doctor_queue_update', {
                    refresh: true,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Virtual check-in error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/virtual-checkin/{appointmentId}/status:
 *   post:
 *     summary: Update patient status during virtual waiting room session
 *     tags: [VirtualCheckin]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [EN_ROUTE, ARRIVED, RUNNING_LATE]
 *               etaMinutes:
 *                 type: integer
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Virtual check-in status updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
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

        // Broadcast real-time updates to patient waiting room and doctor dashboard
        const activeStatus = await virtualCheckinService.getWaitingRoomStatus(appointmentId, patientId);
        if (activeStatus) {
            sseManager.broadcastQueueUpdate(appointmentId, activeStatus);
            const doctorId = activeStatus.appointment.doctorId || activeStatus.appointment.doctor_id;
            if (doctorId) {
                sseManager.broadcastToDoctor(doctorId, 'doctor_queue_update', {
                    refresh: true,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Status update error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/virtual-checkin/{appointmentId}/status:
 *   get:
 *     summary: Get waiting room status for a specific appointment
 *     tags: [VirtualCheckin]
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
 *         description: Waiting room status retrieved successfully
 *       404:
 *         description: Appointment not found
 *       401:
 *         description: Unauthorized
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
 * @swagger
 * /api/virtual-checkin/{appointmentId}/stream:
 *   get:
 *     summary: Establish Server-Sent Events (SSE) connection for real-time queue updates
 *     tags: [VirtualCheckin]
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
 *         description: SSE stream established
 *       404:
 *         description: Appointment not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:appointmentId/stream', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;
        
        // Verify patient owns appointment
        const status = await virtualCheckinService.getWaitingRoomStatus(appointmentId, patientId);
        if (!status) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const connectionId = `${patientId}-${Date.now()}`;
        sseManager.addClient(connectionId, res, { 
            appointmentId, 
            doctorId: status.appointment.doctorId || status.appointment.doctor_id 
        });
        
        // Push initial status immediately over SSE
        sseManager.sendToClient(connectionId, 'queue_update', status);

    } catch (error) {
        console.error('SSE connection error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to establish SSE connection' });
        }
    }
});

/**
 * @swagger
 * /api/virtual-checkin/{appointmentId}/ping:
 *   post:
 *     summary: Send heartbeat ping to keep virtual check-in session alive
 *     tags: [VirtualCheckin]
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
 *         description: Heartbeat received successfully
 *       401:
 *         description: Unauthorized
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
 * @swagger
 * /api/virtual-checkin/{appointmentId}/checkin:
 *   delete:
 *     summary: Cancel a virtual check-in
 *     tags: [VirtualCheckin]
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
 *         description: Virtual check-in cancelled successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/:appointmentId/checkin', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const patientId = req.user.id;

        const result = await virtualCheckinService.cancelCheckin(appointmentId, patientId);

        // Broadcast real-time updates to patient waiting room and doctor dashboard
        const activeStatus = await virtualCheckinService.getWaitingRoomStatus(appointmentId, patientId);
        if (activeStatus) {
            sseManager.broadcastQueueUpdate(appointmentId, activeStatus);
            const doctorId = activeStatus.appointment.doctorId || activeStatus.appointment.doctor_id;
            if (doctorId) {
                sseManager.broadcastToDoctor(doctorId, 'doctor_queue_update', {
                    refresh: true,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Cancel check-in error:', error);
        res.status(500).json({ error: 'Failed to cancel check-in' });
    }
});

/**
 * @swagger
 * /api/virtual-checkin/doctor/{doctorId}/queue:
 *   get:
 *     summary: Get live virtual queue list for a specific doctor
 *     tags: [VirtualCheckin]
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
 *         description: Virtual queue list retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires DOCTOR or ADMIN role)
 */
router.get('/doctor/:doctorId/queue', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
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
 * @swagger
 * /api/virtual-checkin/notifications:
 *   get:
 *     summary: Retrieve pending check-in notifications for clinic staff
 *     tags: [VirtualCheckin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: integer
 *         description: Filter notifications by doctor ID
 *     responses:
 *       200:
 *         description: Pending check-in notifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires DOCTOR or ADMIN role)
 */
router.get('/notifications', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
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
 * @swagger
 * /api/virtual-checkin/notifications/{notificationId}/acknowledge:
 *   post:
 *     summary: Acknowledge a pending check-in notification
 *     tags: [VirtualCheckin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notification acknowledged successfully
 *       401:
 *         description: Unauthorized
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
