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
        setUser(userData);
        localStorage.setItem('hs_user', JSON.stringify(userData));
    }

    function logout() {
        setUser(null);
        localStorage.removeItem('hs_user');
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
