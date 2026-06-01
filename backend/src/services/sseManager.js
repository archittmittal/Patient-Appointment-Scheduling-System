/**
 * Server-Sent Events (SSE) Manager
 * Handles real-time connections for the Virtual Waiting Room
 */

class SSEManager {
    constructor() {
        // Map of connectionId -> res object
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
    }

    /**
     * Add a new SSE client
     * @param {string} connectionId 
     * @param {object} res 
     * @param {object} metadata { appointmentId, doctorId }
     */
    addClient(connectionId, res, metadata = {}) {
        let { appointmentId, doctorId } = metadata;
        if (appointmentId !== undefined && appointmentId !== null) {
            appointmentId = String(appointmentId);
        }
        if (doctorId !== undefined && doctorId !== null) {
            doctorId = String(doctorId);
        }

        // Set proper headers for SSE
        // SEC-013: Do NOT set Access-Control-Allow-Origin here — CORS is already enforced
        // by the cors() middleware in server.js. A wildcard here would bypass the whitelist.
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Add to connections
        this.connections.set(connectionId, res);

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

        // Setup cleanup on close
        res.on('close', () => {
            this.removeClient(connectionId, metadata);
        });
    }

    /**
     * Remove a client
     */
    removeClient(connectionId, metadata = {}) {
        let { appointmentId, doctorId } = metadata;
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
        const res = this.connections.get(connectionId);
        if (res && !res.writableEnded) {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }

    /**
     * Broadcast generic event to all clients of an appointment
     */
    broadcastToAppointment(appointmentId, event, data) {
        if (appointmentId !== undefined && appointmentId !== null) {
            appointmentId = String(appointmentId);
        }
        const subs = this.appointmentSubscriptions.get(appointmentId);
        if (subs) {
            subs.forEach(connectionId => {
                this.sendToClient(connectionId, event, data);
            });
        }
    }

    /**
     * Broadcast generic event to all clients of a doctor
     */
    broadcastToDoctor(doctorId, event, data) {
        if (doctorId !== undefined && doctorId !== null) {
            doctorId = String(doctorId);
        }
        const subs = this.doctorSubscriptions.get(doctorId);
        if (subs) {
            subs.forEach(connectionId => {
                this.sendToClient(connectionId, event, data);
            });
        }
    }

    /**
     * Broadcast queue update
     */
    broadcastQueueUpdate(appointmentId, queueData) {
        this.broadcastToAppointment(appointmentId, 'queue_update', queueData);
    }
}

// Export singleton instance
module.exports = new SSEManager();
