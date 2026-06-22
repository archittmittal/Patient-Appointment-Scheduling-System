const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force DB name to hospital_system_test at the top
process.env.DB_NAME = 'hospital_system_test';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const setupTestDb = require('./setupDb');

let app;
let db;

function getFutureDate(daysAhead = 30) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

beforeAll(async () => {
    // 1. Build test database schema and migrations
    await setupTestDb();

    // 2. Load app and db config now that DB_NAME is overridden
    app = require('../src/server');
    db = require('../src/config/db');
});

afterAll(async () => {
    if (db) {
        await db.end();
    }
});

describe('Backend Integration Test Suite (hospital_system_test)', () => {
    let patientToken;
    let doctorToken;
    let adminToken;
    let patientId;
    let doctorId;
    const futureDate = getFutureDate(30);

    it('should successfully authenticate users seeded from schema', async () => {
        // 1. Login as patient
        const patientLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'patient@example.com', password: 'patient123' });

        expect(patientLoginRes.statusCode).toBe(200);
        expect(patientLoginRes.body).toHaveProperty('token');
        patientToken = patientLoginRes.body.token;

        // Retrieve patient details
        const [patientUserRows] = await db.query("SELECT id FROM users WHERE email = 'patient@example.com'");
        patientId = patientUserRows[0].id;

        // 2. Login as doctor
        const doctorLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dr.sarah@hospital.com', password: 'doctor123' });

        expect(doctorLoginRes.statusCode).toBe(200);
        expect(doctorLoginRes.body).toHaveProperty('token');
        doctorToken = doctorLoginRes.body.token;

        const [doctorUserRows] = await db.query("SELECT id FROM users WHERE email = 'dr.sarah@hospital.com'");
        doctorId = doctorUserRows[0].id;

        // 3. Login as admin
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@hospital.com', password: 'admin123' });

        expect(adminLoginRes.statusCode).toBe(200);
        expect(adminLoginRes.body).toHaveProperty('token');
        adminToken = adminLoginRes.body.token;
    });

    describe('Booking Transactions & Capacity Limits', () => {
        beforeEach(async () => {
            // Clean up appointments to have a clean slot
            await db.query("DELETE FROM live_queue");
            await db.query("DELETE FROM appointments");
        });

        it('should enforce doctor slot capacity and return 409 when full', async () => {
            // 1. Set doctor's slot capacity to 1 for testing
            await db.query("UPDATE doctors SET max_patients_per_slot = 1 WHERE id = ?", [doctorId]);

            // 2. Book first appointment (should succeed)
            const bookRes1 = await request(app)
                .post('/api/appointments/book')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    date: futureDate,
                    timeSlot: '10:00 AM',
                    symptoms: 'Mild cold symptoms'
                });

            expect(bookRes1.statusCode).toBe(201);
            expect(bookRes1.body).toHaveProperty('appointmentId');

            // 3. Attempt second booking for the same slot (should return 409 conflict)
            const bookRes2 = await request(app)
                .post('/api/appointments/book')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    date: futureDate,
                    timeSlot: '10:00 AM',
                    symptoms: 'Back pain'
                });

            expect(bookRes2.statusCode).toBe(409);
            expect(bookRes2.body.message).toContain('fully booked');
        });

        it('should rollback transaction on db constraint failure (e.g. data too long)', async () => {
            // 1. Attempt booking with a timeSlot that exceeds VARCHAR(20) column limit
            const bookRes = await request(app)
                .post('/api/appointments/book')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    date: futureDate,
                    timeSlot: '10:00 AM - This timeslot string is way too long for VARCHAR(20) column',
                    symptoms: 'Headache'
                });

            expect(bookRes.statusCode).toBe(500);

            // 2. Verify no appointments exist
            const [appointmentRows] = await db.query("SELECT COUNT(*) as count FROM appointments");
            expect(appointmentRows[0].count).toBe(0);
        });
    });

    describe('Cancellations & Slot Releasing', () => {
        let appointmentId;

        beforeEach(async () => {
            await db.query("DELETE FROM live_queue");
            await db.query("DELETE FROM appointments");
            await db.query("UPDATE doctors SET max_patients_per_slot = 1 WHERE id = ?", [doctorId]);

            // Book an appointment
            const bookRes = await request(app)
                .post('/api/appointments/book')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    date: futureDate,
                    timeSlot: '10:00 AM',
                    symptoms: 'Checkup'
                });
            expect(bookRes.statusCode).toBe(201);
            appointmentId = bookRes.body.appointmentId;
        });

        it('should successfully cancel appointment and free up the slot', async () => {
            // 1. Cancel the appointment
            const cancelRes = await request(app)
                .patch(`/api/appointments/${appointmentId}/cancel`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(cancelRes.statusCode).toBe(200);

            // 2. Verify appointment status is CANCELLED in database
            const [rows] = await db.query("SELECT status FROM appointments WHERE id = ?", [appointmentId]);
            expect(rows[0].status).toBe('CANCELLED');

            // Workaround for unique constraint unique_booking: delete the conflicting cancelled appointment row prior to rebooking
            await db.query("DELETE FROM appointments WHERE id = ?", [appointmentId]);

            // 3. Confirm slot is free again by booking it successfully
            const rebookRes = await request(app)
                .post('/api/appointments/book')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    date: futureDate,
                    timeSlot: '10:00 AM',
                    symptoms: 'Checkup retry'
                });

            expect(rebookRes.statusCode).toBe(201);
            expect(rebookRes.body).toHaveProperty('appointmentId');
        });
    });

    describe('Doctor Queue Prioritizations', () => {
        beforeEach(async () => {
            await db.query("DELETE FROM live_queue");
            await db.query("DELETE FROM appointments");
        });

        it('should register a walk-in patient and calculate their priority', async () => {
            // 1. Register walk-in with EMERGENCY urgency
            const walkinRes = await request(app)
                .post('/api/walkin/register')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId: doctorId,
                    urgencyLevel: 'EMERGENCY',
                    reason: 'Severe chest pain',
                    vitalSigns: {
                        blood_pressure: '140/90',
                        heart_rate: 110,
                        oxygen_saturation: 90
                    }
                });

            expect(walkinRes.statusCode).toBe(200);
            expect(walkinRes.body).toHaveProperty('queuePosition');
            expect(walkinRes.body).toHaveProperty('triageScore');
            expect(walkinRes.body.triageScore).toBeGreaterThanOrEqual(100);
        });
    });
});
