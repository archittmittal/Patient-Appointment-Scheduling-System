import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

/**
 * useCurrentUser Hook
 * Decouples rich user profile data from the authentication session.
 * Implements a simple cache mechanism to prevent redundant fetches.
 */
const profileCache = new Map();

export function useCurrentUser() {
    const { user, isAuthenticated } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchProfile = useCallback(async (force = false) => {
        if (!isAuthenticated || !user?.id) return;

        // Use cache if available and not forcing refresh
        if (!force && profileCache.has(user.id)) {
            setProfile(profileCache.get(user.id));
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // Determine endpoint based on role
            const endpoint = user.role === 'DOCTOR' 
                ? `/api/doctors/profile` 
                : `/api/patients/profile`;
            
            const data = await apiClient.get(endpoint);
            profileCache.set(user.id, data);
            setProfile(data);
        } catch (err) {
            console.error('Failed to fetch user profile:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchProfile();
        } else {
            setProfile(null);
            profileCache.clear(); // Clear cache on logout
        }
    }, [isAuthenticated, fetchProfile]);

    const refresh = () => fetchProfile(true);

    return { 
        profile, 
        loading, 
        error, 
        refresh,
        // Helper to get initials or display name safely
        displayName: profile 
            ? `${profile.first_name} ${profile.last_name}`.trim() 
            : user?.email || 'User'
    };
}
