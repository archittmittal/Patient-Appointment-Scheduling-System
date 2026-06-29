const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticate } = require('../middleware/authenticate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const logger = require('../config/logger');

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
 *     summary: Create Payment Intent for an appointment consultation fee
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
 *         description: Payment intent details (Stripe clientSecret, fee amount, doctor name)
 *       400:
 *         description: Appointment ID is required or appointment already paid
 *       403:
 *         description: User does not own this appointment
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Doctor has no valid consultation fee configured
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
        // Forward custom status codes from the service layer
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        next(error);
    }
});

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Webhook receiver for Stripe billing/payment events
 *     description: |
 *       This endpoint verifies the Stripe-Signature header before processing.
 *       The raw request body must be preserved for signature verification.
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
 *         description: Webhook signature verification failed
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // ------------------------------------------------------------------
    // [SEC-003] Verify Stripe webhook signature
    // Requires STRIPE_WEBHOOK_SECRET from environment (obtained via Stripe Dashboard
    // or `stripe listen --print-secret` in development).
    // ------------------------------------------------------------------
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'];

    let event;

    if (webhookSecret && sig) {
        // Production path: always verify signature
        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            logger.error(`⛔ Webhook signature verification failed: ${err.message}`);
            return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
        }
    } else if (process.env.NODE_ENV === 'production') {
        // In production, webhook secret MUST be set
        logger.error('⛔ STRIPE_WEBHOOK_SECRET is not configured. Rejecting unverified webhook in production.');
        return res.status(400).json({ error: 'Webhook secret not configured. Cannot process unverified webhooks in production.' });
    } else {
        // Development fallback: parse body directly (no signature check)
        logger.warn('STRIPE_WEBHOOK_SECRET not set — processing unverified webhook in development mode.');
        try {
            event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (parseErr) {
            return res.status(400).json({ error: 'Invalid JSON in webhook body' });
        }
    }

    try {
        await paymentService.handleWebhook(event);
        res.json({ received: true });
    } catch (error) {
        logger.error('Webhook processing error:', error);
        // SEC-010: Do not surface internal webhook error detail in production
        res.status(400).json({ error: safeErrorMessage(error, 'Webhook processing error') });
    }
});

module.exports = router;
