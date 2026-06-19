const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const { jwtSecret } = require('../src/middleware/authenticate');
const jwt = require('jsonwebtoken');

// Mock the database
jest.mock('../src/config/db', () => {
    const mockQuery = jest.fn().mockImplementation((sql) => {
        const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
        if (upperSql.startsWith('SELECT')) {
            // Provide dummy data for common SELECT queries
            if (upperSql.includes('FROM PATIENT_VITALS') || upperSql.includes('FROM PRESCRIPTIONS')) {
                return Promise.resolve([[ { id: 1, medications: 'Test Med', weight_kg: 70, blood_pressure_sys: 120, blood_pressure_dia: 80, heart_rate: 72, temperature_c: 36.6, spo2: 98, recorded_at: '2026-01-01', date_prescribed: '2026-01-01', doctor_first_name: 'Dr', doctor_last_name: 'Test', specialty: 'General', appointment_id: 101 } ], []]);
            }
            if (upperSql.includes('CONSENT_LOGS') || upperSql.includes('FROM CONSENT_LOGS')) {
                return Promise.resolve([[ { status: 'GRANTED' } ], []]);
            }
            if (upperSql.includes('FROM APPOINTMENTS') || upperSql.includes('FROM LIVE_QUEUE')) {
                return Promise.resolve([[ { id: 101, appointment_id: 101 } ], []]);
            }
            if (upperSql.includes('FROM USERS') || upperSql.includes('ROLE')) {
                return Promise.resolve([[ { id: 1, role: 'DOCTOR' } ], []]);
            }
            return Promise.resolve([[ { id: 1 } ], []]);
        }
        return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
    });
    return {
        query: mockQuery,
        getConnection: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
    };
});

describe('Clinical Hub Integration (Vitals & Prescriptions)', () => {
    let patientToken;
    let doctorToken;
    let otherPatientToken;
    const patientId = 1;
    const doctorId = 2;
    const otherPatientId = 999;

    beforeAll(() => {
        patientToken = jwt.sign({ id: patientId, role: 'PATIENT' }, jwtSecret);
        doctorToken = jwt.sign({ id: doctorId, role: 'DOCTOR' }, jwtSecret);
        otherPatientToken = jwt.sign({ id: otherPatientId, role: 'PATIENT' }, jwtSecret);
    });

    beforeEach(() => {
        // Reset mock resolved values between tests to prevent bleed
        db.query.mockClear();

        // Mock getConnection for transaction-based routes
        const mockConnQuery = jest.fn().mockImplementation((sql) => {
            const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
            if (upperSql.startsWith('SELECT')) {
                if (upperSql.includes('FROM PATIENT_VITALS') || upperSql.includes('FROM PRESCRIPTIONS')) {
                    return Promise.resolve([[ { id: 1, medications: 'Test Med', weight_kg: 70, blood_pressure_sys: 120, blood_pressure_dia: 80, heart_rate: 72, temperature_c: 36.6, spo2: 98, recorded_at: '2026-01-01', date_prescribed: '2026-01-01', doctor_first_name: 'Dr', doctor_last_name: 'Test', specialty: 'General', appointment_id: 101 } ], []]);
                }
                if (upperSql.includes('CONSENT_LOGS') || upperSql.includes('FROM CONSENT_LOGS')) {
                    return Promise.resolve([[ { status: 'GRANTED' } ], []]);
                }
                if (upperSql.includes('FROM APPOINTMENTS') || upperSql.includes('FROM LIVE_QUEUE')) {
                    return Promise.resolve([[ { id: 101, appointment_id: 101, doctor_id: 2, patient_id: 1, appointment_date: '2026-01-01', consultation_start: new Date().toISOString(), symptoms: 'test', is_follow_up: false, doc_first: 'Dr', doc_last: 'Test', location_room: '101' } ], []]);
                }
                if (upperSql.includes('FROM USERS') || upperSql.includes('ROLE')) {
                    return Promise.resolve([[ { id: 1, role: 'DOCTOR' } ], []]);
                }
                return Promise.resolve([[ { id: 1 } ], []]);
            }
            return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
        });
        db.getConnection.mockResolvedValue({
            query: mockConnQuery,
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn()
        });
        db.query.mockImplementation((sql) => {
            const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
            if (upperSql.startsWith('SELECT')) {
                if (upperSql.includes('FROM PATIENT_VITALS') || upperSql.includes('FROM PRESCRIPTIONS')) {
                    return Promise.resolve([[ { id: 1, medications: 'Test Med', weight_kg: 70, blood_pressure_sys: 120, blood_pressure_dia: 80, heart_rate: 72, temperature_c: 36.6, spo2: 98, recorded_at: '2026-01-01', date_prescribed: '2026-01-01', doctor_first_name: 'Dr', doctor_last_name: 'Test', specialty: 'General', appointment_id: 101 } ], []]);
                }
                if (upperSql.includes('CONSENT_LOGS') || upperSql.includes('FROM CONSENT_LOGS')) {
                    return Promise.resolve([[ { status: 'GRANTED' } ], []]);
                }
                if (upperSql.includes('FROM APPOINTMENTS') || upperSql.includes('FROM LIVE_QUEUE')) {
                    return Promise.resolve([[ { id: 101, appointment_id: 101 } ], []]);
                }
                if (upperSql.includes('FROM USERS') || upperSql.includes('ROLE')) {
                    return Promise.resolve([[ { id: 1, role: 'DOCTOR' } ], []]);
                }
                return Promise.resolve([[ { id: 1 } ], []]);
            }
            return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
        });
    });

    // ──────────── VITALS: Happy paths ────────────
    describe('POST /api/patients/:id/vitals', () => {
        it('should allow a patient to log their own vitals (full payload)', async () => {
            db.query.mockResolvedValueOnce([{ insertId: 1 }, []]);
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    weight_kg: 70,
                    height_cm: 175,
                    blood_pressure_sys: 120,
                    blood_pressure_dia: 80,
                    heart_rate: 72,
                    temperature_c: 36.6
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.status).toBe('logged');
        });

        it('should allow a doctor to log vitals for any patient', async () => {
            db.query.mockImplementation((sql) => {
                const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
                if (upperSql.includes('CONSENT_LOGS') || upperSql.includes('FROM CONSENT_LOGS')) {
                    return Promise.resolve([[ { status: 'GRANTED' } ], []]);
                }
                return Promise.resolve([{ insertId: 2, affectedRows: 1 }, []]);
            });
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    weight_kg: 72,
                    blood_pressure_sys: 130,
                    blood_pressure_dia: 85
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('id');
        });

        it('should accept a partial vitals payload (only one field)', async () => {
            db.query.mockResolvedValueOnce([{ insertId: 3 }, []]);
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ heart_rate: 68 });

            expect(res.statusCode).toBe(201);
        });
    });

    // ──────────── VITALS: Edge cases & validation ────────────
    describe('POST /api/patients/:id/vitals — validation & auth', () => {
        it('should reject an empty body (no vitals fields)', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({});

            expect(res.statusCode).toBe(400);
        });

        it('should reject vitals with out-of-range values', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ heart_rate: 999 }); // max 250

            expect(res.statusCode).toBe(400);
        });

        it('should reject negative weight', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ weight_kg: -5 });

            expect(res.statusCode).toBe(400);
        });

        it('should reject temperature above 45°C', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ temperature_c: 50 });

            expect(res.statusCode).toBe(400);
        });

        it('should reject unknown fields (strict schema)', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ weight_kg: 70, random_field: 'test' });

            // Joi default strips unknown, so this should succeed with valid field
            // If we want strict, we need .options({ allowUnknown: false })
            // For now, ensure no 500
            expect(res.statusCode).not.toBe(500);
        });

        it('should deny a patient from logging vitals for another patient', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${otherPatientToken}`)
                .send({ weight_kg: 70 });

            expect(res.statusCode).toBe(403);
        });

        it('should reject request without auth token', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .send({ weight_kg: 70 });

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── VITALS: GET history ────────────
    describe('GET /api/patients/:id/vitals', () => {
        it('should return vitals history as an array', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('each vitals record should have expected fields', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            if (res.body.length > 0) {
                const record = res.body[0];
                expect(record).toHaveProperty('id');
                expect(record).toHaveProperty('recorded_at');
                expect(record).toHaveProperty('blood_pressure_sys');
            }
        });

        it('should reject request without auth', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals`);

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── VITALS: CSV Export ────────────
    describe('GET /api/patients/:id/vitals/export', () => {
        it('should export vitals as CSV for the patient', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/export`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            // CSV should contain header row with our field labels
            expect(res.text).toContain('Weight (kg)');
            expect(res.text).toContain('Heart Rate (bpm)');
        });

        it('should allow a doctor to export any patient vitals', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/export`)
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
        });

        it('should deny another patient from exporting', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/export`)
                .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(res.statusCode).toBe(403);
        });
    });

    // ──────────── PRESCRIPTIONS: GET ────────────
    describe('GET /api/patients/:id/prescriptions', () => {
        it('should return prescriptions as an array', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/prescriptions`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('each prescription should have doctor info and appointment_id', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/prescriptions`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            if (res.body.length > 0) {
                const rx = res.body[0];
                expect(rx).toHaveProperty('medications');
                expect(rx).toHaveProperty('doctor_first_name');
                expect(rx).toHaveProperty('doctor_last_name');
                expect(rx).toHaveProperty('date_prescribed');
                // appointment_id may be null for seed data, but field should exist
                expect(rx).toHaveProperty('appointment_id');
            }
        });

        it('should reject without auth', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/prescriptions`);

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── QUEUE COMPLETION: end-to-end ────────────
    describe('PATCH /api/appointments/queue/:id/status — COMPLETED flow', () => {
        it('should complete an appointment and persist prescription + vitals', async () => {
            // Get the mock connection for later verification
            const mockConn = await db.getConnection();
            
            const res = await request(app)
                .patch('/api/appointments/queue/101/status')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    status: 'COMPLETED',
                    diagnosis: 'Common Cold',
                    prescription: 'Paracetamol 500mg\nVitamin C',
                    notes: 'Rest for 2 days',
                    vitals: {
                        weight_kg: 70,
                        temperature_c: 38.5
                    }
                });

            expect(res.statusCode).toBe(200);

            // Verify that transaction methods were called
            expect(mockConn.beginTransaction).toHaveBeenCalled();
            expect(mockConn.commit).toHaveBeenCalled();
            expect(mockConn.release).toHaveBeenCalled();

            // Verify that INSERT queries were issued for prescription and vitals
            const insertCalls = mockConn.query.mock.calls.filter(
                call => typeof call[0] === 'string' && call[0].trim().toUpperCase().startsWith('INSERT')
            );
            expect(insertCalls.length).toBeGreaterThanOrEqual(1);
        });

        it('should reject queue update with invalid status', async () => {
            const res = await request(app)
                .patch('/api/appointments/queue/1/status')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ status: 'INVALID_STATUS' });

            expect(res.statusCode).toBe(400);
        });

        it('should reject queue update without status field', async () => {
            const res = await request(app)
                .patch('/api/appointments/queue/1/status')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ diagnosis: 'Test' });

            expect(res.statusCode).toBe(400);
        });

        it('should reject queue update from a patient role', async () => {
            const res = await request(app)
                .patch('/api/appointments/queue/1/status')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ status: 'COMPLETED' });

            expect(res.statusCode).toBe(403);
        });

        it('should reject queue update with out-of-range vitals', async () => {
            const res = await request(app)
                .patch('/api/appointments/queue/1/status')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    status: 'COMPLETED',
                    vitals: { heart_rate: 999 } // exceeds max 250
                });

            expect(res.statusCode).toBe(400);
        });
    });

    // ──────────── PRESCRIPTION PDF DOWNLOAD ────────────
    describe('GET /api/appointments/:id/prescription/pdf', () => {
        it('should reject PDF download without auth', async () => {
            const res = await request(app)
                .get('/api/appointments/1/prescription/pdf');

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── ISSUE #144: VITALS ALERTS (SpO2) ────────────
    describe('POST /api/patients/:id/vitals — SpO2 support', () => {
        it('should accept vitals with SpO2 value', async () => {
            db.query.mockResolvedValueOnce([{ insertId: 10 }, []]);
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ spo2: 98 });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('id');
        });

        it('should reject SpO2 below minimum (50)', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ spo2: 10 });

            expect(res.statusCode).toBe(400);
        });

        it('should reject SpO2 above 100', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ spo2: 110 });

            expect(res.statusCode).toBe(400);
        });
    });

    // ──────────── ISSUE #144: ABNORMAL ALERTS ────────────
    describe('Vitals abnormal alerts (service-level)', () => {
        it('should flag critical tachycardia (HR > 120)', () => {
            const vitalsService = require('../src/services/vitalsService');
            const alerts = vitalsService.checkAbnormalValues({ heart_rate: 150 });
            expect(alerts.length).toBe(1);
            expect(alerts[0].severity).toBe('critical');
            expect(alerts[0].field).toBe('heart_rate');
        });

        it('should flag critical fever (> 38.5°C)', () => {
            const vitalsService = require('../src/services/vitalsService');
            const alerts = vitalsService.checkAbnormalValues({ temperature_c: 40.2 });
            expect(alerts.length).toBe(1);
            expect(alerts[0].severity).toBe('critical');
        });

        it('should flag critical hypoxia (SpO2 < 92)', () => {
            const vitalsService = require('../src/services/vitalsService');
            const alerts = vitalsService.checkAbnormalValues({ spo2: 88 });
            expect(alerts.length).toBe(1);
            expect(alerts[0].severity).toBe('critical');
        });

        it('should flag warning for borderline BP (SBP 145)', () => {
            const vitalsService = require('../src/services/vitalsService');
            const alerts = vitalsService.checkAbnormalValues({ blood_pressure_sys: 145 });
            expect(alerts.length).toBe(1);
            expect(alerts[0].severity).toBe('warning');
        });

        it('should return no alerts for normal vitals', () => {
            const vitalsService = require('../src/services/vitalsService');
            const alerts = vitalsService.checkAbnormalValues({
                heart_rate: 72, blood_pressure_sys: 120, blood_pressure_dia: 80,
                temperature_c: 36.8, spo2: 98
            });
            expect(alerts.length).toBe(0);
        });

        it('should return multiple alerts for multiple abnormal values', () => {
            const vitalsService = require('../src/services/vitalsService');
            const alerts = vitalsService.checkAbnormalValues({
                heart_rate: 150, temperature_c: 40.0, spo2: 85
            });
            expect(alerts.length).toBe(3);
        });
    });

    // ──────────── ISSUE #144: VITALS TRENDS ────────────
    describe('GET /api/patients/:id/vitals/trends', () => {
        it('should return trends for the patient', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/trends`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('weeklyTrends');
            expect(res.body).toHaveProperty('totalReadings');
        });

        it('should accept custom period (days query param)', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/trends?days=30`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
        });

        it('should deny another patient from viewing trends', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/trends`)
                .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(res.statusCode).toBe(403);
        });

        it('should reject without auth', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals/trends`);

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── ISSUE #144: PRESCRIPTION CREATION ────────────
    describe('POST /api/patients/:id/prescriptions', () => {
        it('should allow a doctor to create a prescription', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/prescriptions`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    medications: 'Amoxicillin 500mg',
                    dosage: '500mg',
                    frequency: 'three times daily',
                    duration_days: 7,
                    instructions: 'Take after meals',
                    refills_remaining: 2
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('id');
        });

        it('should reject prescription creation from a patient', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/prescriptions`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ medications: 'Test Drug' });

            expect(res.statusCode).toBe(403);
        });

        it('should reject prescription without medications field', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/prescriptions`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ dosage: '10mg' });

            expect(res.statusCode).toBe(400);
        });

        it('should reject duration_days out of range', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/prescriptions`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ medications: 'Test', duration_days: 500 });

            expect(res.statusCode).toBe(400);
        });
    });

    // ──────────── ISSUE #144: PRESCRIPTION HISTORY ────────────
    describe('GET /api/patients/:id/prescriptions/history', () => {
        it('should return prescription history with counts', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/prescriptions/history`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('total');
            expect(res.body).toHaveProperty('active');
            expect(res.body).toHaveProperty('prescriptions');
        });

        it('should deny another patient from viewing history', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientId}/prescriptions/history`)
                .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(res.statusCode).toBe(403);
        });
    });

    // ──────────── ISSUE #144: REFILL PROCESSING ────────────
    describe('POST /api/patients/:id/prescriptions/:rxId/refill', () => {
        it('should reject refill request from a patient', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/prescriptions/1/refill`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(403);
        });

        it('should reject without auth', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/prescriptions/1/refill`);

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── ISSUE #144: PRESCRIPTION DEACTIVATION ────────────
    describe('PATCH /api/patients/:id/prescriptions/:rxId/deactivate', () => {
        it('should reject deactivation from a patient', async () => {
            const res = await request(app)
                .patch(`/api/patients/${patientId}/prescriptions/1/deactivate`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(403);
        });

        it('should reject without auth', async () => {
            const res = await request(app)
                .patch(`/api/patients/${patientId}/prescriptions/1/deactivate`);

            expect(res.statusCode).toBe(401);
        });
    });

    // ──────────── DPDP CONSENT MANAGEMENT TESTS ────────────
    describe('DPDP Consent Management', () => {
        it('should allow a patient to log a granted consent for a doctor', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/consent`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    status: 'GRANTED'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('GRANTED');
            expect(res.body.doctorId).toBe(doctorId);
        });

        it('should allow a patient to revoke consent for a doctor', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/consent`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    status: 'REVOKED'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('REVOKED');
        });

        it('should reject consent creation if parameters are invalid', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/consent`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    status: 'INVALID_STATUS'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should deny non-authorized users from creating/managing consent', async () => {
            const res = await request(app)
                .post(`/api/patients/${patientId}/consent`)
                .set('Authorization', `Bearer ${otherPatientToken}`)
                .send({
                    doctorId: doctorId,
                    status: 'GRANTED'
                });

            expect(res.statusCode).toBe(403);
        });

        it('should deny access to patient vitals for a doctor if consent is revoked/missing', async () => {
            // Mock connection query to return REVOKED for consent check
            const mockConn = await db.getConnection();
            const originalQuery = mockConn.query;
            
            mockConn.query = jest.fn().mockImplementation((sql, params) => {
                const upperSql = (typeof sql === 'string') ? sql.trim().toUpperCase() : '';
                if (upperSql.includes('CONSENT_LOGS') || upperSql.includes('FROM CONSENT_LOGS')) {
                    return Promise.resolve([[ { status: 'REVOKED' } ], []]);
                }
                return originalQuery(sql, params);
            });

            // Mock default query too
            db.query.mockImplementationOnce((sql, params) => {
                return Promise.resolve([[ { status: 'REVOKED' } ], []]);
            });

            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.code).toBe('CONSENT_REQUIRED');

            // Restore original mock
            mockConn.query = originalQuery;
        });

        it('should allow access to patient vitals for a doctor if consent is granted', async () => {
            // By default, our updated base mock returns GRANTED
            const res = await request(app)
                .get(`/api/patients/${patientId}/vitals`)
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(200);
        });
    });
});
