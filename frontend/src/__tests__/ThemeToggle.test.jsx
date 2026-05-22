import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ThemeToggle from '../components/ThemeToggle';

// Mock ThemeContext
const mockToggleTheme = vi.fn();
let currentTheme = 'light';

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: currentTheme,
    toggleTheme: mockToggleTheme,
  }),
}));

describe('ThemeToggle Component', () => {
  it('renders successfully with light mode title', () => {
    currentTheme = 'light';
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Switch to Dark Mode');
  });

  it('renders successfully with dark mode title', () => {
    currentTheme = 'dark';
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Switch to Light Mode');
  });

  it('triggers toggleTheme when clicked', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    button.click();
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });
});
