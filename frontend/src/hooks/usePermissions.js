import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for Role-Based Access Control (RBAC)
 * Decouples role checks from component logic.
 */
export function usePermissions() {
    const { user, role } = useAuth();

    const permissions = {
        PATIENT: [
            'book_appointment',
            'view_own_appointments',
            'manage_own_insurance',
            'virtual_checkin'
        ],
        DOCTOR: [
            'view_schedule',
            'manage_queue',
            'prescribe_meds',
            'view_patient_history'
        ],
        ADMIN: [
            'manage_users',
            'view_all_reports',
            'system_config',
            'manage_doctors'
        ]
    };

    /**
     * Check if current user has a specific permission
     * @param {string} permission 
     * @returns {boolean}
     */
    const can = (permission) => {
        if (!role) return false;
        const rolePermissions = permissions[role] || [];
        return rolePermissions.includes(permission) || role === 'ADMIN';
    };

    /**
     * Helper to check for multiple permissions
     */
    const canAll = (perms) => perms.every(p => can(p));
    const canAny = (perms) => perms.some(p => can(p));

    return {
        can,
        canAll,
        canAny,
        role,
        isPatient: role === 'PATIENT',
        isDoctor: role === 'DOCTOR',
        isAdmin: role === 'ADMIN'
    };
}
