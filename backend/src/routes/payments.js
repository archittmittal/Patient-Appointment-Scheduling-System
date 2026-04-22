const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticate } = require('../middleware/authenticate');

/**
 * Create Payment Intent for an appointment
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
 * Webhook for Stripe events
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
