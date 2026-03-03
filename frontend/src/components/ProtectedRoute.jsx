import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_HOME = {
    PATIENT: '/patient-dashboard',
    DOCTOR: '/doctor-dashboard',
    ADMIN: '/admin-dashboard',
};

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
    }

    return children;
}
