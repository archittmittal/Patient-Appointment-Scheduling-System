import { API, authedHeaders } from '../config/api';

/**
 * Unified API Client for Patient Appointment Scheduling System.
 * Consolidates safeFetch and authedHeaders into a singular interface.
 */

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
}

function onRefreshed(token) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
}

function handleAuthFailure() {
    localStorage.removeItem('hs_token');
    localStorage.removeItem('hs_refresh_token');
    localStorage.removeItem('hs_user');
    window.location.reload();
}

async function fetchWithRetry(url, options = {}, retries = 1) {
    let response = await fetch(url, options);

    if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh') && retries > 0) {
        const refreshToken = localStorage.getItem('hs_refresh_token');
        if (!refreshToken) {
            handleAuthFailure();
            return response;
        }

        if (!isRefreshing) {
            isRefreshing = true;
            try {
                const refreshResponse = await fetch(`${API}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshResponse.ok) {
                    const data = await refreshResponse.json();
                    localStorage.setItem('hs_token', data.token);
                    if (data.refreshToken) {
                        localStorage.setItem('hs_refresh_token', data.refreshToken);
                    }
                    isRefreshing = false;
                    onRefreshed(data.token);
                } else {
                    isRefreshing = false;
                    handleAuthFailure();
                    return response;
                }
            } catch (err) {
                isRefreshing = false;
                handleAuthFailure();
                return response;
            }
        }

        const newToken = await new Promise(resolve => {
            subscribeTokenRefresh(token => {
                resolve(token);
            });
        });

        const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
        };
        const newOptions = {
            ...options,
            headers: newHeaders
        };
        return await fetch(url, newOptions);
    }

    return response;
}

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
            const response = await fetchWithRetry(`${API}${endpoint}`, {
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
            const response = await fetchWithRetry(`${API}${endpoint}`, {
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
            const response = await fetchWithRetry(`${API}${endpoint}`, {
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
            const response = await fetchWithRetry(`${API}${endpoint}`, {
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
            const response = await fetchWithRetry(`${API}${endpoint}`, {
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
