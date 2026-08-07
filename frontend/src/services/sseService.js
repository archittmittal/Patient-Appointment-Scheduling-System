/**
 * SSE Service Singleton
 * Unifies real-time event streaming with resilient reconnection logic.
 * Implements exponential backoff with jitter to prevent cascading failures.
 */

import { API } from '../config/api';

const INITIAL_BACKOFF = 1000; // 1 second
const MAX_BACKOFF = 30000;    // 30 seconds

class SSEService {
    constructor() {
        this.eventSource = null;
        this.appointmentId = null;
        this.doctorId = null;
        this.reconnectTimeout = null;
        this.reconnectAttempts = 0;
    }

    /**
     * Calculate next backoff time using exponential growth and jitter
     */
    _getNextBackoff() {
        const backoff = Math.min(INITIAL_BACKOFF * Math.pow(2, this.reconnectAttempts), MAX_BACKOFF);
        this.reconnectAttempts++;
        // Add random jitter +/- 20%
        const jitter = backoff * 0.2 * (Math.random() * 2 - 1);
        return backoff + jitter;
    }

    /**
     * Connect to an appointment-specific SSE stream
     */
    connect(appointmentId, onMessage, onError) {
        if (this.appointmentId === appointmentId && this.eventSource?.readyState !== EventSource.CLOSED) {
            return; 
        }

        this.disconnect();
        this.appointmentId = appointmentId;
        this.doctorId = null; // Clear doctor context if switching
        
        const token = localStorage.getItem('hs_token');
        const url = `${API}/api/virtual-checkin/${appointmentId}/stream?token=${token}`;
        
        this._initConnection(url, onMessage, onError, () => {
            this.connect(appointmentId, onMessage, onError);
        });
    }

    /**
     * Connect to a doctor-specific SSE stream
     */
    connectDoctor(doctorId, onMessage, onError) {
        if (this.doctorId === doctorId && this.eventSource?.readyState !== EventSource.CLOSED) {
            return;
        }

        this.disconnect();
        this.doctorId = doctorId;
        this.appointmentId = null; // Clear appointment context
        
        const token = localStorage.getItem('hs_token');
        const url = `${API}/api/appointments/stream?doctorId=${doctorId}&token=${token}`;
        
        this._initConnection(url, onMessage, onError, () => {
            this.connectDoctor(doctorId, onMessage, onError);
        });
    }

    /**
     * Connect to a user-specific messages SSE stream
     */
    connectMessages(onMessage, onError) {
        if (this.eventSource?.readyState !== EventSource.CLOSED && this.eventSource?.url?.includes('/api/messages/stream')) {
            return;
        }

        this.disconnect();
        
        const token = localStorage.getItem('hs_token');
        const url = `${API}/api/messages/stream?token=${token}`;
        
        this._initConnection(url, onMessage, onError, () => {
            this.connectMessages(onMessage, onError);
        });
    }

    /**
     * Unified connection initializer
     */
    _initConnection(url, onMessage, onError, reconnectFn) {
        try {
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                console.log(`[SSE] Connected to ${url.split('?')[0]}`);
                this.reconnectAttempts = 0; // Reset on successful connection
            };

            const handleEvent = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    onMessage(data);
                } catch (err) {
                    console.error('[SSE] Data parse error:', err);
                }
            };

            // Register default listeners
            this.eventSource.addEventListener('queue_update', handleEvent);
            this.eventSource.addEventListener('doctor_queue_update', handleEvent);
            this.eventSource.addEventListener('status_update', handleEvent);
            this.eventSource.addEventListener('message', handleEvent);

            this.eventSource.onerror = (err) => {
                console.warn('[SSE] Connection lost. Attempting reconnect...', err);
                if (onError) onError(err);
                
                this.disconnect(false); // Disconnect but don't clear IDs
                
                const nextDelay = this._getNextBackoff();
                console.log(`[SSE] Reconnecting in ${Math.round(nextDelay)}ms (Attempt ${this.reconnectAttempts})`);
                
                this.reconnectTimeout = setTimeout(reconnectFn, nextDelay);
            };
        } catch (err) {
            console.error('[SSE] Failed to initialize:', err);
        }
    }

    /**
     * Close connection and clear timeouts
     * @param {boolean} full - Whether to reset attempt counters and context IDs
     */
    disconnect(full = true) {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (full) {
            this.reconnectAttempts = 0;
            this.appointmentId = null;
            this.doctorId = null;
        }
    }
}

export const sseService = new SSEService();
