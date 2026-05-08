import React, { createContext, useContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => authService.getCurrentUser());
    const [loading, setLoading] = useState(false);

    const login = useCallback((userData) => {
        const stored = authService.getCurrentUser();
        const userToSet = stored || userData.user || {
            id: userData.id,
            email: userData.email,
            role: userData.role,
        };
        // Ensure we don't store name fields in the primary auth user object if they exist in userData
        const sessionUser = {
            id: userToSet.id,
            email: userToSet.email,
            role: userToSet.role
        };
        setUser(sessionUser);
    }, []);

    const logout = useCallback(() => {
        authService.logout();
        setUser(null);
    }, []);

    const value = React.useMemo(() => ({
        user,
        loading,
        setLoading,
        login,
        logout,
        isAuthenticated: !!user,
        role: user?.role || null
    }), [user, loading, login, logout]);

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
