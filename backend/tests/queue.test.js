const request = require('supertest');
const jwt = require('jsonwebtoken');

// 1. Module-level mocks (hoisted)
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    getConnection: jest.fn()
}));

jest.mock('../src/services/notificationService', () => ({
    notifyYourTurn: jest.fn(),
    notifyTurnApproaching: jest.fn(),
    notifyMissed: jest.fn()
}));

jest.mock('../src/services/durationPrediction', () => ({
    predictConsultationDuration: jest.fn(),
    recordConsultationDuration: jest.fn(),
    calculateQueueWaitTime: jest.fn(),
    recalculateQueueEstimates: jest.fn()
}));

jest.mock('../src/services/prescriptionService', () => ({
    createPrescription: jest.fn()
}));

jest.mock('../src/services/vitalsService', () => ({
    logVitals: jest.fn()
}));

jest.mock('../src/services/waitlistService', () => ({
    handleSlotRelease: jest.fn()
}));

jest.mock('../src/services/sseManager', () => ({
    broadcastQueueUpdate: jest.fn(),
    broadcastToDoctor: jest.fn()
}));

jest.mock('../src/services/virtualCheckinService', () => ({
    getWaitingRoomStatus: jest.fn()
}));

// 2. Imports
const app = require('../src/server');
const db = require('../src/config/db');
const notificationService = require('../src/services/notificationService');
const durationPrediction = require('../src/services/durationPrediction');
const prescriptionService = require('../src/services/prescriptionService');
const vitalsService = require('../src/services/vitalsService');
const waitlistService = require('../src/services/waitlistService');
const virtualCheckinService = require('../src/services/virtualCheckinService');
const { jwtSecret } = require('../src/middleware/authenticate');

describe('Queue State Machine — PATCH /api/appointments/queue/:queueId/status', () => {
    let mockConn;

    beforeEach(() => {
        // Since resetMocks is true in jest.config.js, we MUST define implementation in beforeEach
        notificationService.notifyYourTurn.mockResolvedValue();
        notificationService.notifyTurnApproaching.mockResolvedValue();
        notificationService.notifyMissed.mockResolvedValue();
        
        durationPrediction.predictConsultationDuration.mockResolvedValue({ predictedDuration: 15, factors: {} });
        durationPrediction.recordConsultationDuration.mockResolvedValue();
        durationPrediction.calculateQueueWaitTime.mockResolvedValue({ estimatedWait: 0 });
        durationPrediction.recalculateQueueEstimates.mockResolvedValue();
        
        prescriptionService.createPrescription.mockResolvedValue();
        vitalsService.logVitals.mockResolvedValue();
        waitlistService.handleSlotRelease.mockResolvedValue();
        virtualCheckinService.getWaitingRoomStatus.mockResolvedValue({ queuePosition: 1 });

        db.query.mockResolvedValue([[], []]);

        mockConn = {
            query: jest.fn().mockResolvedValue([[{ affectedRows: 1 }], []]),
            beginTransaction: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            release: jest.fn()
        };
        db.getConnection.mockResolvedValue(mockConn);
    });

    const doctorToken = jwt.sign({ id: 1, role: 'DOCTOR' }, jwtSecret);

    it('should successfully transition to IN_PROGRESS', async () => {
        mockConn.query.mockImplementation((sql, params) => {
            if (sql.includes('SELECT lq.appointment_id')) {
                return Promise.resolve([[{ 
                    appointment_id: 101, 
                    doctor_id: 1, 
                    patient_id: 2,
                    doc_first: 'Sarah',
                    doc_last: 'Jenkins',
                    location_room: 'Room 101',
                    queue_number: 5,
                    appointment_date: '2026-05-09'
                }], []]);
            }
            if (sql.includes('SELECT a.patient_id, lq.queue_number')) {
                return Promise.resolve([[], []]);
            }
            if (sql.includes('SELECT lq.appointment_id, a.patient_id')) {
                return Promise.resolve([[], []]);
            }
            return Promise.resolve([[{ affectedRows: 1 }], []]);
        });

        const res = await request(app)
            .patch('/api/appointments/queue/1/status')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({ status: 'IN_PROGRESS' });
        
        if (res.statusCode !== 200) console.log('DEBUG RES BODY:', res.body);
        expect(res.statusCode).toBe(200);
    });

    it('should handle MISSED status by repositioning patient', async () => {
        mockConn.query.mockImplementation((sql, params) => {
            if (sql.includes('SELECT lq.appointment_id')) {
                return Promise.resolve([[{ 
                    appointment_id: 101, 
                    doctor_id: 1, 
                    patient_id: 2,
                    queue_number: 5,
                    appointment_date: '2026-05-09',
                    doc_first: 'Sarah',
                    doc_last: 'Jenkins'
                }], []]);
            }
            if (sql.includes('MAX(lq.queue_number)')) {
                return Promise.resolve([[{ maxQ: 10 }], []]);
            }
            if (sql.includes('SELECT lq.appointment_id, a.patient_id')) {
                return Promise.resolve([[], []]);
            }
            return Promise.resolve([[{ affectedRows: 1 }], []]);
        });

        const res = await request(app)
            .patch('/api/appointments/queue/1/status')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({ status: 'MISSED' });
        
        if (res.statusCode !== 200) console.log('DEBUG RES BODY:', res.body);
        expect(res.statusCode).toBe(200);
    });

    it('should successfully transition to COMPLETED with vitals', async () => {
        mockConn.query.mockImplementation((sql, params) => {
            if (sql.includes('SELECT lq.appointment_id')) {
                return Promise.resolve([[{ 
                    appointment_id: 101, 
                    doctor_id: 1, 
                    patient_id: 2,
                    queue_number: 5,
                    appointment_date: '2026-05-09',
                    doc_first: 'Sarah',
                    doc_last: 'Jenkins'
                }], []]);
            }
            if (sql.includes('SELECT consultation_start')) {
                return Promise.resolve([[{ consultation_start: new Date(Date.now() - 15 * 60000) }], []]);
            }
            if (sql.includes('SELECT lq.appointment_id, a.patient_id')) {
                return Promise.resolve([[]]);
            }
            return Promise.resolve([[{ affectedRows: 1 }], []]);
        });

        const res = await request(app)
            .patch('/api/appointments/queue/1/status')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({ 
                status: 'COMPLETED',
                diagnosis: 'Common Cold',
                vitals: {
                    weight_kg: 70,
                    heart_rate: 72
                }
            });
        
        if (res.statusCode !== 200) console.log('DEBUG RES BODY:', res.body);
        expect(res.statusCode).toBe(200);
    });
});
