const request = require('supertest');
const jwt = require('jsonwebtoken');

// Hoist mocks
jest.mock('../src/config/db', () => ({
    query: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/db');
const { jwtSecret } = require('../src/middleware/authenticate');

describe('Prescription PDF Download Endpoint — GET /api/appointments/:id/prescription/pdf', () => {
    const patientToken = jwt.sign({ id: 10, role: 'PATIENT' }, jwtSecret);
    const doctorToken = jwt.sign({ id: 20, role: 'DOCTOR' }, jwtSecret);
    const adminToken = jwt.sign({ id: 30, role: 'ADMIN' }, jwtSecret);
    const wrongPatientToken = jwt.sign({ id: 99, role: 'PATIENT' }, jwtSecret);
    const wrongDoctorToken = jwt.sign({ id: 88, role: 'DOCTOR' }, jwtSecret);

    const mockAppointmentDetails = {
        appointment_id: 1,
        appointment_date: '2026-07-13',
        prescription: 'Amoxicillin 500mg\nParacetamol 650mg',
        diagnosis: 'Mild Fever & Upper Respiratory Tract Infection',
        notes: 'Rest and stay hydrated.',
        follow_up_date: '2026-07-20',
        symptoms: 'Fever and cough',
        patient_id: 10,
        patient_first: 'John',
        patient_last: 'Doe',
        patient_dob: '1990-05-15',
        patient_phone: '+919999999999',
        patient_blood_group: 'O+',
        abha_number: '12-3456-7890-1234',
        doctor_id: 20,
        doctor_first: 'Sarah',
        doctor_last: 'Jenkins',
        doctor_specialty: 'Cardiology',
        location_room: 'Room 101',
        blood_pressure: '120/80',
        heart_rate: 72,
        temperature: 37,
        spo2: 98,
        weight_kg: 70
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if request is unauthorized', async () => {
        const res = await request(app)
            .get('/api/appointments/1/prescription/pdf');
        expect(res.status).toBe(401);
    });

    it('should return 404 if appointment does not exist', async () => {
        db.query.mockResolvedValue([[]]); // empty array

        const res = await request(app)
            .get('/api/appointments/999/prescription/pdf')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Appointment not found');
    });

    it('should return 403 if patient is not owner of the appointment', async () => {
        db.query.mockResolvedValue([[{ patient_id: 10, doctor_id: 20 }]]);

        const res = await request(app)
            .get('/api/appointments/1/prescription/pdf')
            .set('Authorization', `Bearer ${wrongPatientToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Access denied');
    });

    it('should return 403 if doctor is not assigned to the appointment', async () => {
        db.query.mockResolvedValue([[{ patient_id: 10, doctor_id: 20 }]]);

        const res = await request(app)
            .get('/api/appointments/1/prescription/pdf')
            .set('Authorization', `Bearer ${wrongDoctorToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Access denied');
    });

    it('should allow patient to download own prescription', async () => {
        db.query
            .mockResolvedValueOnce([[{ patient_id: 10, doctor_id: 20 }]]) // first call: auth check
            .mockResolvedValueOnce([[mockAppointmentDetails]]); // second call: PDF generation

        const res = await request(app)
            .get('/api/appointments/1/prescription/pdf')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(200);
        expect(res.header['content-type']).toBe('application/pdf');
    });

    it('should allow doctor to download own patient prescription', async () => {
        db.query
            .mockResolvedValueOnce([[{ patient_id: 10, doctor_id: 20 }]]) // first call: auth check
            .mockResolvedValueOnce([[mockAppointmentDetails]]); // second call: PDF generation

        const res = await request(app)
            .get('/api/appointments/1/prescription/pdf')
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(res.status).toBe(200);
        expect(res.header['content-type']).toBe('application/pdf');
    });

    it('should allow admin to download any prescription', async () => {
        db.query
            .mockResolvedValueOnce([[{ patient_id: 10, doctor_id: 20 }]]) // first call: auth check
            .mockResolvedValueOnce([[mockAppointmentDetails]]); // second call: PDF generation

        const res = await request(app)
            .get('/api/appointments/1/prescription/pdf')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.header['content-type']).toBe('application/pdf');
    });
});
