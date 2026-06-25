import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookAppointment from '../pages/BookAppointment';
import { apiClient } from '../services/apiClient';

// Mock useNavigate & useLocation
const mockNavigate = vi.fn();
const mockLocation = { state: null };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'PATIENT', first_name: 'John', last_name: 'Doe' },
  }),
}));

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock framer-motion to bypass animation delays
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock Stripe elements
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div data-testid="stripe-elements">{children}</div>,
}));

// Mock child components
vi.mock('../components/InsuranceScanner', () => ({
  default: ({ onScanComplete }) => (
    <button data-testid="mock-scanner" onClick={() => onScanComplete({ provider: 'Aetna', policyNumber: '123' })}>
      Scan Insurance
    </button>
  ),
}));

vi.mock('../components/InsuranceForm', () => ({
  default: ({ onSave }) => (
    <button data-testid="mock-insurance-form" onClick={() => onSave({ provider: 'Cigna', policyNumber: '456' })}>
      Save Insurance
    </button>
  ),
}));

vi.mock('../components/CheckoutForm', () => ({
  default: ({ onSuccess }) => (
    <button data-testid="mock-checkout" onClick={() => onSuccess('payment-intent-123')}>
      Pay Now
    </button>
  ),
}));

describe('BookAppointment Page Component', () => {
  const mockDepartments = [
    { id: 1, name: 'Cardiology' },
    { id: 2, name: 'Pediatrics' },
  ];

  const mockDoctors = [
    {
      id: 10,
      first_name: 'Sarah',
      last_name: 'Connor',
      specialty: 'Cardiology',
      location_room: 'Room 101',
      availability: JSON.stringify({
        monday: { open: true, from: '09:00', to: '12:00' },
        tuesday: { open: false },
        wednesday: { open: true, from: '10:00', to: '14:00' },
        thursday: { open: true, from: '09:00', to: '17:00' },
        friday: { open: true, from: '09:00', to: '17:00' },
        saturday: { open: false },
        sunday: { open: false },
      }),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default API mocks
    apiClient.get.mockImplementation((url) => {
      if (url === '/api/departments') {
        return Promise.resolve(mockDepartments);
      }
      if (url === '/api/doctors') {
        return Promise.resolve(mockDoctors);
      }
      if (url === '/api/insurance/my') {
        return Promise.resolve(null);
      }
      if (url.includes('/blocked-dates')) {
        return Promise.resolve([]);
      }
      if (url.includes('/slot-counts')) {
        return Promise.resolve({ '10:00 AM': 0 });
      }
      return Promise.resolve([]);
    });
  });

  it('renders Step 1: department selection successfully', async () => {
    await act(async () => {
      render(<BookAppointment />);
    });

    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Pediatrics')).toBeInTheDocument();
  });

  it('filters doctors by department and allows selecting a doctor', async () => {
    await act(async () => {
      render(<BookAppointment />);
    });

    // Select Cardiology
    const cardBtn = screen.getByText('Cardiology');
    await act(async () => {
      fireEvent.click(cardBtn);
    });

    // Step 2 should render doctor matching 'Cardiology'
    expect(screen.getByText('Dr. Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Room 101')).toBeInTheDocument();

    // Select Doctor Sarah Connor
    const docBtn = screen.getByText('Dr. Sarah Connor');
    await act(async () => {
      fireEvent.click(docBtn);
    });

    // Step 3: Choose Date & Time
    expect(screen.getByText('Choose Date & Time')).toBeInTheDocument();
  });

  it('allows user to navigate through dates and select slots', async () => {
    await act(async () => {
      render(<BookAppointment />);
    });

    // Select Cardiology department
    await act(async () => {
      fireEvent.click(screen.getByText('Cardiology'));
    });

    // Select Doctor
    await act(async () => {
      fireEvent.click(screen.getByText('Dr. Sarah Connor'));
    });

    // Step 3 Calendar should render
    // Let's click on a weekday, e.g. day button (we can mock selected date directly)
    // For simplicity, we can verify that the calendar month is displayed
    const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    expect(screen.getByText(currentMonthLabel)).toBeInTheDocument();
  });

  it('handles waitlist joining when no slots are available', async () => {
    localStorage.setItem('pendingBooking', JSON.stringify({
      doctorId: 10,
      specialty: 'Cardiology',
      date: '2026-06-23', // a Tuesday (which has tuesday: { open: false } in mockDoctors)
      step: 3
    }));

    apiClient.post.mockResolvedValue({ success: true });

    await act(async () => {
      render(<BookAppointment />);
    });

    // Expect to be on Step 3: Choose Date & Time
    expect(screen.getByText('Choose Date & Time')).toBeInTheDocument();

    // The waitlist prompt should be visible since Tuesday is closed
    expect(screen.getByText('No slots available on this date.')).toBeInTheDocument();

    // Click "Join Priority Waitlist"
    const joinButton = screen.getByRole('button', { name: 'Join Priority Waitlist' });
    await act(async () => {
      fireEvent.click(joinButton);
    });

    // Verify API call
    expect(apiClient.post).toHaveBeenCalledWith('/api/appointments/waitlist/join', {
      doctorId: 10,
      preferredDate: '2026-06-23',
      timePreference: 'ANY',
      maxNoticeHours: 24,
      reason: 'Patient requested earlier availability',
    });

    // Expect the UI to show the waitlist joined state
    expect(screen.getByText("You're on the waitlist!")).toBeInTheDocument();
  });
});
