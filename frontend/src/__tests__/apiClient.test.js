import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../services/apiClient';

describe('apiClient Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call fetch with correct GET method and headers', async () => {
    const mockData = { id: 1, name: 'John Doe' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(mockData),
    });

    const result = await apiClient.get('/api/test');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.any(Object),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should call fetch with correct POST method and body', async () => {
    const postBody = { name: 'New Patient' };
    const mockResponse = { success: true };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(mockResponse),
    });

    const result = await apiClient.post('/api/patients', postBody);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/patients'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(postBody),
        headers: expect.any(Object),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('should handle non-OK responses correctly', async () => {
    const mockError = { message: 'Bad Request' };
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve(mockError),
    });

    const result = await apiClient.get('/api/bad-request');
    expect(result).toEqual({ ...mockError, error: true, status: 400 });
  });

  it('should catch fetch errors and return the default value', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));
    const result = await apiClient.get('/api/network-error', ['default']);
    expect(result).toEqual(['default']);
  });
});
