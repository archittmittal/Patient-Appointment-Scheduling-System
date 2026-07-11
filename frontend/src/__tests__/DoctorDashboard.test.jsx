import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DoctorDashboard from '../pages/DoctorDashboard';
import { apiClient } from '../services/apiClient';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 5, role: 'DOCTOR', first_name: 'Sarah', last_name: 'Connor' },
  }),
}));

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// Mock sseService
vi.mock('../services/sseService', () => ({
  sseService: {
    connectDoctor: vi.fn(),
    disconnect: vi.fn(),
  },
}));

// Mock EmergencyModal
vi.mock('../components/EmergencyModal', () => ({
  default: ({ isOpen, onClose }) => (
    isOpen ? (
      <div data-testid="mock-emergency-modal">
        Emergency Modal
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

describe('DoctorDashboard Page Component', () => {
  const mockQueue = [
    {
      queue_id: 101,
      queue_number: 1,
      first_name: 'John',
      last_name: 'Doe',
      time_slot: '10:00 AM',
      queue_status: 'WAITING',
      virtual_checkin_status: 'CHECKED_IN',
      patient_id: 50,
    },
    {
      queue_id: 102,
      queue_number: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      time_slot: '11:00 AM',
      queue_status: 'IN_PROGRESS',
      virtual_checkin_status: 'ARRIVED',
      patient_id: 51,
    },
  ];

  const mockPatients = [
    {
      appointment_id: 501,
      first_name: 'John',
      last_name: 'Doe',
      appointment_date: '2026-06-25',
      time_slot: '10:00 AM',
      status: 'CONFIRMED',
    },
  ];

  const mockDelayStatus = {
    isDelayed: false,
    delayMins: 0,
    reason: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    apiClient.get.mockImplementation((url) => {
      if (url.includes('/queue')) {
        return Promise.resolve(mockQueue);
      }
      if (url.includes('/patients')) {
        return Promise.resolve(mockPatients);
      }
      if (url.includes('/delay-status')) {
        return Promise.resolve(mockDelayStatus);
      }
      if (url.includes('/vitals')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    apiClient.post.mockResolvedValue({ success: true });
    apiClient.patch.mockResolvedValue({ success: true });
  });

  it('renders queue tab and statistics widgets successfully', async () => {
    await act(async () => {
      render(<DoctorDashboard />);
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Initiate Session')).toBeInTheDocument();
    expect(screen.getByText('Complete Analysis')).toBeInTheDocument();
    expect(screen.getByText('📡 Remote Checked-In')).toBeInTheDocument();
    expect(screen.getByText('🏥 Arrived at Clinic')).toBeInTheDocument();
  });

  it('triggers updateQueueStatus to IN_PROGRESS when clicking Initiate Session', async () => {
    await act(async () => {
      render(<DoctorDashboard />);
    });

    const initiateBtn = screen.getByText('Initiate Session');
    await act(async () => {
      fireEvent.click(initiateBtn);
    });

    expect(apiClient.patch).toHaveBeenCalledWith('/api/appointments/queue/101/status', { status: 'IN_PROGRESS' });
  });

  it('opens NotesModal and updates status to COMPLETED when filling clinical notes', async () => {
    await act(async () => {
      render(<DoctorDashboard />);
    });

    const completeBtn = screen.getByText('Complete Analysis');
    await act(async () => {
      fireEvent.click(completeBtn);
    });

    // NotesModal should be visible now
    expect(screen.getByText('Clinical Assessment')).toBeInTheDocument();
    expect(screen.getByText('Patient:')).toBeInTheDocument();
    expect(screen.getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);

    const diagnosisInput = screen.getByPlaceholderText('Enter clinical diagnosis...');
    const addMedicineBtn = screen.getByRole('button', { name: '+ Add Medicine' });
    const submitBtn = screen.getByText('Verify & Complete');

    fireEvent.change(diagnosisInput, { target: { name: 'diagnosis', value: 'Influenza' } });
    
    // Add medicine row
    await act(async () => {
      fireEvent.click(addMedicineBtn);
    });

    const medicineNameInput = screen.getByPlaceholderText('Medicine Name (e.g. Paracetamol 650mg)');
    fireEvent.change(medicineNameInput, { target: { value: 'Tamiflu 75mg' } });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(apiClient.patch).toHaveBeenCalledWith('/api/appointments/queue/102/status', {
      status: 'COMPLETED',
      diagnosis: 'Influenza',
      notes: null,
      prescription: 'Tamiflu 75mg — 1-0-1 for 5 Days (After food)',
      follow_up_date: null,
      vitals: null,
    });
  });

  it('opens Active Delay modal, selects time, and broadcasts lag', async () => {
    await act(async () => {
      render(<DoctorDashboard />);
    });

    // Click on configure delay card (initially shows 0m)
    const configureDelayCard = screen.getByText('0m').closest('button');
    await act(async () => {
      fireEvent.click(configureDelayCard);
    });

    expect(screen.getByText('Active Delay')).toBeInTheDocument();
    expect(screen.getByText('Broadcast schedule lag to all patients.')).toBeInTheDocument();

    // Select 30 mins (button label is "30 MIN")
    const btn30 = screen.getByRole('button', { name: '30 MIN' });
    fireEvent.click(btn30);

    const reasonInput = screen.getByPlaceholderText('e.g. Case overflow, Surgical priority...');
    fireEvent.change(reasonInput, { target: { value: 'Surgical delay' } });

    const applyBtn = screen.getByText('Propagate');
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/doctors/5/delay', {
      delayMins: 30,
      reason: 'Surgical delay',
    });
  });
});
