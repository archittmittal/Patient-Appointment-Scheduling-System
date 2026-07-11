const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock database
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    getConnection: jest.fn()
}));

// Mock services
jest.mock('../src/services/virtualCheckinService', () => ({
    updateStatus: jest.fn(),
    getWaitingRoomStatus: jest.fn(),
    virtualCheckIn: jest.fn()
}));

jest.mock('../src/services/sseManager', () => ({
    broadcastQueueUpdate: jest.fn(),
    broadcastToDoctor: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/db');
const virtualCheckinService = require('../src/services/virtualCheckinService');
const sseManager = require('../src/services/sseManager');
const { jwtSecret } = require('../src/middleware/authenticate');

describe('Virtual Checkin Status Update Endpoint — POST /api/virtual-checkin/:appointmentId/status', () => {
    const patientToken = jwt.sign({ id: 1, role: 'PATIENT' }, jwtSecret);

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue([[], []]);
    });

    it('should return 401 if request is unauthorized', async () => {
        const res = await request(app)
            .post('/api/virtual-checkin/101/status')
            .send({ status: 'ARRIVED' });
        
        expect(res.statusCode).toBe(401);
    });

    it('should return 400 with VALIDATION_ERROR if status is missing', async () => {
        const res = await request(app)
            .post('/api/virtual-checkin/101/status')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('"status" is required');
    });

    it('should return 400 with VALIDATION_ERROR if status value is invalid', async () => {
        const res = await request(app)
            .post('/api/virtual-checkin/101/status')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ status: 'INVALID_STATUS' });

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('"status" must be one of');
    });

    it('should return 200 and update status when request is valid', async () => {
        const mockResult = { success: true, status: 'ARRIVED' };
        virtualCheckinService.updateStatus.mockResolvedValue(mockResult);

        const mockActiveStatus = {
            appointment: {
                id: 101,
                doctorId: 2,
                doctor_id: 2
            }
        };
        virtualCheckinService.getWaitingRoomStatus.mockResolvedValue(mockActiveStatus);

        const res = await request(app)
            .post('/api/virtual-checkin/101/status')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ status: 'ARRIVED', etaMinutes: 10, message: 'Just parked' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(mockResult);

        expect(virtualCheckinService.updateStatus).toHaveBeenCalledWith(
            '101',
            1,
            'ARRIVED',
            { etaMinutes: 10, message: 'Just parked' }
        );
        expect(sseManager.broadcastQueueUpdate).toHaveBeenCalledWith('101', mockActiveStatus);
        expect(sseManager.broadcastToDoctor).toHaveBeenCalledWith(2, 'doctor_queue_update', expect.any(Object));
    });
});

describe('Virtual Checkin Endpoint — POST /api/virtual-checkin/:appointmentId/checkin', () => {
    const patientToken = jwt.sign({ id: 1, role: 'PATIENT' }, jwtSecret);

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue([[], []]);
    });

    it('should successfully check-in virtually and log vitals if provided', async () => {
        const mockResult = { success: true, message: 'Checked in' };
        const virtualCheckinService = require('../src/services/virtualCheckinService');
        
        jest.spyOn(virtualCheckinService, 'virtualCheckIn').mockResolvedValue(mockResult);
        jest.spyOn(virtualCheckinService, 'getWaitingRoomStatus').mockResolvedValue({
            appointment: { id: 101, doctorId: 2, doctor_id: 2 }
        });

        const res = await request(app)
            .post('/api/virtual-checkin/101/checkin')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                etaMinutes: 20,
                device: 'web',
                vitals: {
                    blood_pressure_sys: 120,
                    blood_pressure_dia: 80,
                    heart_rate: 72,
                    temperature_c: 36.5
                }
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(mockResult);
        expect(virtualCheckinService.virtualCheckIn).toHaveBeenCalledWith(
            '101',
            1,
            {
                etaMinutes: 20,
                device: 'web',
                vitals: {
                    blood_pressure_sys: 120,
                    blood_pressure_dia: 80,
                    heart_rate: 72,
                    temperature_c: 36.5
                }
            }
        );
    });
});
