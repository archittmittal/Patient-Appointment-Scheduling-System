import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';

// Mock react-router-dom Navigate
vi.mock('react-router-dom', () => ({
  Navigate: vi.fn(({ to }) => <div data-testid="navigate" data-to={to} />),
}));

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute Component', () => {
  it('should redirect unauthenticated users to /login', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('should redirect unauthorized roles to their dashboard', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'PATIENT' } });
    render(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/patient-dashboard');
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('should render children when user role is allowed', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'ADMIN' } });
    render(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
