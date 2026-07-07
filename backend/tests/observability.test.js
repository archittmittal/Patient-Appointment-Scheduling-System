/**
 * observability.test.js
 *
 * Tests for PR #13 — Observability & Monitoring:
 *   - Winston logger transports (console + file in non-test envs)
 *   - Sensitive-field redaction utility
 *   - metricsService unit tests (percentile math, Prometheus format)
 *   - GET /api/health telemetry
 *   - GET /healthz & /api/healthz health probes
 *   - GET /api/metrics  (ADMIN-gated JSON)
 *   - GET /api/metrics/prometheus (ADMIN-gated Prometheus text)
 */

const logger = require('../src/config/logger');
const { redactObject } = require('../src/middleware/requestLogger');
const metricsService = require('../src/services/metricsService');
const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');

// Helper: mint a token for testing auth-gated endpoints
function mintToken(role = 'ADMIN', id = 999) {
    return jwt.sign({ id, role, email: `${role.toLowerCase()}@test.com` }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h', algorithm: 'HS256' });
}

// ── Reset metrics state between tests ─────────────────────────────────────────
beforeEach(() => metricsService._reset());

// ── 1. Winston Logger ─────────────────────────────────────────────────────────
describe('Winston Logger Configuration', () => {
    it('should create a logger with the correct level and transports', () => {
        expect(logger).toBeDefined();
        expect(logger.transports.length).toBeGreaterThan(0);
        expect(logger.level).toBeDefined();
    });

    it('should expose standard logging functions', () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.http).toBe('function');
    });

    it('should expose getTransports() helper', () => {
        expect(typeof logger.getTransports).toBe('function');
        const transports = logger.getTransports();
        expect(Array.isArray(transports)).toBe(true);
        expect(transports.length).toBeGreaterThanOrEqual(1); // at least Console
    });

    it('should have exactly 1 transport in test env (Console only — no file)', () => {
        // File transport is disabled in NODE_ENV=test to avoid creating log files
        const transports = logger.getTransports();
        expect(transports.length).toBe(1); // only Console
    });
});

// ── 2. Sensitive Field Redaction ───────────────────────────────────────────────
describe('Sensitive Field Redaction Utility', () => {
    it('should redact standard auth fields', () => {
        const input = { email: 'test@example.com', password: 'secret', otp: '123456', doctorId: 1 };
        const result = redactObject(input);
        expect(result.password).toBe('[REDACTED]');
        expect(result.otp).toBe('[REDACTED]');
        expect(result.email).toBe('test@example.com');
        expect(result.doctorId).toBe(1);
    });

    it('should redact medical / clinical fields', () => {
        const input = { symptoms: 'Fever', diagnosis: 'Flu', prescription: 'Rest', notes: 'urgent' };
        const result = redactObject(input);
        expect(result.symptoms).toBe('[REDACTED]');
        expect(result.diagnosis).toBe('[REDACTED]');
        expect(result.prescription).toBe('[REDACTED]');
        expect(result.notes).toBe('[REDACTED]');
    });

    it('should recursively redact sensitive fields in nested structures', () => {
        const input = {
            user: { credentials: { password: 'abc', token: 'jwt' } },
            arr: [{ password: 'x' }, { safe: 'y' }]
        };
        const result = redactObject(input);
        expect(result.user.credentials.password).toBe('[REDACTED]');
        expect(result.user.credentials.token).toBe('[REDACTED]');
        expect(result.arr[0].password).toBe('[REDACTED]');
        expect(result.arr[1].safe).toBe('y');
    });

    it('should return primitives and null/undefined unchanged', () => {
        expect(redactObject(null)).toBeNull();
        expect(redactObject(undefined)).toBeUndefined();
        expect(redactObject('string')).toBe('string');
    });
});

// ── 3. metricsService unit tests ──────────────────────────────────────────────
describe('metricsService', () => {
    describe('normaliseRoute()', () => {
        it('strips query strings', () => {
            expect(metricsService.normaliseRoute('/api/patients?page=1')).toBe('/api/patients');
        });

        it('replaces numeric path segments with :id', () => {
            expect(metricsService.normaliseRoute('/api/patients/42/appointments')).toBe('/api/patients/:id/appointments');
        });
    });

    describe('recordRequest() + getSnapshot()', () => {
        it('accumulates request counts', () => {
            metricsService.recordRequest('GET', '/api/appointments', 10, 200);
            metricsService.recordRequest('GET', '/api/appointments', 20, 200);
            metricsService.recordRequest('GET', '/api/appointments', 30, 500);

            const snap = metricsService.getSnapshot();
            expect(snap.requests.total).toBe(3);
            expect(snap.requests.errors5xx).toBe(1);
            expect(snap.requests.errors4xx).toBe(0);
        });

        it('computes accurate p50, p95, p99 percentiles', () => {
            // Record 100 samples: 1ms through 100ms
            for (let i = 1; i <= 100; i++) {
                metricsService.recordRequest('GET', '/api/test', i, 200);
            }
            const snap = metricsService.getSnapshot();
            const stats = snap.latency['GET /api/test'];
            expect(stats).toBeDefined();
            expect(stats.p50).toBe(50);
            expect(stats.p95).toBe(95);
            expect(stats.p99).toBe(99);
            expect(stats.count).toBe(100);
        });

        it('handles 4xx errors correctly', () => {
            metricsService.recordRequest('POST', '/api/auth/login', 5, 401);
            metricsService.recordRequest('POST', '/api/auth/login', 5, 403);
            const snap = metricsService.getSnapshot();
            expect(snap.requests.errors4xx).toBe(2);
        });
    });

    describe('toPrometheusFormat()', () => {
        it('returns valid Prometheus text starting with # HELP', () => {
            metricsService.recordRequest('GET', '/api/appointments', 25, 200);
            const text = metricsService.toPrometheusFormat();
            expect(text).toMatch(/^# HELP/);
            expect(text).toContain('http_request_duration_ms');
            expect(text).toContain('quantile="0.50"');
            expect(text).toContain('quantile="0.95"');
            expect(text).toContain('quantile="0.99"');
        });

        it('includes uptime and request total counters', () => {
            const text = metricsService.toPrometheusFormat();
            expect(text).toContain('process_uptime_seconds');
            expect(text).toContain('http_requests_total');
        });
    });
});

// ── 4. GET /api/health ────────────────────────────────────────────────────────
describe('GET /api/health Telemetry Enrichment', () => {
    it('should return system performance telemetry, memory statistics and database status', async () => {
        const db = require('../src/config/db');
        jest.spyOn(db, 'query').mockResolvedValueOnce([[]]);

        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('database');
        expect(res.body).toHaveProperty('performance');

        const mem = res.body.performance.memory;
        expect(mem).toHaveProperty('rssMb');
        expect(mem).toHaveProperty('heapUsedMb');
        expect(typeof mem.heapUsedMb).toBe('number');
    });
});

// ── 5. GET /healthz ───────────────────────────────────────────────────────────
describe('GET /healthz and /api/healthz Health Probes', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.restoreAllMocks();
    });

    it('should return 200 healthy when DB is up and Redis is not configured', async () => {
        const db = require('../src/config/db');
        jest.spyOn(db, 'query').mockResolvedValueOnce([[]]);

        const res = await request(app).get('/healthz');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.database.healthy).toBe(true);
        expect(res.body.redis.healthy).toBe(true);
        expect(res.body.redis.status).toBe('disabled');
    });

    it('should return 200 healthy via /api/healthz alias', async () => {
        const db = require('../src/config/db');
        jest.spyOn(db, 'query').mockResolvedValueOnce([[]]);

        const res = await request(app).get('/api/healthz');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('should return 503 unhealthy when DB query fails', async () => {
        const db = require('../src/config/db');
        jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('Connection failure'));

        const res = await request(app).get('/healthz');
        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe('error');
        expect(res.body.database.healthy).toBe(false);
        expect(res.body.database.error).toBe('Connection failure');
    });

    it('should return 503 unhealthy when Redis is configured but unreachable', async () => {
        process.env.REDIS_HOST = '127.0.0.1';
        process.env.REDIS_PORT = '9999'; // closed port

        const res = await request(app).get('/healthz');
        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe('error');
        expect(res.body.redis.healthy).toBe(false);
    });
});

// ── 6. GET /api/metrics (ADMIN-gated JSON) ────────────────────────────────────
describe('GET /api/metrics — ADMIN auth-gated JSON', () => {
    it('should return 401 without a token', async () => {
        const res = await request(app).get('/api/metrics');
        expect(res.statusCode).toBe(401);
    });

    it('should return 403 for non-ADMIN roles', async () => {
        const token = mintToken('PATIENT');
        const res = await request(app).get('/api/metrics').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(403);
    });

    it('should return 200 with metrics snapshot for ADMIN', async () => {
        metricsService.recordRequest('GET', '/api/appointments', 30, 200);
        metricsService.recordRequest('GET', '/api/appointments', 60, 200);

        const token = mintToken('ADMIN');
        const res = await request(app).get('/api/metrics').set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('uptimeSeconds');
        expect(res.body).toHaveProperty('requests');
        expect(res.body).toHaveProperty('latency');
        expect(res.body.requests.total).toBeGreaterThanOrEqual(0);
    });
});

// ── 7. GET /api/metrics/prometheus (ADMIN-gated Prometheus) ───────────────────
describe('GET /api/metrics/prometheus — Prometheus text format', () => {
    it('should return 401 without a token', async () => {
        const res = await request(app).get('/api/metrics/prometheus');
        expect(res.statusCode).toBe(401);
    });

    it('should return 403 for DOCTOR role', async () => {
        const token = mintToken('DOCTOR');
        const res = await request(app).get('/api/metrics/prometheus').set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(403);
    });

    it('should return 200 with Prometheus text for ADMIN', async () => {
        const token = mintToken('ADMIN');
        const res = await request(app).get('/api/metrics/prometheus').set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.header['content-type']).toMatch(/text\/plain/);
        expect(res.text).toMatch(/^# HELP/);
        expect(res.text).toContain('http_request_duration_ms');
        expect(res.text).toContain('http_requests_total');
    });
});
