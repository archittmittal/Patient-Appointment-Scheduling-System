/**
 * Server-Sent Events (SSE) Manager
 * Handles real-time connections for the Virtual Waiting Room
 */

class SSEManager {
    constructor() {
        // Map of connectionId -> res object
        this.connections = new Map();
        // Map of appointmentId -> Set of connectionIds
        this.subscriptions = new Map();
    }

    /**
     * Add a new SSE client
     */
    addClient(connectionId, res, appointmentId) {
        // Set proper headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Add to connections
        this.connections.set(connectionId, res);

        // Add to subscriptions
        if (appointmentId) {
            if (!this.subscriptions.has(appointmentId)) {
                this.subscriptions.set(appointmentId, new Set());
            }
            this.subscriptions.get(appointmentId).add(connectionId);
        }

        // Send initial connection event
        this.sendToClient(connectionId, 'connected', { status: 'Connected to waiting room' });

        // Setup cleanup on close
        res.on('close', () => {
            this.removeClient(connectionId, appointmentId);
        });
    }

    /**
     * Remove a client
     */
    removeClient(connectionId, appointmentId) {
        this.connections.delete(connectionId);
        
        if (appointmentId && this.subscriptions.has(appointmentId)) {
            const subs = this.subscriptions.get(appointmentId);
            subs.delete(connectionId);
            if (subs.size === 0) {
                this.subscriptions.delete(appointmentId);
            }
        }
    }

    /**
     * Send event to a specific client
     */
    sendToClient(connectionId, event, data) {
        const res = this.connections.get(connectionId);
        if (res) {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }

    /**
     * Broadcast generic event to all clients an appointment
     */
    broadcastToAppointment(appointmentId, event, data) {
        const subs = this.subscriptions.get(appointmentId);
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
const sseManager = new SSEManager();
module.exports = sseManager;
