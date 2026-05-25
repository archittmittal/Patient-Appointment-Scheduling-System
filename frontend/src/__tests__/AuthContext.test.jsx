import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

// Mock authService
vi.mock('../services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}));

function TestComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{user?.email || 'no-email'}</div>
      <button data-testid="login-btn" onClick={() => login({ id: 1, email: 'test@example.com', role: 'PATIENT' })}>
        Login
      </button>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext & AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with user from authService', () => {
    authService.getCurrentUser.mockReturnValue({ id: 1, email: 'test@example.com', role: 'PATIENT' });
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('should support logging in', () => {
    authService.getCurrentUser.mockReturnValue(null);
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');

    act(() => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('should support logging out', () => {
    authService.getCurrentUser.mockReturnValue({ id: 1, email: 'test@example.com', role: 'PATIENT' });
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    act(() => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(authService.logout).toHaveBeenCalled();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    const consoleError = console.error;
    console.error = vi.fn(); // Suppress error boundary noise
    expect(() => render(<TestComponent />)).toThrow('useAuth must be used within an AuthProvider');
    console.error = consoleError;
  });
});
