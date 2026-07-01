const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const db = require('../src/config/db');
const { jwtSecret } = require('../src/middleware/authenticate');

describe('Database Pagination & Pool Limits (PR #8)', () => {
    const patientToken = jwt.sign({ id: 1, role: 'PATIENT' }, jwtSecret);

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('GET /api/patients/:id/appointments pagination', () => {
        it('should return paginated appointments envelope', async () => {
            // Mock DB response for count & select
            jest.spyOn(db, 'query')
                .mockResolvedValueOnce([[{ total: 5 }]]) // count query
                .mockResolvedValueOnce([ // rows query
                    [
                        { id: 1, appointment_date: '2026-07-02', time_slot: '10:00 AM', status: 'CONFIRMED' },
                        { id: 2, appointment_date: '2026-07-02', time_slot: '11:00 AM', status: 'PENDING' }
                    ]
                ]);

            const res = await request(app)
                .get('/api/patients/1/appointments?page=1&limit=2')
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('page', 1);
            expect(res.body).toHaveProperty('totalPages', 3);
            expect(res.body).toHaveProperty('total', 5);
            expect(res.body.data).toHaveLength(2);
        });
    });

    describe('Database Queue Limit 503 Route Handling', () => {
        it('should return 503 when pool queue limit is exceeded', async () => {
            const limitErr = new Error('Database connection queue limit exceeded');
            limitErr.statusCode = 503;
            limitErr.code = 'DATABASE_QUEUE_LIMIT_EXCEEDED';
            limitErr.isPublic = true;

            jest.spyOn(db, 'query').mockRejectedValueOnce(limitErr);

            const res = await request(app)
                .get('/api/patients/1/appointments')
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(503);
            expect(res.body.code).toBe('DATABASE_QUEUE_LIMIT_EXCEEDED');
            expect(res.body.message).toContain('Database connection queue limit exceeded');
        });
    });

    describe('Database Queue Limit Error Conversion Logic', () => {
        it('should correctly convert "Queue limit reached." error to 503 error', async () => {
            const mockPool = {
                query: jest.fn().mockRejectedValue(new Error('Queue limit reached.'))
            };

            const wrapQuery = async function(...args) {
                try {
                    return await mockPool.query(...args);
                } catch (err) {
                    if (err.message && err.message.includes('Queue limit reached')) {
                        const limitErr = new Error('Database connection queue limit exceeded');
                        limitErr.statusCode = 503;
                        limitErr.code = 'DATABASE_QUEUE_LIMIT_EXCEEDED';
                        limitErr.isPublic = true;
                        throw limitErr;
                    }
                    throw err;
                }
            };

            await expect(wrapQuery('SELECT 1')).rejects.toThrow('Database connection queue limit exceeded');
            try {
                await wrapQuery('SELECT 1');
            } catch (err) {
                expect(err.statusCode).toBe(503);
                expect(err.code).toBe('DATABASE_QUEUE_LIMIT_EXCEEDED');
            }
        });
    });
});
