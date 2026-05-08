/**
 * SSE Service Singleton
 * Unifies real-time event streaming for the application.
 */

import { API } from '../config/api';

class SSEService {
    constructor() {
        this.eventSource = null;
        this.listeners = new Map();
        this.appointmentId = null;
        this.reconnectTimeout = null;
    }

    /**
     * Connect to an appointment-specific SSE stream
     */
    connect(appointmentId, onMessage, onError) {
        if (this.appointmentId === appointmentId && this.eventSource?.readyState !== EventSource.CLOSED) {
            return; // Already connected
        }

        this.disconnect();
        this.appointmentId = appointmentId;
        
        const token = localStorage.getItem('hs_token');
        const url = `${API}/api/virtual-checkin/${appointmentId}/stream?token=${token}`;
        
        try {
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                console.log(`[SSE] Connected to appointment ${appointmentId}`);
            };

            const handleMessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    onMessage(data);
                } catch (err) {
                    console.error('[SSE] Data parse error:', err);
                }
            };

            this.eventSource.addEventListener('queue_update', handleMessage);
            this.eventSource.addEventListener('doctor_queue_update', handleMessage);

            this.eventSource.onerror = (err) => {
                console.error('[SSE] Connection error:', err);
                if (onError) onError(err);
                
                // Auto-reconnect logic
                this.disconnect();
                this.reconnectTimeout = setTimeout(() => {
                    this.connect(appointmentId, onMessage, onError);
                }, 5000);
            };
        } catch (err) {
            console.error('[SSE] Failed to initialize:', err);
        }
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
        
        const token = localStorage.getItem('hs_token');
        const url = `${API}/api/appointments/stream?doctorId=${doctorId}&token=${token}`;
        
        try {
            this.eventSource = new EventSource(url);

            this.eventSource.addEventListener('queue_update', (e) => {
                try {
                    const data = JSON.parse(e.data);
                    onMessage(data);
                } catch (err) {
                    console.error('[SSE] Data parse error:', err);
                }
            });

            this.eventSource.onerror = (err) => {
                console.error('[SSE] Connection error:', err);
                if (onError) onError(err);
                this.disconnect();
                this.reconnectTimeout = setTimeout(() => {
                    this.connectDoctor(doctorId, onMessage, onError);
                }, 5000);
            };
        } catch (err) {
            console.error('[SSE] Failed to initialize:', err);
        }
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
}

export const sseService = new SSEService();
