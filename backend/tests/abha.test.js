const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/middleware/authenticate');
const abhaService = require('../src/services/abhaService');

// Mock the database
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    getConnection: jest.fn(() => Promise.resolve({
        query: jest.fn(),
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn()
    }))
}));

describe('ABHA Integration Foundations', () => {
    let patientToken;
    let otherPatientToken;
    const patientId = 1;
    const otherPatientId = 999;

    beforeAll(() => {
        patientToken = jwt.sign({ id: patientId, role: 'PATIENT' }, jwtSecret);
        otherPatientToken = jwt.sign({ id: otherPatientId, role: 'PATIENT' }, jwtSecret);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('ABHA Service Validation Tests', () => {
        it('should validate valid ABHA Numbers', () => {
            expect(abhaService.validateAbhaNumber('12-3456-7890-1234')).toBe(true);
            expect(abhaService.validateAbhaNumber('12345678901234')).toBe(true);
        });

        it('should reject invalid ABHA Numbers', () => {
            expect(abhaService.validateAbhaNumber('12-3456789-01234')).toBe(false); // bad hyphen spacing
            expect(abhaService.validateAbhaNumber('12345')).toBe(false); // too short
            expect(abhaService.validateAbhaNumber('123456789012345')).toBe(false); // too long
            expect(abhaService.validateAbhaNumber('1234567890123a')).toBe(false); // non-digits
        });

        it('should validate valid ABHA Addresses (IDs)', () => {
            expect(abhaService.validateAbhaAddress('john.doe@abdm')).toBe(true);
            expect(abhaService.validateAbhaAddress('patient_123@sbx')).toBe(true);
            expect(abhaService.validateAbhaAddress('health.user@ndhm')).toBe(true);
        });

        it('should reject invalid ABHA Addresses (IDs)', () => {
            expect(abhaService.validateAbhaAddress('john.doe@gmail.com')).toBe(false); // wrong domain
            expect(abhaService.validateAbhaAddress('john.doe')).toBe(false); // no domain
            expect(abhaService.validateAbhaAddress('@abdm')).toBe(false); // missing username
        });
    });

    describe('POST /api/auth/abha/verify', () => {
        it('should verify a valid format successfully', async () => {
            const res = await request(app)
                .post('/api/auth/abha/verify')
                .send({
                    abhaId: 'john@abdm',
                    abhaNumber: '12-3456-7890-1234'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.verified).toBe(true);
        });

        it('should fail with 400 if formats are invalid', async () => {
            const res = await request(app)
                .post('/api/auth/abha/verify')
                .send({
                    abhaId: 'invalid-id'
                });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/auth/register with ABHA fields', () => {
        it('should register a patient and save ABHA details', async () => {
            const conn = {
                query: jest.fn()
                    .mockResolvedValueOnce([[]]) // Check existing email
                    .mockResolvedValueOnce([{ insertId: 101 }]) // Insert user
                    .mockResolvedValueOnce([{ affectedRows: 1 }]), // Insert patient
                beginTransaction: jest.fn().mockResolvedValue(),
                commit: jest.fn().mockResolvedValue(),
                rollback: jest.fn().mockResolvedValue(),
                release: jest.fn()
            };
            db.getConnection.mockResolvedValueOnce(conn);

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'abha.patient@example.com',
                    password: 'Password123',
                    first_name: 'Abha',
                    last_name: 'Patient',
                    phone: '1234567890',
                    abha_id: 'patient@abdm',
                    abha_number: '12-3456-7890-1234'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('abha_id', 'patient@abdm');
            expect(res.body).toHaveProperty('abha_number', '12-3456-7890-1234');
            expect(conn.commit).toHaveBeenCalled();
        });

        it('should reject registration if ABHA formats are invalid', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'invalid.abha@example.com',
                    password: 'Password123',
                    first_name: 'Abha',
                    last_name: 'Patient',
                    phone: '1234567890',
                    abha_id: 'bad_id'
                });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/patients/:id/abha (Linking)', () => {
        it('should allow a patient to link ABHA details successfully', async () => {
            db.query
                .mockResolvedValueOnce([[ { id: patientId } ]]) // check patient exists
                .mockResolvedValueOnce([{ affectedRows: 1 }]); // update query

            const res = await request(app)
                .post(`/api/patients/${patientId}/abha`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    abhaId: 'link@abdm',
                    abhaNumber: '12-3456-7890-1234'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('linked successfully');
            expect(res.body.abhaId).toBe('link@abdm');
        });

        it('should prevent linking by another patient', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/abha`)
                .set('Authorization', `Bearer ${otherPatientToken}`)
                .send({
                    abhaId: 'link@abdm'
                });

            expect(res.statusCode).toBe(403);
        });

        it('should handle duplicate ABHA entries with 409 Conflict', async () => {
            db.query
                .mockResolvedValueOnce([[ { id: patientId } ]]) // check patient exists
                .mockRejectedValueOnce({
                    code: 'ER_DUP_ENTRY',
                    message: "Duplicate entry 'link@abdm' for key 'patients.abha_id'"
                });

            const res = await request(app)
                .post(`/api/patients/${patientId}/abha`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    abhaId: 'link@abdm'
                });

            expect(res.statusCode).toBe(409);
            expect(res.body.message).toContain('already linked');
        });
    });

    describe('GET /api/patients/:id profile retrieval', () => {
        it('should return ABHA details in profile payload', async () => {
            db.query.mockResolvedValueOnce([[ {
                id: patientId,
                first_name: 'John',
                last_name: 'Doe',
                email: 'test@example.com',
                role: 'PATIENT',
                abha_id: 'john@abdm',
                abha_number: '12-3456-7890-1234'
            } ]]);

            const res = await request(app)
                .get(`/api/patients/${patientId}`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('abha_id', 'john@abdm');
            expect(res.body).toHaveProperty('abha_number', '12-3456-7890-1234');
        });
    });
});
