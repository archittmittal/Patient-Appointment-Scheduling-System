/**
 * Server-Sent Events (SSE) Manager
 * Handles real-time connections for the Virtual Waiting Room
 */

const redisClient = require('../config/redisClient');
const logger = require('../config/logger');

class SSEManager {
    constructor() {
        // Map of connectionId -> { res, metadata }
        this.connections = new Map();
        // Map of appointmentId -> Set of connectionIds
        this.appointmentSubscriptions = new Map();
        // Map of doctorId -> Set of connectionIds
        this.doctorSubscriptions = new Map();
        // Map of userId -> Set of connectionIds
        this.userSubscriptions = new Map();

        // Ensure methods are bound to this instance
        this.addClient = this.addClient.bind(this);
        this.removeClient = this.removeClient.bind(this);
        this.sendToClient = this.sendToClient.bind(this);
        this.broadcastToAppointment = this.broadcastToAppointment.bind(this);
        this.broadcastToDoctor = this.broadcastToDoctor.bind(this);
        this.broadcastToUser = this.broadcastToUser.bind(this);
        this.broadcastQueueUpdate = this.broadcastQueueUpdate.bind(this);
        this.getActiveConnectionsCount = this.getActiveConnectionsCount.bind(this);
        this.setupPubSub = this.setupPubSub.bind(this);
        this.handleRemoteBroadcast = this.handleRemoteBroadcast.bind(this);
        this.broadcastLocal = this.broadcastLocal.bind(this);

        // Initialize Pub/Sub listener if configured
        this.setupPubSub();

        // Start 30s heartbeat keepalive ping
        this.heartbeatInterval = setInterval(() => {
            for (const [connectionId, client] of this.connections.entries()) {
                const res = client.res;
                if (!res || res.writableEnded || res.finished) {
                    this.removeClient(connectionId);
                    continue;
                }
                try {
                    res.write(':keepalive\n\n', (err) => {
                        if (err) {
                            this.removeClient(connectionId);
                        }
                    });
                } catch (error) {
                    this.removeClient(connectionId);
                }
            }
        }, 30000);

        // Unref interval to allow Node/tests to exit cleanly
        if (this.heartbeatInterval && typeof this.heartbeatInterval.unref === 'function') {
            this.heartbeatInterval.unref();
        }
    }

    /**
     * Add a new SSE client
     * @param {string} connectionId 
     * @param {object} res 
     * @param {object} metadata { appointmentId, doctorId, userId }
     */
    addClient(connectionId, res, metadata = {}) {
        const maxConnections = parseInt(process.env.MAX_SSE_CONNECTIONS, 10) || 1000;
        if (this.connections.size >= maxConnections) {
            res.writeHead(503, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Connection': 'close'
            });
            res.end(JSON.stringify({ message: 'Service Temporarily Unavailable: Connection limit reached' }));
            return;
        }

        let { appointmentId, doctorId, userId } = metadata;
        if (appointmentId !== undefined && appointmentId !== null) {
            appointmentId = String(appointmentId);
        }
        if (doctorId !== undefined && doctorId !== null) {
            doctorId = String(doctorId);
        }
        if (userId !== undefined && userId !== null) {
            userId = String(userId);
        }

        // Set proper headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Add to connections
        this.connections.set(connectionId, { res, metadata });

        // Add to appointment subscriptions
        if (appointmentId) {
            if (!this.appointmentSubscriptions.has(appointmentId)) {
                this.appointmentSubscriptions.set(appointmentId, new Set());
            }
            this.appointmentSubscriptions.get(appointmentId).add(connectionId);
        }

        // Add to doctor subscriptions
        if (doctorId) {
            if (!this.doctorSubscriptions.has(doctorId)) {
                this.doctorSubscriptions.set(doctorId, new Set());
            }
            this.doctorSubscriptions.get(doctorId).add(connectionId);
        }

        // Add to user subscriptions
        if (userId) {
            if (!this.userSubscriptions.has(userId)) {
                this.userSubscriptions.set(userId, new Set());
            }
            this.userSubscriptions.get(userId).add(connectionId);
        }

        // Send initial connection event
        this.sendToClient(connectionId, 'connected', { status: 'Neural Link Established' });

        // Setup cleanup on close/error
        const cleanup = () => {
            this.removeClient(connectionId, metadata);
        };
        res.on('close', cleanup);
        res.on('error', cleanup);
    }

    /**
     * Remove a client
     */
    removeClient(connectionId, metadata = null) {
        const client = this.connections.get(connectionId);
        if (!client && !metadata) return;

        const actualMetadata = metadata || (client ? client.metadata : {});
        let { appointmentId, doctorId, userId } = actualMetadata;

        if (appointmentId !== undefined && appointmentId !== null) {
            appointmentId = String(appointmentId);
        }
        if (doctorId !== undefined && doctorId !== null) {
            doctorId = String(doctorId);
        }
        if (userId !== undefined && userId !== null) {
            userId = String(userId);
        }

        this.connections.delete(connectionId);
        
        if (appointmentId && this.appointmentSubscriptions.has(appointmentId)) {
            const subs = this.appointmentSubscriptions.get(appointmentId);
            subs.delete(connectionId);
            if (subs.size === 0) this.appointmentSubscriptions.delete(appointmentId);
        }

        if (doctorId && this.doctorSubscriptions.has(doctorId)) {
            const subs = this.doctorSubscriptions.get(doctorId);
            subs.delete(connectionId);
            if (subs.size === 0) this.doctorSubscriptions.delete(doctorId);
        }

        if (userId && this.userSubscriptions.has(userId)) {
            const subs = this.userSubscriptions.get(userId);
            subs.delete(connectionId);
            if (subs.size === 0) this.userSubscriptions.delete(userId);
        }
    }

    /**
     * Send event to a specific client
     */
    sendToClient(connectionId, event, data) {
        const client = this.connections.get(connectionId);
        const res = client ? client.res : null;
        if (res && !res.writableEnded) {
            try {
                res.write(`event: ${event}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (error) {
                this.removeClient(connectionId);
            }
        }
    }

    /**
     * Set up Redis Pub/Sub subscription and message listener
     */
    setupPubSub() {
        const { redisSub } = redisClient;
        if (!redisSub) return;

        redisSub.subscribe('sse:broadcast', (err) => {
            if (err) {
                logger.error('Failed to subscribe to sse:broadcast: ' + err.message, { error: err });
            } else {
                logger.info('Subscribed to sse:broadcast channel.');
            }
        });

        redisSub.on('message', (channel, message) => {
            if (channel === 'sse:broadcast') {
                try {
                    const payload = JSON.parse(message);
                    this.handleRemoteBroadcast(payload);
                } catch (error) {
                    logger.error('Failed to parse remote sse:broadcast payload: ' + error.message, { error });
                }
            }
        });
    }

    /**
     * Handle incoming Redis Pub/Sub broadcast payload
     */
    handleRemoteBroadcast(payload) {
        const { type, id, event, data } = payload;
        const formattedId = id !== undefined && id !== null ? String(id) : '';

        if (type === 'appointment') {
            const subs = this.appointmentSubscriptions.get(formattedId);
            if (subs) {
                subs.forEach(connectionId => {
                    this.sendToClient(connectionId, event, data);
                });
            }
        } else if (type === 'doctor') {
            const subs = this.doctorSubscriptions.get(formattedId);
            if (subs) {
                subs.forEach(connectionId => {
                    this.sendToClient(connectionId, event, data);
                });
            }
        } else if (type === 'user') {
            const subs = this.userSubscriptions.get(formattedId);
            if (subs) {
                subs.forEach(connectionId => {
                    this.sendToClient(connectionId, event, data);
                });
            }
        }
    }

    /**
     * Broadcast locally using setImmediate (fallback or receiver)
     */
    broadcastLocal(type, id, event, data) {
        setImmediate(() => {
            const formattedId = id !== undefined && id !== null ? String(id) : '';
            const subs = type === 'appointment'
                ? this.appointmentSubscriptions.get(formattedId)
                : type === 'doctor'
                    ? this.doctorSubscriptions.get(formattedId)
                    : this.userSubscriptions.get(formattedId);

            if (subs) {
                subs.forEach(connectionId => {
                    this.sendToClient(connectionId, event, data);
                });
            }
        });
    }

    /**
     * Broadcast generic event to all clients of an appointment
     */
    broadcastToAppointment(appointmentId, event, data) {
        if (redisClient.isRedisEnabled()) {
            redisClient.redisPub.publish('sse:broadcast', JSON.stringify({
                type: 'appointment',
                id: appointmentId,
                event,
                data
            })).catch(err => {
                logger.error('Failed to publish sse:broadcast: ' + err.message, { error: err });
                this.broadcastLocal('appointment', appointmentId, event, data);
            });
        } else {
            this.broadcastLocal('appointment', appointmentId, event, data);
        }
    }

    /**
     * Broadcast generic event to all clients of a doctor
     */
    broadcastToDoctor(doctorId, event, data) {
        if (redisClient.isRedisEnabled()) {
            redisClient.redisPub.publish('sse:broadcast', JSON.stringify({
                type: 'doctor',
                id: doctorId,
                event,
                data
            })).catch(err => {
                logger.error('Failed to publish sse:broadcast: ' + err.message, { error: err });
                this.broadcastLocal('doctor', doctorId, event, data);
            });
        } else {
            this.broadcastLocal('doctor', doctorId, event, data);
        }
    }

    /**
     * Broadcast generic event to all clients of a user (for messaging)
     */
    broadcastToUser(userId, event, data) {
        if (redisClient.isRedisEnabled()) {
            redisClient.redisPub.publish('sse:broadcast', JSON.stringify({
                type: 'user',
                id: userId,
                event,
                data
            })).catch(err => {
                logger.error('Failed to publish sse:broadcast: ' + err.message, { error: err });
                this.broadcastLocal('user', userId, event, data);
            });
        } else {
            this.broadcastLocal('user', userId, event, data);
        }
    }

    /**
     * Broadcast queue update
     */
    broadcastQueueUpdate(appointmentId, queueData) {
        this.broadcastToAppointment(appointmentId, 'queue_update', queueData);
    }

    /**
     * Get active connections count
     */
    getActiveConnectionsCount() {
        return this.connections.size;
    }
}

// Export singleton instance
module.exports = new SSEManager();
