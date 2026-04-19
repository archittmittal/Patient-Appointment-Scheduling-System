import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('hs_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [loading, setLoading] = useState(false);

    const login = (userData) => {
        setUser(userData.user || userData);
        localStorage.setItem('hs_token', userData.token);
        localStorage.setItem('hs_user', JSON.stringify(userData.user || userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('hs_token');
        localStorage.removeItem('hs_user');
        localStorage.removeItem('pendingBooking');
        // Clear all keys starting with hs_ to be safe
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('hs_')) localStorage.removeItem(key);
        });
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
