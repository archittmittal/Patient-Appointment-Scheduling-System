import React, { createContext, useContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => authService.getCurrentUser());
    const [loading, setLoading] = useState(false);

    const login = useCallback((userData) => {
        // authService.login() already saved the correct slim user object to localStorage.
        // Read from there to guarantee we get {id, email, role, first_name, last_name}.
        // Fall back to extracting from userData if localStorage isn't set yet.
        const stored = authService.getCurrentUser();
        const userToSet = stored || userData.user || {
            id: userData.id,
            email: userData.email,
            role: userData.role,
            first_name: userData.first_name,
            last_name: userData.last_name,
        };
        setUser(userToSet);
    }, []);

    const logout = useCallback(() => {
        authService.logout();
        setUser(null);
    }, []);

    const value = {
        user,
        loading,
        setLoading,
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
