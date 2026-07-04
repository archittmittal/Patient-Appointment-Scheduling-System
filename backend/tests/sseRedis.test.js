const redisClient = require('../src/config/redisClient');
const sseManager = require('../src/services/sseManager');

// Manually override redisClient methods and objects for testing
redisClient.isRedisEnabled = jest.fn().mockReturnValue(false);

const mockPublish = jest.fn().mockResolvedValue(1);
redisClient.redisPub = {
    publish: mockPublish
};

redisClient.redisSub = {
    subscribe: jest.fn().mockImplementation((channel, callback) => {
        if (typeof callback === 'function') callback(null);
    }),
    on: jest.fn()
};

describe('SSEManager Redis Pub/Sub Integration Tests', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = {
            writeHead: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
            removeListener: jest.fn()
        };
        sseManager.connections.clear();
        sseManager.appointmentSubscriptions.clear();
        sseManager.doctorSubscriptions.clear();
        mockPublish.mockReset();
        mockPublish.mockResolvedValue(1);
        redisClient.isRedisEnabled.mockReset();
        redisClient.isRedisEnabled.mockReturnValue(false);
    });

    describe('In-Memory Fallback', () => {
        it('should broadcast locally when Redis is disabled', (done) => {
            redisClient.isRedisEnabled.mockReturnValue(false);

            sseManager.addClient('client1', mockRes, { appointmentId: 101 });
            sseManager.broadcastToAppointment(101, 'queue_update', { pos: 2 });

            // Since it is async (setImmediate), check after tick
            setImmediate(() => {
                try {
                    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('queue_update'));
                    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('{"pos":2}'));
                    expect(mockPublish).not.toHaveBeenCalled();
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });
    });

    describe('Redis Pub/Sub Enabled', () => {
        beforeEach(() => {
            redisClient.isRedisEnabled.mockReturnValue(true);
        });

        it('should publish appointment broadcast to Redis instead of sending locally directly', () => {
            sseManager.addClient('client1', mockRes, { appointmentId: 101 });
            sseManager.broadcastToAppointment(101, 'queue_update', { pos: 2 });

            expect(mockPublish).toHaveBeenCalledWith(
                'sse:broadcast',
                JSON.stringify({
                    type: 'appointment',
                    id: 101,
                    event: 'queue_update',
                    data: { pos: 2 }
                })
            );
            // It should not send locally yet because the local instance relies on receiving the message back from Redis Pub/Sub
            expect(mockRes.write).not.toHaveBeenCalledWith(expect.stringContaining('queue_update'));
        });

        it('should publish doctor broadcast to Redis', () => {
            sseManager.addClient('client1', mockRes, { doctorId: 5 });
            sseManager.broadcastToDoctor(5, 'delay_update', { mins: 15 });

            expect(mockPublish).toHaveBeenCalledWith(
                'sse:broadcast',
                JSON.stringify({
                    type: 'doctor',
                    id: 5,
                    event: 'delay_update',
                    data: { mins: 15 }
                })
            );
        });

        it('should route incoming Pub/Sub messages to local subscribers', () => {
            sseManager.addClient('client1', mockRes, { appointmentId: 101 });

            // Simulate receiving the pub/sub message
            sseManager.handleRemoteBroadcast({
                type: 'appointment',
                id: 101,
                event: 'queue_update',
                data: { pos: 2 }
            });

            expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('queue_update'));
            expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('{"pos":2}'));
        });

        it('should fallback to local broadcast if Redis publish fails', (done) => {
            mockPublish.mockRejectedValueOnce(new Error('Redis Connection Lost'));

            sseManager.addClient('client1', mockRes, { appointmentId: 101 });
            sseManager.broadcastToAppointment(101, 'queue_update', { pos: 2 });

            // We need to wait for both the rejected promise microtask and the setImmediate macrotask
            setImmediate(() => {
                setImmediate(() => {
                    try {
                        expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('queue_update'));
                        done();
                    } catch (error) {
                        done(error);
                    }
                });
            });
        });
    });
});
