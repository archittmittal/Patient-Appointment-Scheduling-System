const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL CONFIGURATION ERROR: STRIPE_SECRET_KEY environment variable is missing in production.');
    }
    console.warn('⚠️ WARNING: STRIPE_SECRET_KEY is not defined. Using sk_test_mock fallback for development.');
}

const stripe = require('stripe')(stripeKey || 'sk_test_mock');
const db = require('../config/db');

class PaymentService {
    /**
     * Create a Stripe Payment Intent for an appointment
     */
    async createPaymentIntent(appointmentId, userId) {
        // 1. Get appointment details and doctor's fee
        // For now, using a flat fee of $50 or similar
        const amount = 5000; // $50.00 in cents

        // 2. Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            metadata: { appointmentId: appointmentId.toString(), userId: userId.toString() },
            automatic_payment_methods: { enabled: true },
        });

        // 3. Update appointment with payment intent ID
        await db.query(
            'UPDATE appointments SET stripe_payment_intent_id = ?, payment_amount = ?, payment_status = ? WHERE id = ?',
            [paymentIntent.id, amount / 100, 'PENDING', appointmentId]
        );

        return {
            clientSecret: paymentIntent.client_secret,
            amount: amount / 100
        };
    }

    /**
     * Handle Stripe Webhook (Simplified)
     */
    async handleWebhook(event) {
        const intent = event.data.object;
        const appointmentId = intent.metadata.appointmentId;

        if (event.type === 'payment_intent.succeeded') {
            await db.query(
                'UPDATE appointments SET payment_status = ? WHERE id = ?',
                ['PAID', appointmentId]
            );
            
            // Log transaction
            await db.query(
                'INSERT INTO payment_transactions (appointment_id, user_id, amount, status, provider, provider_transaction_id) VALUES (?, ?, ?, ?, ?, ?)',
                [appointmentId, intent.metadata.userId, intent.amount / 100, 'SUCCESS', 'STRIPE', intent.id]
            );
        } else if (event.type === 'payment_intent.payment_failed') {
            await db.query(
                'UPDATE appointments SET payment_status = ? WHERE id = ?',
                ['UNPAID', appointmentId]
            );
        }
    }
}

module.exports = new PaymentService();
