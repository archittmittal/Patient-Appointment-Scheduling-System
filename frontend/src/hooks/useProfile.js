import { useProfileContext } from '../contexts/ProfileContext';
import { useMemo } from 'react';

/**
 * Hook for accessing and managing the user's profile.
 * Decouples profile UI logic from the core AuthContext.
 */
export function useProfile() {
    const { profile, updateProfile, fullName, initials } = useProfileContext();

    return {
        profile,
        updateProfile,
        fullName,
        initials,
        email: profile?.email,
        id: profile?.id
    };
}
