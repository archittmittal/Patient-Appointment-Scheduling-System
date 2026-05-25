import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

/**
 * AuthProvider
 * Responsible for Session Management ONLY (Tokens & Core Identifiers).
 * Profile details are handled by useCurrentUser hook.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => authService.getCurrentUser());

    const login = useCallback((userData) => {
        // We only store core identifiers in context state
        // names/profile data should be fetched via useCurrentUser
        const sessionUser = {
            id: userData.id,
            email: userData.email,
            role: userData.role
        };
        setUser(sessionUser);
    }, []);

    const logout = useCallback(() => {
        authService.logout();
        setUser(null);
    }, []);

    const value = useMemo(() => ({
        user,
        isAuthenticated: !!user,
        role: user?.role || null,
        login,
        logout
    }), [user, login, logout]);

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
