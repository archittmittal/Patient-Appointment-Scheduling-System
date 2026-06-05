import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
    apiClient: {
        post: vi.fn(),
    },
}));

describe('authService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('googleLogin', () => {
        it('should send google token to backend and persist session on success', async () => {
            const mockResponse = {
                token: 'mock-jwt-token',
                id: 1,
                email: 'test@example.com',
                role: 'PATIENT',
            };
            
            vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

            const result = await authService.googleLogin('mock-google-token');

            expect(apiClient.post).toHaveBeenCalledWith('/api/auth/google', { token: 'mock-google-token' });
            expect(result).toEqual(mockResponse);
            
            expect(localStorage.getItem('hs_token')).toBe('mock-jwt-token');
            const user = JSON.parse(localStorage.getItem('hs_user'));
            expect(user.email).toBe('test@example.com');
            expect(user.role).toBe('PATIENT');
        });

        it('should return error without persisting session if login fails', async () => {
            const mockErrorResponse = { error: true, message: 'Invalid token' };
            vi.mocked(apiClient.post).mockResolvedValue(mockErrorResponse);

            const result = await authService.googleLogin('invalid-token');

            expect(result).toEqual(mockErrorResponse);
            expect(localStorage.getItem('hs_token')).toBeNull();
        });
    });
});
