import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState(() => {
        try {
            const stored = localStorage.getItem('hs_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    // Sync profile with auth user on login/initial load
    useEffect(() => {
        if (!user) {
            setProfile(null);
        } else {
            const stored = JSON.parse(localStorage.getItem('hs_user') || '{}');
            setProfile(stored);
        }
    }, [user]);

    const updateProfile = useCallback((updatedData) => {
        const newProfile = { ...profile, ...updatedData };
        setProfile(newProfile);
        localStorage.setItem('hs_user', JSON.stringify(newProfile));
    }, [profile]);

    const value = React.useMemo(() => ({
        profile,
        updateProfile,
        fullName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Guest User',
        initials: profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() : '??'
    }), [profile, updateProfile]);

    return (
        <ProfileContext.Provider value={value}>
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfileContext() {
    const context = useContext(ProfileContext);
    if (!context) {
        throw new Error('useProfileContext must be used within a ProfileProvider');
    }
    return context;
}
