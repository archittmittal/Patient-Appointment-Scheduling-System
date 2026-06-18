/**
 * @file payments.test.js
 * @description Integration tests for Day 3: Payment Webhook Verification & Intent Ownership.
 *
 * Verifies two security controls in payments.js / paymentService.js:
 *
 *  [SEC-003] Webhook signature verification
 *    - Valid `stripe-signature` header → 200 received:true
 *    - Invalid signature → 400 (signature mismatch)
 *    - Missing sig in production → 400 (rejected by production guard)
 *    - Missing STRIPE_WEBHOOK_SECRET in production → 400
 *
 *  [SEC-004] Payment intent ownership
 *    - Wrong patient → 403 Forbidden
 *    - Appointment not found → 404
 *    - Already paid → 400
 *    - Owner, unpaid → 200 with clientSecret
 *    - Missing appointmentId → 400
 *    - No auth token → 401
 *
 * Mocking strategy
 * ─────────────────
 * • DB is mocked via jest.mock so tests have zero real-DB dependency.
 * • The Stripe SDK is mocked; its constructEvent is exposed on the mock
 *   constructor so tests can control its return value per test.
 * • paymentService is NOT mocked wholesale — its real logic runs against
 *   the mocked DB so SEC-004 ownership checks are exercised end-to-end.
 *   The only exception: stripe.paymentIntents.create is controlled via
 *   the mock so tests don't hit the real API.
 */

// ── All jest.mock() calls must come before any requires ──────────────────────
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../src/services/emailService', () => ({
    sendPaymentReceipt: jest.fn().mockResolvedValue(),
}));

jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: jest.fn() })),
}));

// Stripe mock: the route (payments.js) calls `require('stripe')(key)` inline
// inside the webhook handler. We expose the constructEvent fn on _instance
// so tests can control it after require.
jest.mock('stripe', () => {
    const constructEvent = jest.fn();
    const paymentIntentsCreate = jest.fn();
    const instance = {
        webhooks: { constructEvent },
        paymentIntents: { create: paymentIntentsCreate },
    };
    const StripeMock = jest.fn().mockReturnValue(instance);
    StripeMock._instance = instance;
    return StripeMock;
});

// ── Requires AFTER mocks ──────────────────────────────────────────────────────
const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/server');
const mockDb  = require('../src/config/db');
const { jwtSecret } = require('../src/middleware/authenticate');

const StripeModule        = jest.requireMock('stripe');
const mockConstructEvent  = StripeModule._instance.webhooks.constructEvent;
const mockPaymentCreate   = StripeModule._instance.paymentIntents.create;

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeToken(userId, role = 'PATIENT') {
    return jwt.sign({ id: userId, role, email: `u${userId}@test.com` }, jwtSecret, { expiresIn: '1h' });
}

function makeStripeEvent(appointmentId, userId) {
    return {
        type: 'payment_intent.succeeded',
        data: {
            object: {
                id: 'pi_mock',
                amount: 50000,
                metadata: {
                    appointmentId: String(appointmentId),
                    userId: String(userId),
                    doctorId: '7',
                },
            },
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// [SEC-003] Webhook — signature verification
// ─────────────────────────────────────────────────────────────────────────────
describe('[SEC-003] POST /api/payments/webhook', () => {
    const WEBHOOK_SECRET = 'whsec_test_secret';

    beforeAll(() => { process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET; });
    afterAll(() => { delete process.env.STRIPE_WEBHOOK_SECRET; });
    beforeEach(() => {
        jest.clearAllMocks();
        // jest.clearAllMocks() resets StripeMock's return value too.
        // Restore it so require('stripe')(key) continues to return our instance.
        StripeModule.mockReturnValue(StripeModule._instance);
        // Restore a safe default so handleWebhook DB calls don't throw
        mockDb.query.mockResolvedValue([[]]);
    });

    it('returns 200 when constructEvent succeeds (valid signature)', async () => {
        const event = makeStripeEvent(1, 1);
        // Make constructEvent return a valid event object
        mockConstructEvent.mockReturnValue(event);
        // handleWebhook will try to do DB queries with the event —
        // mockDb.query is already set to resolve empty in beforeEach.

        const res = await request(app)
            .post('/api/payments/webhook')
            .set('stripe-signature', 'valid_sig')
            .type('application/json')
            .send(JSON.stringify(event));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ received: true });
        expect(mockConstructEvent).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when constructEvent throws (invalid signature)', async () => {
        mockConstructEvent.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature');
        });

        const res = await request(app)
            .post('/api/payments/webhook')
            .set('stripe-signature', 'bad_sig')
            .type('application/json')
            .send('{"type":"test"}');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/signature/i);
    });

    it('returns 400 when stripe-signature header is absent in production', async () => {
        const orig = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const res = await request(app)
            .post('/api/payments/webhook')
            .type('application/json')
            .send('{"type":"test"}');

        process.env.NODE_ENV = orig;
        expect(res.status).toBe(400);
    });

    it('returns 400 when STRIPE_WEBHOOK_SECRET is not configured in production', async () => {
        const origSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const origEnv    = process.env.NODE_ENV;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        process.env.NODE_ENV = 'production';

        const res = await request(app)
            .post('/api/payments/webhook')
            .set('stripe-signature', 'any')
            .type('application/json')
            .send('{"type":"test"}');

        process.env.NODE_ENV = origEnv;
        if (origSecret) process.env.STRIPE_WEBHOOK_SECRET = origSecret;

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not configured|secret/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [SEC-004] Create payment intent — ownership & guards
// ─────────────────────────────────────────────────────────────────────────────
describe('[SEC-004] POST /api/payments/create-intent', () => {
    beforeEach(() => jest.clearAllMocks());

    const UNPAID_APPT = {
        id: 5, patient_id: 1, doctor_id: 7,
        payment_status: 'UNPAID', consultation_fee: '500.00',
        doctor_first_name: 'Priya', doctor_last_name: 'Sharma',
    };

    it('returns 403 when the requesting patient does not own the appointment', async () => {
        mockDb.query.mockResolvedValueOnce([[{ ...UNPAID_APPT, patient_id: 99 }]]);

        const res = await request(app)
            .post('/api/payments/create-intent')
            .set('Authorization', `Bearer ${makeToken(1)}`)
            .send({ appointmentId: 5 });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not authorized/i);
    });

    it('returns 404 when appointment does not exist', async () => {
        mockDb.query.mockResolvedValueOnce([[]]);

        const res = await request(app)
            .post('/api/payments/create-intent')
            .set('Authorization', `Bearer ${makeToken(1)}`)
            .send({ appointmentId: 9999 });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 400 when appointment is already paid', async () => {
        mockDb.query.mockResolvedValueOnce([[{ ...UNPAID_APPT, payment_status: 'PAID' }]]);

        const res = await request(app)
            .post('/api/payments/create-intent')
            .set('Authorization', `Bearer ${makeToken(1)}`)
            .send({ appointmentId: 5 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already been paid/i);
    });

    it('returns 200 with clientSecret when patient owns an unpaid appointment', async () => {
        mockDb.query
            .mockResolvedValueOnce([[UNPAID_APPT]])           // SELECT appointment + doctor
            .mockResolvedValueOnce([{ affectedRows: 1 }]);    // UPDATE appointments

        mockPaymentCreate.mockResolvedValue({
            id: 'pi_mock_abc',
            client_secret: 'pi_mock_abc_secret_xyz',
        });

        const res = await request(app)
            .post('/api/payments/create-intent')
            .set('Authorization', `Bearer ${makeToken(1)}`)
            .send({ appointmentId: 5 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('clientSecret', 'pi_mock_abc_secret_xyz');
        expect(res.body).toHaveProperty('amount', 500);
        expect(mockPaymentCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 50000,        // 500.00 INR → 50 000 paise
                currency: 'inr',
                metadata: expect.objectContaining({ appointmentId: '5', userId: '1' }),
            })
        );
    });

    it('returns 400 when appointmentId is absent from body', async () => {
        const res = await request(app)
            .post('/api/payments/create-intent')
            .set('Authorization', `Bearer ${makeToken(1)}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/appointment id is required/i);
    });

    it('returns 401 when no Authorization header is provided', async () => {
        const res = await request(app)
            .post('/api/payments/create-intent')
            .send({ appointmentId: 5 });

        expect(res.status).toBe(401);
    });
});
