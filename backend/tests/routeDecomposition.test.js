const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const authorizeOwner = require('../src/middleware/authorizeOwner');

function mintToken(role = 'PATIENT', id = 1) {
    return jwt.sign(
        { id, role, email: `${role.toLowerCase()}@test.com` },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h', algorithm: 'HS256' }
    );
}

describe('Route Decomposition & Resource Authorization (PR #14)', () => {
    describe('authorizeOwner middleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                user: { id: 42, role: 'PATIENT' },
                params: { patientId: '42', otherId: '99' }
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        it('should call next if req.user.id matches target param value', () => {
            const middleware = authorizeOwner('patientId');
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 403 if req.user.id does not match target param value', () => {
            const middleware = authorizeOwner('otherId');
            middleware(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should call next if req.user.role is ADMIN (bypass check)', () => {
            req.user = { id: 999, role: 'ADMIN' };
            const middleware = authorizeOwner('patientId');
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should call next if req.user.role is in whitelisted roles', () => {
            req.user = { id: 999, role: 'DOCTOR' };
            const middleware = authorizeOwner('patientId', { allowRoles: ['DOCTOR'] });
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should return 401 if user is not authenticated', () => {
            req.user = null;
            const middleware = authorizeOwner('patientId');
            middleware(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe('Decomposed Routes Integration', () => {
        let adminToken, patientToken, doctorToken;

        beforeAll(() => {
            adminToken = mintToken('ADMIN', 999);
            patientToken = mintToken('PATIENT', 1);
            doctorToken = mintToken('DOCTOR', 2);
        });

        it('GET /api/admin/departments resolves correctly via modular routes', async () => {
            jest.spyOn(db, 'query').mockResolvedValueOnce([[]]);
            const res = await request(app)
                .get('/api/admin/departments')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
        });

        it('GET /api/appointments/predict-duration resolves correctly via modular routes', async () => {
            const res = await request(app)
                .get('/api/appointments/predict-duration')
                .query({ doctorId: 1 })
                .set('Authorization', `Bearer ${patientToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('predictedDuration');
        });
    });
});
