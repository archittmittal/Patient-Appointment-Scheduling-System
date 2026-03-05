/**
 * Issue #38: Notification Routes
 * API endpoints for managing notifications and preferences
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const notificationService = require('../services/notificationService');

// GET /api/notifications - Get user's notification history
router.get('/', authenticate, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const notifications = await notificationService.getNotificationHistory(
            req.user.id, 
            parseInt(limit)
        );
        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Server error fetching notifications' });
    }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', authenticate, async (req, res) => {
    try {
        await notificationService.markAsRead(parseInt(req.params.id), req.user.id);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', authenticate, async (req, res) => {
    try {
        const db = require('../config/db');
        await db.query(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
            [req.user.id]
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/notifications/preferences - Get notification preferences
router.get('/preferences', authenticate, async (req, res) => {
    try {
        const preferences = await notificationService.getUserPreferences(req.user.id);
        res.json(preferences);
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ message: 'Server error fetching preferences' });
    }
});

// PUT /api/notifications/preferences - Update notification preferences
router.put('/preferences', authenticate, async (req, res) => {
    try {
        const result = await notificationService.updatePreferences(req.user.id, req.body);
        if (result.success) {
            res.json({ message: 'Preferences updated' });
        } else {
            res.status(400).json({ message: 'No valid preferences provided' });
        }
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ message: 'Server error updating preferences' });
    }
});

// POST /api/notifications/subscribe-push - Save push notification subscription
router.post('/subscribe-push', authenticate, async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription) {
            return res.status(400).json({ message: 'Subscription data required' });
        }
        
        await notificationService.savePushSubscription(req.user.id, subscription);
        res.json({ message: 'Push subscription saved' });
    } catch (error) {
        console.error('Save push subscription error:', error);
        res.status(500).json({ message: 'Server error saving subscription' });
    }
});

// POST /api/notifications/test - Send a test notification (for debugging)
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
        console.error('Test notification error:', error);
        res.status(500).json({ message: 'Server error sending test notification' });
    }
});

module.exports = router;
