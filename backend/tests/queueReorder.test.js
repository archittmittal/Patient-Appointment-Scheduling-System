const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock database
jest.mock('../src/config/db', () => ({
    query: jest.fn().mockResolvedValue([[]]),
    getConnection: jest.fn()
}));

// Mock sseManager & virtualCheckinService
jest.mock('../src/services/sseManager', () => ({
    broadcastToDoctor: jest.fn(),
    broadcastQueueUpdate: jest.fn()
}));

jest.mock('../src/services/virtualCheckinService', () => ({
    getWaitingRoomStatus: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/db');
const sseManager = require('../src/services/sseManager');
const virtualCheckinService = require('../src/services/virtualCheckinService');
const { jwtSecret } = require('../src/middleware/authenticate');

describe('Queue Reordering Endpoint — POST /api/admin/reorder-queue', () => {
    const adminToken = jwt.sign({ id: 1, role: 'ADMIN' }, jwtSecret);
    const patientToken = jwt.sign({ id: 2, role: 'PATIENT' }, jwtSecret);
    let mockConn;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConn = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            query: jest.fn().mockResolvedValue([[]]),
            release: jest.fn()
        };
        db.getConnection.mockResolvedValue(mockConn);
    });

    it('should return 401 if request is unauthorized', async () => {
        const res = await request(app)
            .post('/api/admin/reorder-queue')
            .send({ doctorId: 1, queueIds: [10, 11] });
        
        expect(res.statusCode).toBe(401);
    });

    it('should return 403 if user is not an admin', async () => {
        const res = await request(app)
            .post('/api/admin/reorder-queue')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ doctorId: 1, queueIds: [10, 11] });
        
        expect(res.statusCode).toBe(403);
    });

    it('should successfully reorder the queue and broadcast updates', async () => {
        const mockAppointments = [
            { id: 101, patient_id: 10 },
            { id: 102, patient_id: 11 }
        ];

        // Mock database queries
        db.query.mockResolvedValueOnce([mockAppointments]); // SELECT query for appointments
        virtualCheckinService.getWaitingRoomStatus.mockResolvedValue({
            appointment: { id: 101, doctorId: 1 }
        });

        const res = await request(app)
            .post('/api/admin/reorder-queue')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ doctorId: 1, queueIds: [10, 11] });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, message: 'Queue reordered successfully' });

        // Ensure database update was called for each queueId
        expect(mockConn.query).toHaveBeenCalledWith(
            'UPDATE live_queue SET queue_number = ? WHERE id = ?',
            [1, 10]
        );
        expect(mockConn.query).toHaveBeenCalledWith(
            'UPDATE live_queue SET queue_number = ? WHERE id = ?',
            [2, 11]
        );
        expect(mockConn.commit).toHaveBeenCalled();

        // Ensure sseManager broadcasts were triggered
        expect(sseManager.broadcastToDoctor).toHaveBeenCalledWith(1, 'queue_update', expect.any(Object));
        expect(virtualCheckinService.getWaitingRoomStatus).toHaveBeenCalled();
        expect(sseManager.broadcastQueueUpdate).toHaveBeenCalled();
    });
});
