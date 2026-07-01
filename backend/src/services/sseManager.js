/**
 * Server-Sent Events (SSE) Manager
 * Handles real-time connections for the Virtual Waiting Room
 */

class SSEManager {
    constructor() {
        // Map of connectionId -> { res, metadata }
        this.connections = new Map();
        // Map of appointmentId -> Set of connectionIds
        this.appointmentSubscriptions = new Map();
        // Map of doctorId -> Set of connectionIds
        this.doctorSubscriptions = new Map();

        // Ensure methods are bound to this instance
        this.addClient = this.addClient.bind(this);
        this.removeClient = this.removeClient.bind(this);
        this.sendToClient = this.sendToClient.bind(this);
        this.broadcastToAppointment = this.broadcastToAppointment.bind(this);
        this.broadcastToDoctor = this.broadcastToDoctor.bind(this);
        this.broadcastQueueUpdate = this.broadcastQueueUpdate.bind(this);
        this.getActiveConnectionsCount = this.getActiveConnectionsCount.bind(this);

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
     * @param {object} metadata { appointmentId, doctorId }
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

        let { appointmentId, doctorId } = metadata;
        if (appointmentId !== undefined && appointmentId !== null) {
            appointmentId = String(appointmentId);
        }
        if (doctorId !== undefined && doctorId !== null) {
            doctorId = String(doctorId);
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
        let { appointmentId, doctorId } = actualMetadata;

        if (appointmentId !== undefined && appointmentId !== null) {
            appointmentId = String(appointmentId);
        }
        if (doctorId !== undefined && doctorId !== null) {
            doctorId = String(doctorId);
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
     * Broadcast generic event to all clients of an appointment
     */
    broadcastToAppointment(appointmentId, event, data) {
        setImmediate(() => {
            if (appointmentId !== undefined && appointmentId !== null) {
                appointmentId = String(appointmentId);
            }
            const subs = this.appointmentSubscriptions.get(appointmentId);
            if (subs) {
                subs.forEach(connectionId => {
                    this.sendToClient(connectionId, event, data);
                });
            }
        });
    }

    /**
     * Broadcast generic event to all clients of a doctor
     */
    broadcastToDoctor(doctorId, event, data) {
        setImmediate(() => {
            if (doctorId !== undefined && doctorId !== null) {
                doctorId = String(doctorId);
            }
            const subs = this.doctorSubscriptions.get(doctorId);
            if (subs) {
                subs.forEach(connectionId => {
                    this.sendToClient(connectionId, event, data);
                });
            }
        });
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
