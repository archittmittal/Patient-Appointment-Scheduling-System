import { apiClient } from './apiClient';

export const authService = {
    async login(email, password) {
        const data = await apiClient.post('/api/auth/login', { email, password });
        
        if (data.token) {
            localStorage.setItem('hs_token', data.token);
            const user = {
                id: data.id,
                email: data.email,
                role: data.role,
                first_name: data.first_name,
                last_name: data.last_name
            };
            localStorage.setItem('hs_user', JSON.stringify(user));
        }
        
        return data;
    },

    async register(userData) {
        const data = await apiClient.post('/api/auth/register', userData);

        if (data.token) {
            localStorage.setItem('hs_token', data.token);
            const user = {
                id: data.id,
                email: data.email,
                role: data.role,
                first_name: data.first_name,
                last_name: data.last_name
            };
            localStorage.setItem('hs_user', JSON.stringify(user));
        }

        return data;
    },

    logout() {
        localStorage.removeItem('hs_token');
        localStorage.removeItem('hs_user');
        localStorage.removeItem('pendingBooking');
        // Clear all keys starting with hs_ to be safe
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('hs_')) localStorage.removeItem(key);
        });
    },

    getCurrentUser() {
        try {
            const stored = localStorage.getItem('hs_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    },

    getToken() {
        return localStorage.getItem('hs_token');
    }
};
