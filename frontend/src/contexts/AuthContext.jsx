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

    function login(userData) {
        // userData may include a `token` field on initial login; store it separately
        const { token, ...rest } = userData;
        setUser(rest);
        localStorage.setItem('hs_user', JSON.stringify(rest));
        if (token) {
            localStorage.setItem('hs_token', token);
        }
    }

    function logout() {
        setUser(null);
        localStorage.removeItem('hs_user');
        localStorage.removeItem('hs_token');
    }

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
