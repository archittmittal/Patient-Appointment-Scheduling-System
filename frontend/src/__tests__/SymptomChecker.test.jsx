import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SymptomChecker from '../pages/SymptomChecker';
import { apiClient } from '../services/apiClient';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('SymptomChecker Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders input area successfully', () => {
    render(<SymptomChecker />);
    expect(screen.getByText('Describe Your Symptoms')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter how you are feeling/)).toBeInTheDocument();
  });

  it('runs analysis and allows booking a recommended doctor', async () => {
    vi.useFakeTimers();

    const mockAnalysisResult = {
      mappedSpecialty: 'Cardiologist',
      explanation: 'Symptom analysis indicates cardiovascular priority.',
      suggestedDoctors: [
        {
          id: 32,
          name: 'Dr. Sarah Jenkins',
          specialty: 'Cardiologist',
          locationRoom: 'Heart Care Pavilion, Block C',
          rating: 4.9,
          estimatedWaitMins: 10,
          consultationFee: 1500.0,
        },
      ],
    };

    apiClient.post.mockResolvedValue(mockAnalysisResult);

    render(<SymptomChecker />);

    const textarea = screen.getByPlaceholderText(/Enter how you are feeling/);
    fireEvent.change(textarea, { target: { value: 'I have severe palpitations' } });

    const submitBtn = screen.getByRole('button', { name: /Run Diagnostics/ });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Fast forward the 5 log stages
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
    }

    // Wait for API call to settle
    await act(async () => {
      await Promise.resolve();
    });

    // Check that results are visible
    expect(screen.getAllByText('Cardiologist')[0]).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Jenkins')).toBeInTheDocument();

    // Click "Select & Book"
    const bookBtn = screen.getByRole('button', { name: /Select & Book/ });
    await act(async () => {
      fireEvent.click(bookBtn);
    });

    // Verify localStorage has step: 3
    const saved = JSON.parse(localStorage.getItem('pendingBooking'));
    expect(saved).toEqual({
      doctorId: 32,
      specialty: 'Cardiologist',
      step: 3
    });

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith('/book', {
      state: { symptoms: 'I have severe palpitations' }
    });

    vi.useRealTimers();
  });
});
