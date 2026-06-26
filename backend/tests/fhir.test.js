const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/middleware/authenticate');
const fhirService = require('../src/services/fhirService');

// Mock the database
jest.mock('../src/config/db', () => {
    const mockQuery = jest.fn();
    return {
        query: mockQuery,
        getConnection: jest.fn()
    };
});

describe('HL7 FHIR R4 Service and API Integration', () => {
    let patientToken;
    let otherPatientToken;
    let doctorToken;
    let adminToken;
    
    const patientId = 10;
    const otherPatientId = 20;
    const doctorId = 5;
    const adminId = 1;

    beforeAll(() => {
        patientToken = jwt.sign({ id: patientId, role: 'PATIENT' }, jwtSecret);
        otherPatientToken = jwt.sign({ id: otherPatientId, role: 'PATIENT' }, jwtSecret);
        doctorToken = jwt.sign({ id: doctorId, role: 'DOCTOR' }, jwtSecret);
        adminToken = jwt.sign({ id: adminId, role: 'ADMIN' }, jwtSecret);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('FHIR Service Mapping Units', () => {
        const mockPatient = {
            id: 10,
            first_name: 'John',
            last_name: 'Doe',
            dob: '1990-05-15',
            phone: '+15551234567',
            email: 'patient@example.com',
            address: '123 Healing St',
            abha_id: 'john.doe@abha',
            abha_number: '12-3456-7890-12'
        };

        const mockVitals = {
            id: 101,
            patient_id: 10,
            weight_kg: 75.5,
            height_cm: 180,
            blood_pressure_sys: 120,
            blood_pressure_dia: 80,
            heart_rate: 72,
            temperature_c: 37.0,
            spo2: 98,
            recorded_at: '2026-06-25T12:00:00.000Z'
        };

        const mockPrescription = {
            id: 201,
            patient_id: 10,
            doctor_id: 5,
            medications: 'Amoxicillin 500mg',
            instructions: 'Take three times daily after meals',
            dosage: '500mg',
            frequency: 'three times daily',
            duration_days: 7,
            is_active: 1,
            date_prescribed: '2026-06-25T12:00:00.000Z'
        };

        it('should correctly map a patient to FHIR Patient resource', () => {
            const result = fhirService.toFhirPatient(mockPatient);
            expect(result).not.toBeNull();
            expect(result.resourceType).toBe('Patient');
            expect(result.id).toBe('10');
            expect(result.name[0].family).toBe('Doe');
            expect(result.name[0].given[0]).toBe('John');
            expect(result.telecom[0].value).toBe('+15551234567');
            expect(result.telecom[1].value).toBe('patient@example.com');
            expect(result.birthDate).toBe('1990-05-15');
            expect(result.address[0].text).toBe('123 Healing St');
            expect(result.identifier).toContainEqual({
                system: 'https://ndhm.gov.in/abha-id',
                value: 'john.doe@abha'
            });
        });

        it('should correctly map vitals to FHIR Observation resource', () => {
            const result = fhirService.toFhirObservation(mockVitals, mockPatient);
            expect(result).not.toBeNull();
            expect(result.resourceType).toBe('Observation');
            expect(result.id).toBe('101');
            expect(result.subject.reference).toBe('Patient/10');
            expect(result.status).toBe('final');
            expect(result.category[0].coding[0].code).toBe('vital-signs');

            // Verify a few components
            const weightComp = result.component.find(c => c.code.coding[0].code === '29463-7');
            expect(weightComp).toBeDefined();
            expect(weightComp.valueQuantity.value).toBe(75.5);

            const bpSysComp = result.component.find(c => c.code.coding[0].code === '8480-6');
            expect(bpSysComp).toBeDefined();
            expect(bpSysComp.valueQuantity.value).toBe(120);

            const bpDiaComp = result.component.find(c => c.code.coding[0].code === '8462-4');
            expect(bpDiaComp).toBeDefined();
            expect(bpDiaComp.valueQuantity.value).toBe(80);

            const spo2Comp = result.component.find(c => c.code.coding[0].code === '2708-6');
            expect(spo2Comp).toBeDefined();
            expect(spo2Comp.valueQuantity.value).toBe(98);
        });

        it('should correctly map a prescription to FHIR MedicationStatement resource', () => {
            const result = fhirService.toFhirMedicationStatement(mockPrescription, mockPatient);
            expect(result).not.toBeNull();
            expect(result.resourceType).toBe('MedicationStatement');
            expect(result.id).toBe('201');
            expect(result.status).toBe('active');
            expect(result.medicationCodeableConcept.text).toBe('Amoxicillin 500mg');
            expect(result.subject.reference).toBe('Patient/10');
            expect(result.dosage[0].text).toBe('500mg');
            expect(result.dosage[0].timing.repeat.frequency).toBe(3);
            expect(result.dosage[0].timing.repeat.boundsDuration.value).toBe(7);
        });

        it('should assemble resources into a FHIR Bundle', () => {
            const bundle = fhirService.toFhirBundle(mockPrescription, mockVitals, mockPatient);
            expect(bundle.resourceType).toBe('Bundle');
            expect(bundle.type).toBe('collection');
            expect(bundle.entry.length).toBe(3);
            expect(bundle.entry[0].resource.resourceType).toBe('Patient');
            expect(bundle.entry[1].resource.resourceType).toBe('MedicationStatement');
            expect(bundle.entry[2].resource.resourceType).toBe('Observation');
        });
    });

    describe('GET /api/prescriptions/:id/fhir Endpoint Integration', () => {
        const prescriptionId = 201;

        const dbPrescription = {
            id: prescriptionId,
            patient_id: patientId,
            doctor_id: doctorId,
            medications: 'Lisinopril 10mg',
            instructions: 'Take once daily in the morning',
            dosage: '10mg',
            frequency: 'once daily',
            duration_days: 30,
            is_active: 1,
            date_prescribed: '2026-06-25T12:00:00.000Z'
        };

        const dbPatient = {
            id: patientId,
            first_name: 'Test',
            last_name: 'Patient',
            dob: '1995-01-01',
            phone: '+919999999999',
            blood_group: 'AB+',
            address: '404 Test Block',
            abha_id: 'test.patient@abha',
            abha_number: '12-3456-7890-12',
            email: 'patient@test.com'
        };

        const dbVitals = {
            id: 301,
            patient_id: patientId,
            weight_kg: 78.5,
            height_cm: 180.0,
            blood_pressure_sys: 130,
            blood_pressure_dia: 85,
            heart_rate: 76,
            temperature_c: 37.0,
            spo2: 99,
            recorded_by: doctorId,
            recorded_at: '2026-06-23T12:00:00.000Z'
        };

        it('should return 401 if unauthenticated', async () => {
            const res = await request(app).get(`/api/prescriptions/${prescriptionId}/fhir`);
            expect(res.statusCode).toBe(401);
        });

        it('should return 404 if prescription does not exist', async () => {
            db.query.mockResolvedValueOnce([[]]); // prescription lookup returns empty

            const res = await request(app)
                .get(`/api/prescriptions/999/fhir`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('not found');
        });

        it('should allow patient to fetch their own FHIR bundle', async () => {
            db.query
                .mockResolvedValueOnce([[dbPrescription]]) // 1. fetch prescription
                .mockResolvedValueOnce([[dbPatient]])      // 2. fetch patient
                .mockResolvedValueOnce([[dbVitals]]);     // 3. fetch latest vitals

            const res = await request(app)
                .get(`/api/prescriptions/${prescriptionId}/fhir`)
                .set('Authorization', `Bearer ${patientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.resourceType).toBe('Bundle');
            expect(res.body.entry.length).toBe(3);
            expect(res.body.entry[0].resource.id).toBe(String(patientId));
            expect(res.body.entry[1].resource.id).toBe(String(prescriptionId));
            expect(res.body.entry[2].resource.id).toBe(String(dbVitals.id));
        });

        it('should deny access (403) to a patient requesting another patient\'s prescription', async () => {
            db.query.mockResolvedValueOnce([[dbPrescription]]); // fetch prescription (belongs to patientId 10, but otherPatientToken has id 20)

            const res = await request(app)
                .get(`/api/prescriptions/${prescriptionId}/fhir`)
                .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('Access denied');
        });

        it('should allow a doctor to access FHIR bundle if consent is GRANTED', async () => {
            db.query
                .mockResolvedValueOnce([[dbPrescription]]) // 1. fetch prescription
                .mockResolvedValueOnce([[{ status: 'GRANTED' }]]) // 2. check consent logs
                .mockResolvedValueOnce([[dbPatient]])      // 3. fetch patient
                .mockResolvedValueOnce([[dbVitals]]);     // 4. fetch latest vitals

            const res = await request(app)
                .get(`/api/prescriptions/${prescriptionId}/fhir`)
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.resourceType).toBe('Bundle');
        });

        it('should deny access (403) to a doctor if consent is not GRANTED', async () => {
            db.query
                .mockResolvedValueOnce([[dbPrescription]]) // 1. fetch prescription
                .mockResolvedValueOnce([[]]); // 2. check consent logs (none found)

            const res = await request(app)
                .get(`/api/prescriptions/${prescriptionId}/fhir`)
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.code).toBe('CONSENT_REQUIRED');
        });

        it('should allow admin to access any FHIR bundle without checking consent', async () => {
            db.query
                .mockResolvedValueOnce([[dbPrescription]]) // 1. fetch prescription
                .mockResolvedValueOnce([[dbPatient]])      // 2. fetch patient
                .mockResolvedValueOnce([[dbVitals]]);     // 3. fetch latest vitals

            const res = await request(app)
                .get(`/api/prescriptions/${prescriptionId}/fhir`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.resourceType).toBe('Bundle');
        });
    });
});
