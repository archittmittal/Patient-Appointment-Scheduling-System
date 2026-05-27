// Central API base URL.
// Set VITE_API_URL in your .env file to point to the correct backend.
// Falls back to localhost:5001 for local development so nothing breaks without a .env.
export const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:7860');
export const API_URL = `${API}/api`;

/** Returns headers for an authenticated request.
 *  Pass body=true when sending JSON to also include Content-Type. */
export function authedHeaders(body = false) {
    const token = localStorage.getItem('hs_token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    return headers;
}
