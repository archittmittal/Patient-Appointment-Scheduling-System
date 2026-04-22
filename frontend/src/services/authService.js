import { API } from '../config/api';
import { safeFetch } from '../utils/apiHelper';

export const authService = {
    async login(email, password) {
        const data = await safeFetch(`${API}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (data.token) {
            localStorage.setItem('hs_token', data.token);
            localStorage.setItem('hs_user', JSON.stringify(data.user));
        }
        
        return data;
    },

    async register(userData) {
        return await safeFetch(`${API}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
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
