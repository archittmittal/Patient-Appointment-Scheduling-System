import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WalkinRegistration from '../pages/WalkinRegistration';
import { apiClient } from '../services/apiClient';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 10, role: 'RECEPTIONIST' },
  }),
}));

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('WalkinRegistration Page Component', () => {
  const mockDoctors = [
    { id: 1, first_name: 'Sarah', last_name: 'Connor', specialty: 'General Medicine' },
    { id: 2, first_name: 'John', last_name: 'Connor', specialty: 'General Medicine' },
    { id: 3, first_name: 'Kyle', last_name: 'Reese', specialty: 'Pediatrics' }
  ];

  const mockWorkloads = [
    { doctorId: 1, totalWaitMins: 15, estimatedTotalMins: 15 }, // Low wait Connor
    { doctorId: 2, totalWaitMins: 45, estimatedTotalMins: 45 }, // Medium wait Connor
    { doctorId: 3, totalWaitMins: 75, estimatedTotalMins: 75 }  // High wait Reese
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url.includes('/api/doctors')) {
        return Promise.resolve(mockDoctors);
      }
      if (url.includes('/api/analytics/optimizer/workloads')) {
        return Promise.resolve(mockWorkloads);
      }
      return Promise.resolve([]);
    });
  });

  it('renders department dropdown and lists doctors with their congestion load badges', async () => {
    await act(async () => {
      render(<WalkinRegistration />);
    });

    expect(screen.getByText('Clinical Node Selection')).toBeInTheDocument();
    expect(screen.getByText('Filter by Department')).toBeInTheDocument();

    // Check doctor cards and badges
    expect(screen.getByText('Dr. Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Dr. John Connor')).toBeInTheDocument();
    expect(screen.getByText('Dr. Kyle Reese')).toBeInTheDocument();

    // Congestion load badges
    expect(screen.getByText('Low Load - 15m wait')).toBeInTheDocument();
    expect(screen.getByText('Medium Load - 45m wait')).toBeInTheDocument();
    expect(screen.getByText('High Traffic - 75m wait')).toBeInTheDocument();
  });

  it('automatically selects the doctor with the lowest wait time when department is selected', async () => {
    await act(async () => {
      render(<WalkinRegistration />);
    });

    // Select General Medicine specialty
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: 'General Medicine' } });
    });

    // Kyle Reese (Pediatrics) should be filtered out
    expect(screen.queryByText('Dr. Kyle Reese')).not.toBeInTheDocument();

    // Sarah Connor and John Connor should be visible
    expect(screen.getByText('Dr. Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Dr. John Connor')).toBeInTheDocument();

    // Dr. Sarah Connor has 15m wait vs John's 45m, so she should be Recommended and selected!
    expect(screen.getByText('Recommended')).toBeInTheDocument();

    // Check that Sarah Connor card is selected (selected state adds CheckCircle icon or active CSS border class)
    const sarahBtn = screen.getByText('Dr. Sarah Connor').closest('button');
    expect(sarahBtn).toHaveClass('border-primary');
  });
});
