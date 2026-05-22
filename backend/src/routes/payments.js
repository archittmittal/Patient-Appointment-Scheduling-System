const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticate } = require('../middleware/authenticate');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Stripe billing, payment intent creation, and webhook integrations
 */

/**
 * @swagger
 * /api/payments/create-intent:
 *   post:
 *     summary: Create Payment Intent for an appointment co-pay or fee
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *             properties:
 *               appointmentId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Payment intent details (Stripe clientSecret, etc.) retrieved successfully
 *       400:
 *         description: Appointment ID is required
 *       500:
 *         description: Server error
 */
router.post('/create-intent', authenticate, async (req, res, next) => {
    try {
        const { appointmentId } = req.body;
        if (!appointmentId) {
            return res.status(400).json({ message: 'Appointment ID is required' });
        }

        const data = await paymentService.createPaymentIntent(appointmentId, req.user.id);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Webhook receiver for Stripe billing/payment events
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Stripe webhook event processed successfully
 *       400:
 *         description: Bad request / webhook signature verification failed
 */
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    // In a real app, verify Stripe signature here
    try {
        await paymentService.handleWebhook(req.body);
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

module.exports = router;
