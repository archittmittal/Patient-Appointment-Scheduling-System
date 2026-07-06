const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const { redactObject } = require('../src/middleware/requestLogger');
const { jwtSecret } = require('../src/middleware/authenticate');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

jest.mock('nodemailer');

// Mock database module
jest.mock('../src/config/db', () => {
    const mockQuery = jest.fn().mockImplementation((sql, params) => {
        const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
        if (upperSql.startsWith('SELECT')) {
            // Patient Profile
            if (upperSql.includes('FROM PATIENTS')) {
                return Promise.resolve([[{ id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' }], []]);
            }
            // Vitals
            if (upperSql.includes('PATIENT_VITALS')) {
                return Promise.resolve([[{ id: 10, weight_kg: 70, recorded_at: '2026-01-01' }], []]);
            }
            // Prescriptions
            if (upperSql.includes('PRESCRIPTIONS')) {
                return Promise.resolve([[{ id: 20, medications: 'Med A', date_prescribed: '2026-01-01' }], []]);
            }
            // Appointments
            if (upperSql.includes('APPOINTMENTS')) {
                return Promise.resolve([[{ id: 30, appointment_date: '2026-01-01', symptoms: 'Flu' }], []]);
            }
            // Consent logs
            if (upperSql.includes('CONSENT_LOGS')) {
                return Promise.resolve([[{ id: 40, status: 'GRANTED', created_at: '2026-01-01' }], []]);
            }
            return Promise.resolve([[{ id: 1 }], []]);
        }
        // Insert/Update/Delete results
        return Promise.resolve([{ affectedRows: 1, insertId: 1 }, []]);
    });

    return {
        query: mockQuery,
        getConnection: jest.fn()
    };
});

describe('Medical Data Privacy & Compliance Tests (PR #11)', () => {
    let patientToken;
    let otherPatientToken;
    let adminToken;
    const patientId = 1;
    const otherPatientId = 999;
    const adminId = 100;

    beforeAll(() => {
        patientToken = jwt.sign({ id: patientId, role: 'PATIENT' }, jwtSecret);
        otherPatientToken = jwt.sign({ id: otherPatientId, role: 'PATIENT' }, jwtSecret);
        adminToken = jwt.sign({ id: adminId, role: 'ADMIN' }, jwtSecret);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockClear();

        const mockQueryFn = (sql, params) => {
            const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
            if (upperSql.startsWith('SELECT')) {
                // Patient Profile
                if (upperSql.includes('FROM PATIENTS')) {
                    return Promise.resolve([[{ id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' }], []]);
                }
                // Vitals
                if (upperSql.includes('PATIENT_VITALS')) {
                    return Promise.resolve([[{ id: 10, weight_kg: 70, recorded_at: '2026-01-01' }], []]);
                }
                // Prescriptions
                if (upperSql.includes('PRESCRIPTIONS')) {
                    return Promise.resolve([[{ id: 20, medications: 'Med A', date_prescribed: '2026-01-01' }], []]);
                }
                // Appointments
                if (upperSql.includes('APPOINTMENTS')) {
                    return Promise.resolve([[{ id: 30, appointment_date: '2026-01-01', symptoms: 'Flu' }], []]);
                }
                // Consent logs
                if (upperSql.includes('CONSENT_LOGS')) {
                    return Promise.resolve([[{ id: 40, status: 'GRANTED', created_at: '2026-01-01' }], []]);
                }
                return Promise.resolve([[{ id: 1 }], []]);
            }
            // Insert/Update/Delete results
            return Promise.resolve([{ affectedRows: 1, insertId: 1 }, []]);
        };
        db.query.mockImplementation(mockQueryFn);

        // Setup mock connection for transactions
        const mockConn = {
            query: jest.fn().mockResolvedValue([[{ id: 1 }], []]),
            beginTransaction: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            release: jest.fn()
        };
        db.getConnection.mockResolvedValue(mockConn);
    });

    describe('PII Log Redaction Rules', () => {
        it('should redact sensitive clinical fields in payload', () => {
            const input = {
                symptoms: 'Sever headache and coughing',
                diagnosis: 'Migraine',
                prescription: 'Aspirin 100mg',
                medications: 'Ibuprofen',
                instructions: 'Take 2 pills daily',
                treatment: 'Physical therapy',
                medical_history: 'Hypertension',
                notes: 'Patient seems stressed',
                nonSensitiveField: 'Room 201'
            };

            const expected = {
                symptoms: '[REDACTED]',
                diagnosis: '[REDACTED]',
                prescription: '[REDACTED]',
                medications: '[REDACTED]',
                instructions: '[REDACTED]',
                treatment: '[REDACTED]',
                medical_history: '[REDACTED]',
                notes: '[REDACTED]',
                nonSensitiveField: 'Room 201'
            };

            expect(redactObject(input)).toEqual(expected);
        });

        it('should recursively redact clinical fields in nested objects', () => {
            const input = {
                appointment: {
                    details: {
                        symptoms: 'Fever',
                        diagnosis: 'Flu'
                    },
                    roomId: 5
                }
            };

            const expected = {
                appointment: {
                    details: {
                        symptoms: '[REDACTED]',
                        diagnosis: '[REDACTED]'
                    },
                    roomId: 5
                }
            };

            expect(redactObject(input)).toEqual(expected);
        });
    });

    describe('SMTP Configuration & Transactional Support', () => {
        const originalEnv = { ...process.env };

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        it('should configure custom SMTP settings when SMTP_HOST environment variable is present', () => {
            const mockCreateTransport = jest.fn().mockReturnValue({});
            nodemailer.createTransport = mockCreateTransport;

            process.env.SMTP_HOST = 'smtp.testmail.com';
            process.env.SMTP_PORT = '465';
            process.env.SMTP_SECURE = 'true';
            process.env.SMTP_USER = 'smtpuser';
            process.env.SMTP_PASS = 'smtppass';

            const emailServiceInstance = require('../src/services/emailService');
            const EmailServiceClass = emailServiceInstance.constructor;
            new EmailServiceClass();

            expect(mockCreateTransport).toHaveBeenCalledWith({
                host: 'smtp.testmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: 'smtpuser',
                    pass: 'smtppass'
                }
            });
        });

        it('should fallback to Gmail setup when SMTP_HOST is absent', () => {
            const mockCreateTransport = jest.fn().mockReturnValue({});
            nodemailer.createTransport = mockCreateTransport;

            delete process.env.SMTP_HOST;
            process.env.EMAIL_USER = 'gmailuser@gmail.com';
            process.env.EMAIL_PASS = 'gmailpass';

            const emailServiceInstance = require('../src/services/emailService');
            const EmailServiceClass = emailServiceInstance.constructor;
            new EmailServiceClass();

            expect(mockCreateTransport).toHaveBeenCalledWith({
                service: 'gmail',
                auth: {
                    user: 'gmailuser@gmail.com',
                    pass: 'gmailpass'
                }
            });
        });
    });

    describe('Patient Data Export (GET /api/patients/:id/data-export)', () => {
        it('should return 200 with JSON file containing all clinical records for patient themselves', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/data-export`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/json');
            expect(res.body).toHaveProperty('profile');
            expect(res.body).toHaveProperty('appointments');
            expect(res.body).toHaveProperty('prescriptions');
            expect(res.body).toHaveProperty('vitals');
            expect(res.body).toHaveProperty('consentLogs');
        });

        it('should return 200 with CSV file when format=csv is queried', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/data-export?format=csv`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text).toContain('patient_first_name');
            expect(res.text).toContain('patient_email');
        });

        it('should allow admin to export data for any patient', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/data-export`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
        });

        it('should deny access (403) to other patients', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/data-export`)
                .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Patient Account Erasure (DELETE /api/patients/:id/data)', () => {
        it('should perform all deletion queries within a transaction block for patient themselves', async () => {
            const mockConn = await db.getConnection();

            const res = await request(app)
                .delete(`/api/patients/${patientId}/data`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('erased successfully');

            // Verify transaction steps
            expect(mockConn.beginTransaction).toHaveBeenCalled();
            expect(mockConn.commit).toHaveBeenCalled();
            expect(mockConn.release).toHaveBeenCalled();

            // Verify deletion targets
            const deleteCalls = mockConn.query.mock.calls.filter(
                call => typeof call[0] === 'string' && call[0].trim().toUpperCase().startsWith('DELETE')
            );

            expect(deleteCalls.some(call => call[0].includes('patient_vitals'))).toBe(true);
            expect(deleteCalls.some(call => call[0].includes('prescriptions'))).toBe(true);
            expect(deleteCalls.some(call => call[0].includes('notification_log'))).toBe(true);
            expect(deleteCalls.some(call => call[0].includes('consultation_history'))).toBe(true);
            expect(deleteCalls.some(call => call[0].includes('messages'))).toBe(true);
            expect(deleteCalls.some(call => call[0].includes('payment_transactions'))).toBe(true);
            expect(deleteCalls.some(call => call[0].includes('users'))).toBe(true);
        });

        it('should allow admin to erase a patient account', async () => {
            const res = await request(app)
                .delete(`/api/patients/${patientId}/data`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
        });

        it('should deny erasure (403) to other patients', async () => {
            const res = await request(app)
                .delete(`/api/patients/${patientId}/data`)
                .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(res.statusCode).toBe(403);
        });
    });
});
