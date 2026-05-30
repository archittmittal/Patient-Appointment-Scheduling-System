const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL CONFIGURATION ERROR: STRIPE_SECRET_KEY environment variable is missing in production.');
    }
    console.warn('⚠️ WARNING: STRIPE_SECRET_KEY is not defined. Using sk_test_mock fallback for development.');
}

const stripe = require('stripe')(stripeKey || 'sk_test_mock');
const db = require('../config/db');
const emailService = require('./emailService');

class PaymentService {
    /**
     * Create a Stripe Payment Intent for an appointment.
     *
     * Security changes (Sprint 3):
     *   [SEC-004] - Verifies the authenticated user owns the appointment before proceeding.
     *   [HC-004]  - Retrieves consultation_fee dynamically from the doctor's profile instead of
     *               using a hardcoded $50 amount. The fee is variable per doctor.
     *
     * @param {number} appointmentId - The appointment to charge for
     * @param {number} userId - The authenticated user's ID (must be the appointment's patient)
     * @returns {{ clientSecret: string, amount: number }} Stripe client secret and dollar amount
     */
    async createPaymentIntent(appointmentId, userId) {
        // ------------------------------------------------------------------
        // 1. Fetch appointment + doctor's consultation fee in one query
        // ------------------------------------------------------------------
        const [rows] = await db.query(
            `SELECT a.id, a.patient_id, a.doctor_id, a.payment_status,
                    d.consultation_fee, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
             FROM appointments a
             JOIN doctors d ON d.id = a.doctor_id
             WHERE a.id = ?`,
            [appointmentId]
        );

        if (!rows || rows.length === 0) {
            const error = new Error('Appointment not found');
            error.statusCode = 404;
            throw error;
        }

        const appointment = rows[0];

        // ------------------------------------------------------------------
        // 2. [SEC-004] Ownership check — only the patient can create a payment
        // ------------------------------------------------------------------
        if (appointment.patient_id !== userId) {
            const error = new Error('You are not authorized to make a payment for this appointment');
            error.statusCode = 403;
            throw error;
        }

        // ------------------------------------------------------------------
        // 3. Guard against duplicate payments
        // ------------------------------------------------------------------
        if (appointment.payment_status === 'PAID') {
            const error = new Error('This appointment has already been paid for');
            error.statusCode = 400;
            throw error;
        }

        // ------------------------------------------------------------------
        // 4. [HC-004] Dynamic consultation fee — read from the doctor record
        //    No hardcoded fallbacks; the column is NOT NULL in the schema.
        // ------------------------------------------------------------------
        const consultationFee = parseFloat(appointment.consultation_fee);
        if (isNaN(consultationFee) || consultationFee <= 0) {
            const error = new Error(
                `Doctor ${appointment.doctor_first_name} ${appointment.doctor_last_name} does not have a valid consultation fee configured`
            );
            error.statusCode = 422;
            throw error;
        }

        const amountInPaise = Math.round(consultationFee * 100);

        // ------------------------------------------------------------------
        // 5. Create Stripe Payment Intent
        // ------------------------------------------------------------------
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInPaise,
            currency: 'inr',
            metadata: {
                appointmentId: appointmentId.toString(),
                userId: userId.toString(),
                doctorId: appointment.doctor_id.toString()
            },
            automatic_payment_methods: { enabled: true },
        });

        // ------------------------------------------------------------------
        // 6. Persist payment intent reference on the appointment
        // ------------------------------------------------------------------
        await db.query(
            'UPDATE appointments SET stripe_payment_intent_id = ?, payment_amount = ?, payment_status = ? WHERE id = ?',
            [paymentIntent.id, consultationFee, 'PENDING', appointmentId]
        );

        return {
            clientSecret: paymentIntent.client_secret,
            amount: consultationFee,
            doctorName: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`
        };
    }

    /**
     * Handle Stripe Webhook event (called after signature verification in the route layer).
     *
     * @param {object} event - The verified Stripe event object
     */
    async handleWebhook(event) {
        const intent = event.data.object;
        const appointmentId = intent.metadata?.appointmentId;

        if (!appointmentId) {
            console.warn('Webhook received event without appointmentId in metadata:', event.type);
            return;
        }

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

            // Fetch details for email receipt
            try {
                const [apptRows] = await db.query(`
                    SELECT a.appointment_date, a.time_slot, a.queue_number, 
                           u.email, d.first_name, d.last_name 
                    FROM appointments a
                    JOIN users u ON a.patient_id = u.id
                    JOIN doctors d ON a.doctor_id = d.id
                    WHERE a.id = ?
                `, [appointmentId]);

                if (apptRows.length > 0) {
                    const data = apptRows[0];
                    await emailService.sendPaymentReceipt(data.email, {
                        queueNumber: data.queue_number,
                        amount: intent.amount / 100,
                        doctorName: `${data.first_name} ${data.last_name}`,
                        date: data.appointment_date,
                        time: data.time_slot
                    });
                    console.log(`[Stripe Webhook] Payment receipt sent to ${data.email} for appointment ${appointmentId}`);
                }
            } catch (err) {
                console.error(`[Stripe Webhook] Failed to send receipt for appointment ${appointmentId}:`, err);
            }
        } else if (event.type === 'payment_intent.payment_failed') {
            await db.query(
                'UPDATE appointments SET payment_status = ? WHERE id = ?',
                ['UNPAID', appointmentId]
            );
        }
    }
}

module.exports = new PaymentService();
