/**
 * @file rateLimit.test.js
 * @description Integration tests for the auth rate limiter on /api/auth/login
 * and /api/auth/register.
 *
 * Strategy: The authLimiter uses keyGenerator: (req) => `${req.ip}::${req.path}`
 * so /login and /register maintain INDEPENDENT counters per IP (each endpoint
 * has its own 10-attempts-per-hour budget). Tests fire 11 sequential requests
 * per endpoint and assert the 11th returns HTTP 429.
 *
 * The DB is fully mocked so these tests have zero real-DB dependencies.
 */

const request = require('supertest');
const app = require('../src/server');

// ── Mock DB so the server can boot without a live database ──────────────────
jest.mock('../src/config/db', () => ({
    query: jest.fn().mockResolvedValue([[]]),
    getConnection: jest.fn(() =>
        Promise.resolve({
            query: jest.fn().mockResolvedValue([[]]),
            beginTransaction: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            release: jest.fn(),
        })
    ),
}));

// ── Mock google-auth-library (imported transitively by authController) ───────
jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: jest.fn(),
    })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
const VALID_LOGIN_BODY = {
    email: 'test@example.com',
    password: 'password123',
};

const VALID_REGISTER_BODY = {
    email: 'newuser@example.com',
    password: 'password123',
    first_name: 'Jane',
    last_name: 'Doe',
    phone: '9999999999',
};

/**
 * Fire `n` POST requests to `route` with `body` and return all responses.
 * Requests are sequential so the rate-limit counter increments reliably.
 */
async function fireRequests(route, body, n) {
    const responses = [];
    for (let i = 0; i < n; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app).post(route).send(body);
        responses.push(res);
    }
    return responses;
}

// ── Test suites ──────────────────────────────────────────────────────────────
describe('Auth Rate Limiter — /api/auth/login', () => {
    /**
     * The authLimiter keys on IP + path, so /login and /register each have
     * their own independent counter. These tests exhaust the /login budget
     * (10 requests) and confirm the 11th returns 429.
     *
     * express-rate-limit uses in-process memory, which persists for the
     * lifetime of the `app` module within this Jest worker. Tests in this
     * describe block intentionally build on each other's counter state.
     */

    it('returns HTTP 429 after exceeding the login rate limit (11th request)', async () => {
        const responses = await fireRequests('/api/auth/login', VALID_LOGIN_BODY, 11);
        const lastRes = responses[responses.length - 1];

        expect(lastRes.status).toBe(429);
    });

    it('429 response body has status=fail, code=TOO_MANY_REQUESTS, and message', async () => {
        // The counter is already exhausted from the previous test — one more hit.
        const res = await request(app).post('/api/auth/login').send(VALID_LOGIN_BODY);

        expect(res.status).toBe(429);
        expect(res.body).toMatchObject({
            status: 'fail',
            code: 'TOO_MANY_REQUESTS',
        });
        expect(typeof res.body.message).toBe('string');
        expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('429 response includes RateLimit standard headers', async () => {
        const res = await request(app).post('/api/auth/login').send(VALID_LOGIN_BODY);

        expect(res.status).toBe(429);
        // RFC 6585 / express-rate-limit standardHeaders: true
        expect(res.headers).toHaveProperty('ratelimit-limit');
        expect(res.headers).toHaveProperty('ratelimit-remaining');
        expect(res.headers).toHaveProperty('retry-after');
    });

    it('does NOT expose legacy X-RateLimit-* headers', async () => {
        const res = await request(app).post('/api/auth/login').send(VALID_LOGIN_BODY);

        // legacyHeaders: false — these must be absent
        expect(res.headers['x-ratelimit-limit']).toBeUndefined();
        expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
    });
});

describe('Auth Rate Limiter — /api/auth/register (independent counter)', () => {
    /**
     * Because keyGenerator keys on IP + path, the /register counter is
     * completely independent from /login. This test fires 11 /register-only
     * requests and verifies that /register enforces its own 10-attempt limit.
     */
    it('returns HTTP 429 after exhausting the register-specific rate limit (11th request)', async () => {
        // Use a fixed email — the DB mock always returns an empty result set,
        // so registration will 500 (no real DB) but the limiter still counts it.
        const body = { ...VALID_REGISTER_BODY };
        const responses = await fireRequests('/api/auth/register', body, 11);
        const lastRes = responses[responses.length - 1];

        expect(lastRes.status).toBe(429);
        expect(lastRes.body).toMatchObject({
            status: 'fail',
            code: 'TOO_MANY_REQUESTS',
        });
    });
});
