const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');

/**
 * Send a message
 */
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { receiverId, content, appointmentId } = req.body;
        if (!receiverId || !content) {
            return res.status(400).json({ message: 'Receiver ID and content are required' });
        }

        const [result] = await db.query(
            'INSERT INTO messages (sender_id, receiver_id, content, appointment_id) VALUES (?, ?, ?, ?)',
            [req.user.id, receiverId, content, appointmentId || null]
        );

        res.status(201).json({ id: result.insertId, sender_id: req.user.id, receiver_id: receiverId, content });
    } catch (error) {
        next(error);
    }
});

/**
 * Get message history with a specific user
 */
router.get('/history/:userId', authenticate, async (req, res, next) => {
    try {
        const otherUserId = req.params.userId;
        const query = `
            SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
        `;
        const [messages] = await db.query(query, [req.user.id, otherUserId, otherUserId, req.user.id]);
        
        // Mark as read
        await db.query(
            'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
            [otherUserId, req.user.id]
        );

        res.json(messages);
    } catch (error) {
        next(error);
    }
});

/**
 * Get list of conversations
 */
router.get('/conversations', authenticate, async (req, res, next) => {
    try {
        const query = `
            SELECT DISTINCT 
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
                MAX(created_at) as last_message_time
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY other_user_id
            ORDER BY last_message_time DESC
        `;
        const [conversations] = await db.query(query, [req.user.id, req.user.id, req.user.id]);
        res.json(conversations);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
