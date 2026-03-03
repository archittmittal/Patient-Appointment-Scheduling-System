export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';

export function authedHeaders(body = false) {
    const token = localStorage.getItem('hs_token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    return headers;
}
