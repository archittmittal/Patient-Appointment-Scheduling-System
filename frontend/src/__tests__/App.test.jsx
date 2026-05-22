import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock child components or services that make network calls or rely on window properties
vi.mock('../pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

describe('App Component Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
      headers: { get: () => 'application/json' },
    });
  });

  it('renders without crashing and shows login page by default redirect', async () => {
    render(<App />);
    const loginPage = await screen.findByTestId('login-page');
    expect(loginPage).toBeInTheDocument();
  });
});
