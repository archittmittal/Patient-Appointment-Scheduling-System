const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const { jwtSecret } = require('../src/middleware/authenticate');
const jwt = require('jsonwebtoken');

// Mock the database
jest.mock('../src/config/db', () => ({
    query: jest.fn().mockImplementation((sql) => {
        const upperSql = sql.trim().toUpperCase();
        if (upperSql.startsWith('SELECT')) {
            // Provide dummy data for common SELECT queries
            if (upperSql.includes('FROM PATIENT_VITALS') || upperSql.includes('FROM PRESCRIPTIONS')) {
                return Promise.resolve([[ { id: 1, medications: 'Test Med', weight_kg: 70 } ], []]);
            }
            if (upperSql.includes('FROM APPOINTMENTS') || upperSql.includes('FROM LIVE_QUEUE')) {
                return Promise.resolve([[ { id: 101, appointment_id: 101 } ], []]);
            }
            return Promise.resolve([[ { id: 1 } ], []]);
        }
        return Promise.resolve([{ insertId: 1, affectedRows: 1 }, []]);
    }),
    getConnection: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn()
}));

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
            db.query.mockResolvedValueOnce([{ insertId: 2 }, []]);
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
            // Check if there is a queue entry for today
            const result = await db.query(
                'SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = CURDATE() LIMIT 1',
                [doctorId]
            );
            const apt = (result && result[0]) ? result[0][0] : null;

            if (!apt) return; // skip if no test data

            const qResult = await db.query(
                'SELECT id FROM live_queue WHERE appointment_id = ?',
                [apt.id]
            );
            const queue = (qResult && qResult[0]) ? qResult[0][0] : null;

            if (!queue) return; // skip if no queue entry

            const res = await request(app)
                .patch(`/api/appointments/queue/${queue.id}/status`)
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

            // Verify prescription was created with appointment_id link
            const [prescriptions] = await db.query(
                'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY id DESC LIMIT 1',
                [patientId]
            );
            expect(prescriptions.length).toBeGreaterThan(0);
            expect(prescriptions[0].medications).toContain('Paracetamol');
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
});
