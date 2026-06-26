const logger = require('../src/config/logger');
const { redactObject } = require('../src/middleware/requestLogger');
const request = require('supertest');
const app = require('../src/server');

describe('Observability & Monitoring Tests', () => {
    describe('Winston Logger Configuration', () => {
        it('should create a logger with the correct level and transport configuration', () => {
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
    });

    describe('Sensitive Field Redaction Utility', () => {
        it('should redact sensitive fields in a flat object', () => {
            const input = {
                email: 'test@example.com',
                password: 'secretPassword123',
                otp: '123456',
                doctorId: 1
            };
            const expected = {
                email: 'test@example.com',
                password: '[REDACTED]',
                otp: '[REDACTED]',
                doctorId: 1
            };
            expect(redactObject(input)).toEqual(expected);
        });

        it('should recursively redact sensitive fields in nested structures', () => {
            const input = {
                user: {
                    email: 'nested@example.com',
                    credentials: {
                        password: 'nestedPassword',
                        token: 'jwt-token-xyz'
                    }
                },
                regularArray: [
                    { password: '123' },
                    { nonSensitive: 'abc' }
                ],
                nonSensitive: 'ok'
            };
            const expected = {
                user: {
                    email: 'nested@example.com',
                    credentials: {
                        password: '[REDACTED]',
                        token: '[REDACTED]'
                    }
                },
                regularArray: [
                    { password: '[REDACTED]' },
                    { nonSensitive: 'abc' }
                ],
                nonSensitive: 'ok'
            };
            expect(redactObject(input)).toEqual(expected);
        });

        it('should return null or undefined if input is null or undefined', () => {
            expect(redactObject(null)).toBeNull();
            expect(redactObject(undefined)).toBeUndefined();
            expect(redactObject('just-a-string')).toBe('just-a-string');
        });
    });

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
            
            const perf = res.body.performance;
            expect(perf).toHaveProperty('memory');
            expect(perf).toHaveProperty('cpu');
            expect(perf).toHaveProperty('nodeVersion');
            
            const mem = perf.memory;
            expect(mem).toHaveProperty('rssMb');
            expect(mem).toHaveProperty('heapTotalMb');
            expect(mem).toHaveProperty('heapUsedMb');
            expect(mem).toHaveProperty('externalMb');
            
            expect(typeof mem.heapUsedMb).toBe('number');
            expect(typeof perf.nodeVersion).toBe('string');
        });
    });

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
            // Set Redis host to an unreachable address to trigger socket failure
            process.env.REDIS_HOST = '127.0.0.1';
            process.env.REDIS_PORT = '9999'; // invalid/closed port

            const res = await request(app).get('/healthz');
            expect(res.statusCode).toBe(503);
            expect(res.body.status).toBe('error');
            expect(res.body.redis.healthy).toBe(false);
            expect(res.body.redis.status).toBe('error');
            expect(res.body.redis.error).toBeDefined();
        });
    });
});
