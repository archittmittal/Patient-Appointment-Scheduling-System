import { apiClient } from './apiClient';

export const authService = {
    /**
     * Authenticate user and store session
     */
    async login(email, password) {
        const data = await apiClient.post('/api/auth/login', { email, password });
        
        if (data.token) {
            localStorage.setItem('hs_token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('hs_refresh_token', data.refreshToken);
            }
            // Store minimal session data
            const session = {
                id: data.id,
                email: data.email,
                role: data.role
            };
            localStorage.setItem('hs_user', JSON.stringify(session));
        }
        
        return data;
    },

    /**
     * Authenticate user with Google SSO
     */
    async googleLogin(googleToken) {
        const data = await apiClient.post('/api/auth/google', { token: googleToken });
        
        if (data.token) {
            localStorage.setItem('hs_token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('hs_refresh_token', data.refreshToken);
            }
            const session = {
                id: data.id,
                email: data.email,
                role: data.role
            };
            localStorage.setItem('hs_user', JSON.stringify(session));
        }
        
        return data;
    },

    /**
     * Register new user and auto-login
     */
    async register(userData) {
        const data = await apiClient.post('/api/auth/register', userData);

        if (data.token) {
            localStorage.setItem('hs_token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('hs_refresh_token', data.refreshToken);
            }
            const session = {
                id: data.id,
                email: data.email,
                role: data.role
            };
            localStorage.setItem('hs_user', JSON.stringify(session));
        }

        return data;
    },

    /**
     * Clear all session data
     */
    logout() {
        const refreshToken = localStorage.getItem('hs_refresh_token');
        if (refreshToken) {
            apiClient.post('/api/auth/logout', { refreshToken }).catch(e => {
                console.error('Failed to revoke token on logout:', e);
            });
        }
        localStorage.removeItem('hs_token');
        localStorage.removeItem('hs_refresh_token');
        localStorage.removeItem('hs_user');
        
        // Comprehensive cleanup of all application-prefixed keys
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('hs_') || key === 'pendingBooking') {
                localStorage.removeItem(key);
            }
        });
    },

    /**
     * Retrieve core session data
     */
    getCurrentUser() {
        try {
            const stored = localStorage.getItem('hs_user');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('Failed to parse stored user:', e);
            return null;
        }
    },

    /**
     * Get active token
     */
    getToken() {
        return localStorage.getItem('hs_token');
    }
};
