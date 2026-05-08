import { API, authedHeaders } from '../config/api';

/**
 * Unified API Client for Patient Appointment Scheduling System.
 * Consolidates safeFetch and authedHeaders into a singular interface.
 */

const handleResponse = async (response, defaultValue = []) => {
    if (!response.ok) {
        console.warn(`[API] Failure: ${response.status} ${response.statusText}`);
        try {
            const errorData = await response.json();
            return { ...errorData, error: true, status: response.status };
        } catch (e) {
            return { error: true, message: `Server error: ${response.status}`, status: response.status };
        }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return defaultValue;
    }

    const data = await response.json();
    return data ?? defaultValue;
};

export const apiClient = {
    async get(endpoint, defaultValue = []) {
        try {
            const response = await fetch(`${API}${endpoint}`, {
                headers: authedHeaders(),
            });
            return await handleResponse(response, defaultValue);
        } catch (error) {
            console.error(`[API] GET Error: ${endpoint}`, error);
            return defaultValue;
        }
    },

    async post(endpoint, body, defaultValue = []) {
        try {
            const response = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: authedHeaders(true),
                body: JSON.stringify(body),
            });
            return await handleResponse(response, defaultValue);
        } catch (error) {
            console.error(`[API] POST Error: ${endpoint}`, error);
            return defaultValue;
        }
    },

    async patch(endpoint, body, defaultValue = []) {
        try {
            const response = await fetch(`${API}${endpoint}`, {
                method: 'PATCH',
                headers: authedHeaders(true),
                body: JSON.stringify(body),
            });
            return await handleResponse(response, defaultValue);
        } catch (error) {
            console.error(`[API] PATCH Error: ${endpoint}`, error);
            return defaultValue;
        }
    },

    async delete(endpoint, defaultValue = []) {
        try {
            const response = await fetch(`${API}${endpoint}`, {
                method: 'DELETE',
                headers: authedHeaders(),
            });
            return await handleResponse(response, defaultValue);
        } catch (error) {
            console.error(`[API] DELETE Error: ${endpoint}`, error);
            return defaultValue;
        }
    },

    async getBlob(endpoint) {
        try {
            const response = await fetch(`${API}${endpoint}`, {
                headers: authedHeaders(),
            });
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            return await response.blob();
        } catch (error) {
            console.error(`[API] getBlob Error: ${endpoint}`, error);
            throw error;
        }
    }
};

export default apiClient;
