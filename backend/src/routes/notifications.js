/**
 * Issue #38: Notification Routes
 * API endpoints for managing notifications and preferences
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

// Validation Schemas
const preferencesSchema = Joi.object({
    email_enabled: Joi.boolean(),
    push_enabled: Joi.boolean(),
    sms_enabled: Joi.boolean(),
    appointment_reminders: Joi.boolean(),
    queue_updates: Joi.boolean(),
    delay_alerts: Joi.boolean(),
    health_tips: Joi.boolean()
}).min(1);

const pushSubscriptionSchema = Joi.object({
    subscription: Joi.object().required()
});

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management and user preferences
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notification history for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of notifications to retrieve
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const notifications = await notificationService.getNotificationHistory(
            req.user.id, 
            parseInt(limit)
        );
        res.json(notifications);
    } catch (error) {
        logger.error('Get notifications error:', error);
        res.status(500).json({ message: 'Server error fetching notifications' });
    }
});

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (error) {
        logger.error('Get unread count error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   post:
 *     summary: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/read', authenticate, async (req, res) => {
    try {
        await notificationService.markAsRead(parseInt(req.params.id), req.user.id);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        logger.error('Mark as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   post:
 *     summary: Mark all notifications as read for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/mark-all-read', authenticate, async (req, res) => {
    try {
        const db = require('../config/db');
        await db.query(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
            [req.user.id]
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        logger.error('Mark all read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     summary: Get notification preferences for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/preferences', authenticate, async (req, res) => {
    try {
        const preferences = await notificationService.getUserPreferences(req.user.id);
        res.json(preferences);
    } catch (error) {
        logger.error('Get preferences error:', error);
        res.status(500).json({ message: 'Server error fetching preferences' });
    }
});

/**
 * @swagger
 * /api/notifications/preferences:
 *   put:
 *     summary: Update notification preferences for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_enabled:
 *                 type: boolean
 *               push_enabled:
 *                 type: boolean
 *               sms_enabled:
 *                 type: boolean
 *               appointment_reminders:
 *                 type: boolean
 *               queue_updates:
 *                 type: boolean
 *               delay_alerts:
 *                 type: boolean
 *               health_tips:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid body or no valid preferences provided
 *       401:
 *         description: Unauthorized
 */
router.put('/preferences', authenticate, validateRequest(preferencesSchema), async (req, res) => {
    try {
        const result = await notificationService.updatePreferences(req.user.id, req.body);
        if (result.success) {
            res.json({ message: 'Preferences updated' });
        } else {
            res.status(400).json({ message: 'No valid preferences provided' });
        }
    } catch (error) {
        logger.error('Update preferences error:', error);
        res.status(500).json({ message: 'Server error updating preferences' });
    }
});

/**
 * @swagger
 * /api/notifications/subscribe-push:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *                 description: Web Push subscription object
 *     responses:
 *       200:
 *         description: Push subscription saved successfully
 *       400:
 *         description: Invalid subscription data
 *       401:
 *         description: Unauthorized
 */
router.post('/subscribe-push', authenticate, validateRequest(pushSubscriptionSchema), async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription) {
            return res.status(400).json({ message: 'Subscription data required' });
        }
        
        await notificationService.savePushSubscription(req.user.id, subscription);
        res.json({ message: 'Push subscription saved' });
    } catch (error) {
        logger.error('Save push subscription error:', error);
        res.status(500).json({ message: 'Server error saving subscription' });
    }
});

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Send a test notification to the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 default: QUEUE_UPDATE
 *                 description: Notification type
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/test', authenticate, async (req, res) => {
    try {
        const { type = 'QUEUE_UPDATE' } = req.body;
        
        const result = await notificationService.sendNotification(req.user.id, type, {
            position: 3,
            doctor_name: 'Test Doctor',
            wait_time: '15',
            room: 'Room 101',
            date: new Date().toLocaleDateString(),
            time: '10:00 AM',
            delay_mins: '20',
            new_time: '10:20 AM',
            time_until: '1 hour',
            expires_in: '30'
        });
        
        res.json(result);
    } catch (error) {
        logger.error('Test notification error:', error);
        res.status(500).json({ message: 'Server error sending test notification' });
    }
});

module.exports = router;
