const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Peer-to-peer patient and provider secure messaging
 */

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send a secure message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - content
 *             properties:
 *               receiverId:
 *                 type: integer
 *               content:
 *                 type: string
 *               appointmentId:
 *                 type: integer
 *                 description: Optional reference to an appointment context
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Receiver ID and content are required
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { receiverId, content, appointmentId } = req.body;
        if (!receiverId || !content) {
            return res.status(400).json({ message: 'Receiver ID and content are required' });
        }

        const senderId = req.user.id;

        // SEC-009: Enforce doctor–patient relationship before allowing messages.
        // ADMINs may message anyone. All other roles must share at least one
        // confirmed/in-progress/scheduled appointment with the receiver.
        if (req.user.role !== 'ADMIN') {
            const [relRows] = await db.query(
                `SELECT id FROM appointments
                 WHERE ((patient_id = ? AND doctor_id = ?) OR (patient_id = ? AND doctor_id = ?))
                    AND status IN ('CONFIRMED', 'IN_PROGRESS', 'SCHEDULED', 'PENDING')
                 LIMIT 1`,
                [senderId, receiverId, receiverId, senderId]
            );
            if (relRows.length === 0) {
                return res.status(403).json({
                    message: 'No active appointment relationship with this user'
                });
            }
        }

        const [result] = await db.query(
            'INSERT INTO messages (sender_id, receiver_id, content, appointment_id) VALUES (?, ?, ?, ?)',
            [senderId, receiverId, content, appointmentId || null]
        );

        res.status(201).json({ id: result.insertId, sender_id: senderId, receiver_id: receiverId, content });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/messages/history/{userId}:
 *   get:
 *     summary: Get message history with a specific user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the other user in the conversation
 *     responses:
 *       200:
 *         description: Message history retrieved and unread messages marked as read
 *       500:
 *         description: Server error
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
 * @swagger
 * /api/messages/conversations:
 *   get:
 *     summary: Get list of active conversations for the authenticated user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active conversations list retrieved successfully
 *       500:
 *         description: Server error
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
