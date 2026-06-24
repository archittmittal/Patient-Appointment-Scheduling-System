import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../pages/Login';
import { authService } from '../services/authService';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { state: null };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

// Mock authService
vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }) => (
    <div>
      <button data-testid="google-login-success-btn" onClick={() => onSuccess({ credential: 'mock-google-token' })}>
        Google Login Success
      </button>
      <button data-testid="google-login-error-btn" onClick={() => onError()}>
        Google Login Error
      </button>
    </div>
  ),
}));

describe('Login Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all form inputs, submit buttons, and demo credentials', () => {
    render(<Login />);
    
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Doctor')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('pre-fills fields when clicking demo credentials', () => {
    render(<Login />);
    
    const patientDemo = screen.getByText('Patient').closest('div');
    fireEvent.click(patientDemo);
    
    expect(screen.getByPlaceholderText('name@example.com')).toHaveValue('patient@example.com');
    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('password123');
  });

  it('calls authService.login and redirects to patient dashboard on successful login', async () => {
    const mockUserData = { token: 'token-123', role: 'PATIENT', user: { id: 1, email: 'patient@example.com' } };
    authService.login.mockResolvedValue(mockUserData);
    
    render(<Login />);
    
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    
    fireEvent.change(emailInput, { target: { value: 'patient@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    
    expect(authService.login).toHaveBeenCalledWith('patient@example.com', 'password123');
    expect(mockLogin).toHaveBeenCalledWith(mockUserData);
    expect(mockNavigate).toHaveBeenCalledWith('/patient-dashboard');
  });

  it('displays custom error message when credentials are invalid', async () => {
    authService.login.mockResolvedValue({ error: true, message: 'Invalid credentials' });
    
    render(<Login />);
    
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    
    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    
    expect(authService.login).toHaveBeenCalledWith('wrong@example.com', 'wrong');
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('handles Google SSO login success', async () => {
    const mockUserData = { token: 'google-jwt', role: 'PATIENT', user: { id: 2, email: 'google@example.com' } };
    authService.googleLogin.mockResolvedValue(mockUserData);
    
    render(<Login />);
    
    const googleBtn = screen.getByTestId('google-login-success-btn');
    
    await act(async () => {
      fireEvent.click(googleBtn);
    });
    
    expect(authService.googleLogin).toHaveBeenCalledWith('mock-google-token');
    expect(mockLogin).toHaveBeenCalledWith(mockUserData);
    expect(mockNavigate).toHaveBeenCalledWith('/patient-dashboard');
  });

  it('handles Google SSO login error', async () => {
    render(<Login />);
    
    const googleBtn = screen.getByTestId('google-login-error-btn');
    
    await act(async () => {
      fireEvent.click(googleBtn);
    });
    
    expect(screen.getByText('Google login was unsuccessful or canceled.')).toBeInTheDocument();
  });
});
