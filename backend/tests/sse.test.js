const sseManager = require('../src/services/sseManager');

describe('SSEManager Service Unit Tests', () => {
    let mockRes;
    
    beforeEach(() => {
        mockRes = {
            writeHead: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
            removeListener: jest.fn()
        };
        // Reset connections and subscriptions maps
        sseManager.connections.clear();
        sseManager.appointmentSubscriptions.clear();
        sseManager.doctorSubscriptions.clear();
    });

    describe('addClient() and removeClient()', () => {
        it('should successfully add a client and set up event-stream headers', () => {
            const connectionId = 'test-client-1';
            sseManager.addClient(connectionId, mockRes, { appointmentId: 101, doctorId: 5 });

            expect(sseManager.getActiveConnectionsCount()).toBe(1);
            expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('event: connected'));

            // Check subscriptions are populated
            expect(sseManager.appointmentSubscriptions.get('101').has(connectionId)).toBe(true);
            expect(sseManager.doctorSubscriptions.get('5').has(connectionId)).toBe(true);
        });

        it('should successfully remove a client and clean up subscriptions', () => {
            const connectionId = 'test-client-1';
            sseManager.addClient(connectionId, mockRes, { appointmentId: 101, doctorId: 5 });
            expect(sseManager.getActiveConnectionsCount()).toBe(1);

            sseManager.removeClient(connectionId, { appointmentId: 101, doctorId: 5 });
            expect(sseManager.getActiveConnectionsCount()).toBe(0);
            expect(sseManager.appointmentSubscriptions.has('101')).toBe(false);
            expect(sseManager.doctorSubscriptions.has('5')).toBe(false);
        });
    });

    describe('Max connection limits', () => {
        it('should return 503 Service Unavailable when max connection limit is exceeded', () => {
            const originalMax = process.env.MAX_SSE_CONNECTIONS;
            process.env.MAX_SSE_CONNECTIONS = '2';

            try {
                const res1 = { writeHead: jest.fn(), write: jest.fn(), on: jest.fn() };
                const res2 = { writeHead: jest.fn(), write: jest.fn(), on: jest.fn() };
                const res3 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn(), on: jest.fn() };

                sseManager.addClient('client1', res1);
                sseManager.addClient('client2', res2);
                sseManager.addClient('client3', res3);

                expect(sseManager.getActiveConnectionsCount()).toBe(2);
                expect(res3.writeHead).toHaveBeenCalledWith(503, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Connection': 'close'
                });
                expect(res3.end).toHaveBeenCalled();
            } finally {
                process.env.MAX_SSE_CONNECTIONS = originalMax;
            }
        });
    });

    describe('Broadcasting via setImmediate', () => {
        it('should broadcast to appointments asynchronously using setImmediate', (done) => {
            const connectionId = 'test-client-1';
            sseManager.addClient(connectionId, mockRes, { appointmentId: 101 });

            sseManager.broadcastQueueUpdate(101, { activePosition: 3 });

            // setImmediate should execute after current tick
            expect(mockRes.write).not.toHaveBeenCalledWith(expect.stringContaining('activePosition'));

            setImmediate(() => {
                try {
                    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('activePosition'));
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });
    });
});
